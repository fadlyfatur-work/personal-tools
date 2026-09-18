import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const planId = await getOwnedPlanId(auth.identity.id)
  const { count: sharedWallets } = await supabaseAdmin
    .from('fintrack_account_collaborators')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', auth.identity.id)
    .is('revoked_at', null)
  const { data: security } = await supabaseAdmin.from('fintrack_users').select('pin_hash').eq('id', auth.identity.id).maybeSingle()

  return NextResponse.json({
    user: { id: auth.identity.id, name: auth.identity.name, email: auth.identity.email },
    personal_plan_id: planId || null,
    shared_wallets: sharedWallets || 0,
    has_pin: Boolean(security?.pin_hash),
  })
}
