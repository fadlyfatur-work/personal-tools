import type { Goal } from '@/types/fintrack'

export function goalProgress(goal: Pick<Goal, 'current_balance' | 'spent' | 'target_amount'>) {
  const funded = Math.max(0, Number(goal.current_balance) + Number(goal.spent))
  const target = Number(goal.target_amount)
  return { funded, remaining: Math.max(0, target - funded), percentage: target > 0 ? Math.min(100, Math.floor(funded / target * 100)) : 0 }
}
