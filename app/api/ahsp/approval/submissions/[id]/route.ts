import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { hasApprovalSession, isSameOrigin, reviewSchema } from '@/lib/ahspApproval'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await hasApprovalSession(request)) return Response.json({ error: 'Masukkan PIN approval.' }, { status: 401 })
  if (!isSameOrigin(request)) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  const { id } = await context.params
  let parsed
  try { parsed = reviewSchema.safeParse(await request.json()) } catch { return Response.json({ error: 'Keputusan tidak valid.' }, { status: 400 }) }
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'Keputusan tidak valid.' }, { status: 400 })
  const { data, error } = await getSupabaseAdmin().rpc('ahsp_review_analysis_submission', {
    p_submission_id: id, p_action: parsed.data.action, p_review_note: parsed.data.note, p_confirm_identity: parsed.data.confirmIdentity,
  })
  if (error) return Response.json({ error: error.message?.includes('berubah sejak') ? 'Data katalog berubah sejak usulan dibuat. Muat ulang katalog sebelum keputusan.' : 'Keputusan gagal diproses. Periksa data usulan dan coba lagi.' }, { status: 409 })
  return Response.json({ result: data }, { headers: { 'Cache-Control': 'no-store' } })
}
