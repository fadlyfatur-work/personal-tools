import { queryOptions } from '@tanstack/react-query'
import type { FintrackBootstrap, FintrackReport, Goal } from '@/types/fintrack'
import { fintrackRequest } from './fintrackRequest'

export const fintrackKeys = {
  bootstrap: ['fintrack', 'bootstrap'] as const,
}

export function fintrackActivityOptions(userId: string | undefined, queryString: string) {
  return queryOptions({
    queryKey: ['fintrack', 'activity', userId, queryString],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FintrackReport> => {
      const response = await fintrackRequest(`/api/fintrack/reports?${queryString}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Aktivitas belum bisa dimuat. Coba lagi.')
      return body.data
    },
  })
}

export function fintrackGoalsOptions() {
  return queryOptions({
    queryKey: ['fintrack', 'goals'],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    queryFn: async (): Promise<Goal[]> => {
      const response = await fintrackRequest('/api/fintrack/goals')
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Tujuan gagal dimuat')
      return body.data
    },
  })
}

export async function fetchFintrackBootstrap(): Promise<FintrackBootstrap> {
  const response = await fintrackRequest('/api/fintrack/bootstrap', { cache: 'no-store' }, null)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = new Error(body.error || 'FinTrack belum dapat dimuat') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return response.json()
}
