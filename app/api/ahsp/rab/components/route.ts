import { z } from 'zod'
import { AHSP_CATALOG_REGULATIONS, canUseAhspReference, type AhspItem } from '@/lib/ahsp'
import type { RabUsageAnalysis, RabUsageResource } from '@/lib/ahspRabUsage'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { clientKey, rateLimit } from '@/lib/rateLimit'
import { readAhspNativeComponents } from '@/lib/ahspNativeComponents'

export const dynamic = 'force-dynamic'
const schema = z.object({ ids: z.array(z.uuid()).min(1).max(100) }).strict()
export async function POST(request: Request) {
  const limit = rateLimit(`ahsp-rab-components:${clientKey(request)}`, 60, 60000)
  if (!limit.ok) return Response.json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })
  if (Number(request.headers.get('content-length')) > 10000) return Response.json({ error: 'Permintaan terlalu besar.' }, { status: 413 })
  let input
  try {
    const text = await request.text()
    if (text.length > 10000) return Response.json({ error: 'Permintaan terlalu besar.' }, { status: 413 })
    input = schema.safeParse(JSON.parse(text))
  } catch { return Response.json({ error: 'Daftar pekerjaan tidak valid.' }, { status: 400 }) }
  if (!input.success) return Response.json({ error: 'Pilih 1–100 identitas pekerjaan yang valid per permintaan.' }, { status: 400 })
  try {
    const db = getSupabaseAdmin(), ids = [...new Set(input.data.ids)]
    const result = await db.from('ahsp_items').select('*').in('id', ids).in('regulation', AHSP_CATALOG_REGULATIONS)
    if (result.error) throw result.error
    const items = (result.data ?? []) as AhspItem[]
    const targetIds = [...new Set(items.flatMap(item => item.analysis_target_id ? [item.analysis_target_id] : []))]
    let targets: AhspItem[] = []
    if (targetIds.length) {
      const result = await db.from('ahsp_items').select('*').in('id', targetIds).in('regulation', AHSP_CATALOG_REGULATIONS)
      if (result.error) throw result.error
      targets = result.data ?? []
    }
    const resolved = items.map(item => {
      const target = targets.find(target => target.id === item.analysis_target_id) ?? null
      return { item, analysis: canUseAhspReference(item, target) ? target! : item }
    })
    const analysisIds = [...new Set(resolved.map(row => row.analysis.id))]
    type Validated = { item_id: string; component: RabUsageResource & { coefficient: number | null; validation_issues: string[] } }
    const validated: Validated[] = []
    if (analysisIds.length) for (let start = 0; ; start += 1000) {
      const result = await db.from('ahsp_mptk_validation').select('item_id,position,component').in('item_id', analysisIds).order('item_id').order('position').range(start, start + 999)
      if (result.error) throw result.error
      validated.push(...(result.data ?? []))
      if ((result.data?.length ?? 0) < 1000) break
      if (start >= 49000) throw new Error('Component batch limit')
    }
    const identity = (item: AhspItem) => ({ id: item.id, code: item.code, name: item.name, unit: item.unit, regulation: item.regulation, regulation_status: item.regulation_status })
    const analyses: RabUsageAnalysis[] = resolved.map(({ item, analysis }) => {
      const source = validated.filter(row => row.item_id === analysis.id)
      const validIdentities = source.filter(row => Array.isArray(row.component.validation_issues) && row.component.validation_issues.length === 0)
      const valid = validIdentities.filter(row => row.component.coefficient !== 0)
      const excluded = source.length - validIdentities.length
      const native = !source.length ? readAhspNativeComponents(analysis) : { components: [], skipped: 0, zero: 0 }
      const zero = validIdentities.length - valid.length + native.zero
      const components = native.components.length ? native.components : valid.map(({ component: c }) => ({ group: c.group, name: c.name, unit: c.unit, code: c.code || '' }))
      const note = [excluded ? `${excluded} komponen tidak dihitung karena identitas atau kategorinya belum valid.` : '', native.components.length ? `Identitas komponen dibaca dari tabel teks sumber. Periksa lampiran untuk kelengkapannya.${native.skipped ? ` ${native.skipped} baris tabel belum dapat dibaca.` : ''}` : '', analysis.field === 'SMKK' ? 'Item biaya SMKK; tidak memiliki rincian tenaga kerja, material, atau peralatan pada data ini.' : !components.length && !excluded ? analysis.source_text ? 'Rincian MPTK belum terpetakan pada teks sumber pekerjaan ini.' : 'Sumber rincian analisis belum diimpor.' : '', analysis.analysis_status === 'needs_review' ? 'Analisis sumber masih perlu ditinjau; daftar penggunaan dapat belum lengkap.' : '', item.analysis_target_id && analysis.id === item.id ? 'Rujukan analisis belum terverifikasi; memakai rincian langsung jika tersedia.' : ''].filter(Boolean).join(' ')
      return { item: identity(item), analysis: identity(analysis), identity_scope: analysis.source_id ? JSON.stringify([analysis.regulation, analysis.field, analysis.source_id]) : undefined, status: native.components.length ? 'needs_review' : analysis.analysis_status, components, excluded_components: excluded + native.skipped, note: [zero ? `${zero} komponen berkoefisien nol tidak dihitung sebagai penggunaan.` : '', note].filter(Boolean).join(' ') }
    })
    return Response.json({ analyses, loadedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Rincian komponen belum dapat dimuat. Data rekonsiliasi tetap tersedia; coba lagi.' }, { status: 503 })
  }
}
