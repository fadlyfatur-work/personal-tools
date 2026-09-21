import type { FintrackReport } from '@/types/fintrack'

const REPORT_CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { data: FintrackReport; expiresAt: number }>()

export function readFintrackReportCache(key: string) {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function writeFintrackReportCache(key: string, data: FintrackReport) {
  cache.set(key, { data, expiresAt: Date.now() + REPORT_CACHE_TTL_MS })
}

export function clearFintrackReportCache() {
  cache.clear()
}
