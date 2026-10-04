import { supabaseAdmin } from './supabaseAdmin'
import { getAccountAccess } from './fintrackUser'

export async function getOwnedGoal(userId: string, goalId: string) {
  const { data: goal } = await supabaseAdmin.from('fintrack_goals').select('*').eq('id', goalId).maybeSingle()
  if (!goal) return null
  const access = await getAccountAccess(userId, goal.account_id)
  return access?.role === 'owner' ? goal : null
}
