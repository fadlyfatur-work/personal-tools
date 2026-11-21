import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { hasApprovalSession } from '@/lib/ahspApproval'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!await hasApprovalSession(request)) return Response.json({ error: 'Masukkan PIN approval.' }, { status: 401 })
  const { data, error } = await getSupabaseAdmin().from('ahsp_analysis_submissions')
    .select('id,item_id,base_snapshot,components,source_reference,submitted_at,items:ahsp_items!ahsp_analysis_submissions_item_id_fkey!inner(id,code,name,unit,field,regulation,verification_status,archived_at)')
    .eq('status', 'pending').is('items.archived_at', null).order('submitted_at', { ascending: true }).limit(100)
  if (error) return Response.json({ error: 'Daftar usulan gagal dimuat.' }, { status: 503 })
  return Response.json({ submissions: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
