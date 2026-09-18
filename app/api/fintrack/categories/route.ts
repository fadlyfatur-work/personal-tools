import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const planId = await getOwnedPlanId(auth.identity.id)
  const { data: shared } = await supabaseAdmin
    .from('fintrack_account_collaborators')
    .select('fintrack_accounts!inner(plan_id)')
    .eq('user_id', auth.identity.id)
    .is('revoked_at', null)
  const planIds = [...new Set([
    ...(planId ? [planId] : []),
    ...(shared || []).map((row) => (row.fintrack_accounts as unknown as { plan_id: string }).plan_id),
  ])]
  if (!planIds.length) return NextResponse.json({ data: [] })
  const { data, error } = await supabaseAdmin.from('fintrack_categories').select('*').in('plan_id', planIds).order('name')
  if (error) return NextResponse.json({ error: 'Gagal mengambil kategori' }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
