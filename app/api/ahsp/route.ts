import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { AHSP_CATALOG_REGULATIONS, AHSP_ARCHIVED_REGULATION, ahspPhraseSearchError, canUseAhspReference, parseAhspSearch } from '@/lib/ahsp'

export const dynamic = 'force-dynamic'
const schema = z.object({
  id: z.uuid().optional(), page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().max(6000).default(''), field: z.string().max(100).default(''),
  division: z.string().max(240).default(''), unit: z.string().max(80).default(''),
  status: z.enum(['','cocok','berbeda','belum_ditemukan','perlu_ditinjau','hanya_regulasi']).default(''),
  options: z.enum(['0','1']).default('0'),
  regulation: z.enum(['', 'SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025']).default(''),
  analysis: z.enum(['', 'extracted', 'needs_review', 'unavailable']).default(''),
  scope: z.enum(['all', 'jobs', 'components']).default('all'),
  mode: z.enum(['single', 'multiple']).default('single'),
  match: z.enum(['like', 'exact', 'phrases']).default('like'),
  sipasti: z.enum(['', 'database_only', 'sipasti_only', 'both']).default(''),
})
export async function GET(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return Response.json({ error: 'Filter atau identitas item tidak valid.' }, { status: 400 })
  const filters = parsed.data
  const searchText = filters.q.replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f]/g, ' ')
  const single = searchText.replace(/\s+/g, ' ').trim()
  if (!filters.id && filters.match === 'phrases') {
    const error = ahspPhraseSearchError(searchText)
    if (error) return Response.json({ error }, { status: 400 })
  }
  const terms = filters.match === 'phrases' || filters.mode === 'multiple' ? parseAhspSearch(searchText, filters.match) : single ? [single] : []
  if (terms.length > 50 || terms.some(term => term.length > 240)) return Response.json({ error: 'Gunakan maksimal 50 istilah, masing-masing sampai 240 karakter.' }, { status: 400 })
  try {
    const db = getSupabaseAdmin()
    if (filters.id) {
      const { data, error } = await db.from('ahsp_items').select('*').eq('id', filters.id).in('regulation', AHSP_CATALOG_REGULATIONS).maybeSingle()
      if (error) throw error
      if (!data) return Response.json({ error: 'Item pekerjaan tidak ditemukan.' }, { status: 404 })
      let target = null
      if (data.analysis_target_id) {
        const result = await db.from('ahsp_items').select('*').eq('id', data.analysis_target_id).in('regulation', AHSP_CATALOG_REGULATIONS).maybeSingle()
        if (result.error) throw result.error
        target = result.data
      }
      return Response.json({ item: data, reference_target: target, reference_ready: canUseAhspReference(data, target) })
    }
    {
      const search = await db.rpc('ahsp_search_items', {
        p_terms: terms, p_page: filters.page, p_field: filters.field,
        p_division: filters.division, p_unit: filters.unit,
        p_regulation: filters.regulation, p_analysis: filters.analysis, p_scope: filters.match === 'phrases' ? 'jobs' : filters.scope, p_match: filters.match,
        ...(filters.sipasti ? { p_sipasti: filters.sipasti } : {}),
      })
      if (search.error) throw search.error
      if (search.data.grouped_by_name !== true) throw { code: 'PGRST202' }
      if (filters.regulation === AHSP_ARCHIVED_REGULATION && search.data.archive_supported !== true) throw { code: 'PGRST202' }
      if (filters.match === 'phrases' && search.data.search_stats?.match !== 'phrases') throw { code: 'PGRST202' }
      if (search.data.items.length) {
        const references = await db.from('ahsp_items').select('id,analysis_reference').in('id', search.data.items.map((item: { id: string }) => item.id))
        if (references.error && references.error.code !== '42703') throw references.error
        if (references.data) search.data.items = search.data.items.map((item: { id: string }) => {
          const ref = references.data.find(row => row.id === item.id)?.analysis_reference
          return { ...item, analysis_reference: ref ? { ...ref, source_fingerprint: undefined, target_fingerprint: undefined } : null }
        })
      }
      let options = null
      if (filters.options === '1') {
        const result = await db.rpc('ahsp_catalog_options')
        if (result.error) throw result.error
        if (result.data.grouped_by_name !== true) throw { code: 'PGRST202' }
        options = { ...result.data, types: search.data.catalog_types }
      }
      return Response.json({ ...search.data, search_stats: { ...search.data.search_stats, match: filters.match }, options })
    }
  } catch (error) {
    const failure = error as { code?: string; message?: string }
    const code = typeof failure?.code === 'string' && /^[A-Z0-9]{5,12}$/.test(failure.code) ? failure.code : 'UNKNOWN'
    const message = typeof failure?.message === 'string' ? failure.message : ''
    const reason = code === '57014' ? 'SEARCH_TIMEOUT'
      : ['PGRST202', 'PGRST203', '42883'].includes(code) ? 'SEARCH_FUNCTION_UNAVAILABLE'
      : /fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(message) ? 'DATABASE_CONNECTION_FAILED'
      : message.startsWith('Missing NEXT_PUBLIC_SUPABASE_URL') ? 'DATABASE_CONFIGURATION_MISSING'
      : 'CATALOG_FAILED'
    const reference = crypto.randomUUID()
    console.error('[AHSP]', { reference, reason, code, termCount: terms.length, mode: filters.mode, match: filters.match })
    const explanation = reason === 'SEARCH_TIMEOUT' ? 'Pencarian melewati batas waktu database. Kurangi jumlah istilah atau persempit filter.'
      : reason === 'DATABASE_CONNECTION_FAILED' ? 'Koneksi server ke database terputus. Coba ulang pencarian.'
      : reason === 'SEARCH_FUNCTION_UNAVAILABLE' ? 'Fungsi pencarian database belum tersedia. Konfigurasi database perlu diperiksa.'
      : 'Katalog belum dapat dimuat. Coba ulang pencarian.'
    return Response.json({ error: explanation, code: reason, reference }, { status: 503 })
  }
}
