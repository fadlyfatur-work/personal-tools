import type { FintrackBootstrap } from '@/types/fintrack'

export const fintrackKeys = {
  bootstrap: ['fintrack', 'bootstrap'] as const,
}

export async function fetchFintrackBootstrap(): Promise<FintrackBootstrap> {
  const response = await fetch('/api/fintrack/bootstrap', { cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = new Error(body.error || 'FinTrack belum dapat dimuat') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return response.json()
}
