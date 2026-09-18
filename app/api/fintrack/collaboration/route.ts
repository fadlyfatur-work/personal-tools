import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const planId = await getOwnedPlanId(auth.identity.id)

  const { data: ownedAccounts } = planId
    ? await supabaseAdmin.from('fintrack_accounts').select('id, name, kind, current_balance').eq('plan_id', planId).eq('archived', false).order('created_at')
    : { data: [] }
  const accountIds = (ownedAccounts || []).map((account) => account.id)
  const { data: requests } = accountIds.length
    ? await supabaseAdmin.from('fintrack_account_join_requests').select('id, account_id, requester_id, status, requested_at').in('account_id', accountIds).eq('status', 'pending').order('requested_at')
    : { data: [] }
  const requesterIds = [...new Set((requests || []).map((request) => request.requester_id))]
  const { data: requesters } = requesterIds.length
    ? await supabaseAdmin.from('fintrack_users').select('id, name, email').in('id', requesterIds)
    : { data: [] }
  const requesterMap = new Map((requesters || []).map((user) => [user.id, user]))
  const accountMap = new Map((ownedAccounts || []).map((account) => [account.id, account]))

  const { data: memberships } = await supabaseAdmin
    .from('fintrack_account_collaborators')
    .select('account_id, role, can_manage, accepted_at, fintrack_accounts!inner(id, name, kind, current_balance)')
    .eq('user_id', auth.identity.id)
    .is('revoked_at', null)
  const { data: ownedCollaborations } = accountIds.length
    ? await supabaseAdmin.from('fintrack_account_collaborators').select('account_id, user_id, role, can_manage, accepted_at').in('account_id', accountIds).is('revoked_at', null)
    : { data: [] }
  const collaboratorIds = [...new Set((ownedCollaborations || []).map((item) => item.user_id))]
  const { data: collaborators } = collaboratorIds.length
    ? await supabaseAdmin.from('fintrack_users').select('id, name, email').in('id', collaboratorIds)
    : { data: [] }
  const collaboratorMap = new Map((collaborators || []).map((person) => [person.id, person]))

  return NextResponse.json({
    owned_accounts: ownedAccounts || [],
    pending_requests: (requests || []).map((request) => ({
      ...request,
      requester: requesterMap.get(request.requester_id) || null,
      account: accountMap.get(request.account_id) || null,
    })),
    shared_with_me: memberships || [],
    collaborators: (ownedCollaborations || []).map((item) => ({
      ...item,
      user: collaboratorMap.get(item.user_id) || null,
      account: accountMap.get(item.account_id) || null,
    })),
  })
}
