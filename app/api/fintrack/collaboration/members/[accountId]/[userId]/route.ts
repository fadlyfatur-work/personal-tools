import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAccountAccess, requireFintrackIdentity } from '@/lib/fintrackUser'
import { requireSensitivePin } from '@/lib/fintrackPin'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ accountId: string; userId: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const pinError = await requireSensitivePin(req, auth.identity.id)
  if (pinError) return pinError
  const { accountId, userId } = await params
  const access = await getAccountAccess(auth.identity.id, accountId)
  if (access?.role !== 'owner') return NextResponse.json({ error: 'Hanya owner yang dapat mencabut akses' }, { status: 403 })

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin.from('fintrack_account_collaborators').update({ revoked_at: now }).eq('account_id', accountId).eq('user_id', userId).is('revoked_at', null)
  if (error) return NextResponse.json({ error: 'Akses tidak dapat dicabut' }, { status: 500 })
  await supabaseAdmin.from('fintrack_account_activity_logs').insert({ account_id: accountId, actor_id: auth.identity.id, action: 'collaboration.revoked', entity_type: 'user', entity_id: userId })
  return NextResponse.json({ success: true })
}
