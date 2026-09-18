import { NextResponse } from 'next/server'
import { getSupabaseServer } from './supabaseServer'
import { supabaseAdmin } from './supabaseAdmin'

export interface FintrackIdentity {
  id: string
  authUserId: string
  email: string
  name: string
}

export async function bootstrapFintrackUser(authUserId: string, email: string, name: string) {
  const { data, error } = await supabaseAdmin.rpc('fintrack_bootstrap_user', {
    p_auth_user_id: authUserId,
    p_email: email,
    p_name: name,
  })
  if (error) throw new Error(`Gagal menyiapkan profil FinTrack: ${error.message}`)
  return data as string
}

export async function getFintrackIdentity(): Promise<FintrackIdentity | null> {
  const auth = await getSupabaseServer()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user?.email) return null

  const { data: profile } = await supabaseAdmin
    .from('fintrack_users')
    .select('id, name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return null
  return { id: profile.id, authUserId: user.id, email: profile.email, name: profile.name }
}

export async function requireFintrackIdentity() {
  const identity = await getFintrackIdentity()
  if (!identity) {
    return {
      identity: null,
      response: NextResponse.json({ error: 'Sesi tidak valid. Silakan masuk kembali.' }, { status: 401 }),
    }
  }
  return { identity, response: null }
}

export async function getOwnedPlanId(userId: string) {
  const { data } = await supabaseAdmin
    .from('fintrack_plans')
    .select('id')
    .eq('owner_id', userId)
    .is('archived_at', null)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  return data?.id as string | undefined
}

export async function getAccountAccess(userId: string, accountId: string) {
  const { data: account } = await supabaseAdmin
    .from('fintrack_accounts')
    .select('id, plan_id, name, fintrack_plans!inner(owner_id)')
    .eq('id', accountId)
    .eq('archived', false)
    .maybeSingle()

  if (!account) return null
  const plan = account.fintrack_plans as unknown as { owner_id: string }
  if (plan.owner_id === userId) return { account, role: 'owner' as const, canManage: true }

  const { data: collaborator } = await supabaseAdmin
    .from('fintrack_account_collaborators')
    .select('role, can_manage')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .is('revoked_at', null)
    .maybeSingle()

  if (!collaborator) return null
  return { account, role: collaborator.role as 'member' | 'viewer', canManage: collaborator.can_manage as boolean }
}
