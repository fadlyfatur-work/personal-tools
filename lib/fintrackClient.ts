import type { FintrackBootstrap } from '@/types/fintrack'
import { fintrackRequest } from './fintrackRequest'

export const fintrackKeys = {
  bootstrap: ['fintrack', 'bootstrap'] as const,
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
