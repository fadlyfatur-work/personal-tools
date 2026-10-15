import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
const schema = z.object({
  q: z.string().trim().max(240).default(''),
  group: z.enum(['', 'tenaga', 'bahan', 'alat']).default(''),
  field: z.string().max(100).default(''), unit: z.string().max(80).default(''),
  regulation: z.enum(['', 'SE 47/2026', 'PERMEN 08/2023', 'SE 182/2025']).default(''),
  analysis: z.enum(['', 'extracted', 'needs_review', 'unavailable']).default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  key: z.string().regex(/^[a-f0-9]{32}$/).optional(),
})

export async function GET(request: Request) {
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return Response.json({ error: 'Filter komponen tidak valid.' }, { status: 400 })
  const filters = parsed.data
  try {
    const db = getSupabaseAdmin()
    const [{ data, error }, validation] = await Promise.all([db.rpc('ahsp_search_mptk', {
      p_q: filters.q.replace(/[\u0000-\u001f]/g, ' '), p_group: filters.group,
      p_field: filters.field, p_unit: filters.unit, p_regulation: filters.regulation,
      p_analysis: filters.analysis, p_page: filters.page, p_key: filters.key ?? '',
    }), db.rpc('ahsp_mptk_validation_stats', { p_regulation: filters.regulation, p_field: filters.field })])
    if (error) throw error
    if (validation.error) throw validation.error
    if (filters.key && !data.component) return Response.json({ error: 'Komponen tidak ditemukan dalam filter ini.' }, { status: 404 })
    const keys = Array.from(new Set<string>([...data.items.map((item: { key: string }) => item.key), ...(data.component ? [data.component.key] : [])]))
    let summaries: Record<string, unknown> = {}
    if (keys.length) {
      const result = await db.rpc('ahsp_mptk_coefficients', {
        p_keys: keys, p_q: filters.q.replace(/[\u0000-\u001f]/g, ' '), p_group: filters.group,
        p_field: filters.field, p_unit: filters.unit, p_regulation: filters.regulation, p_analysis: filters.analysis,
      })
      if (result.error) throw result.error
      summaries = result.data
    }
    const enrich = (item: { key: string }) => ({ ...item, coefficient_summary: summaries[item.key] })
    return Response.json({ ...data, items: data.items.map(enrich), component: data.component ? enrich(data.component) : null, validation: validation.data })
  } catch (error) {
    const code = (error as { code?: string })?.code
    const missing = ['PGRST202', '42883', '42P01'].includes(code ?? '')
    const reference = crypto.randomUUID()
    console.error('[MPTK]', { reference, code: code && /^[A-Z0-9]{5,12}$/.test(code) ? code : 'UNKNOWN' })
    return Response.json({ error: missing
      ? 'Katalog MPTK belum diaktifkan pada database. Hubungi pengelola aplikasi.'
      : code === '57014' ? 'Pencarian melewati batas waktu. Persempit kata kunci atau bidang.'
      : 'Katalog komponen belum dapat dimuat. Coba lagi.', reference }, { status: 503 })
  }
}
