import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { clientKey, rateLimit } from '@/lib/rateLimit'
import { isSameOrigin, submissionSchema } from '@/lib/ahspApproval'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const limit = rateLimit(`ahsp-submission:${clientKey(request)}`, 5, 60 * 60 * 1000)
  if (!limit.ok) return Response.json({ error: 'Batas pengajuan tercapai. Coba lagi nanti.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })
  if (!isSameOrigin(request)) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  if (Number(request.headers.get('content-length')) > 200000) return Response.json({ error: 'Permintaan terlalu besar.' }, { status: 413 })
  let parsed
  try {
    const text = await request.text()
    if (text.length > 200000) return Response.json({ error: 'Permintaan terlalu besar.' }, { status: 413 })
    parsed = submissionSchema.safeParse(JSON.parse(text))
  } catch { return Response.json({ error: 'Data usulan tidak valid.' }, { status: 400 }) }
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Lengkapi data analisis.' }, { status: 400 })
  try {
    const db = getSupabaseAdmin()
    const { data: item, error: itemError } = await db.from('ahsp_items').select('id,code,name,unit,field,regulation,components,analysis_status,verification_status').eq('id', parsed.data.itemId).is('archived_at', null).maybeSingle()
    if (itemError) throw itemError
    if (!item || item.verification_status !== 'needs_review' || item.field === 'SMKK') return Response.json({ error: 'Item ini tidak dapat menerima usulan analisis.' }, { status: 409 })
    const snapshot = { code: item.code, name: item.name, unit: item.unit, field: item.field, regulation: item.regulation, components: item.components, analysis_status: item.analysis_status }
    const { data, error } = await db.from('ahsp_analysis_submissions').insert({ item_id: item.id, base_snapshot: snapshot, components: parsed.data.components, source_reference: parsed.data.sourceReference }).select('id,status,submitted_at').single()
    if (error?.code === '23505') return Response.json({ error: 'Sudah ada usulan yang menunggu approval untuk pekerjaan ini.' }, { status: 409 })
    if (error) throw error
    return Response.json({ submission: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Usulan belum dapat disimpan. Coba lagi.' }, { status: 503 })
  }
}
