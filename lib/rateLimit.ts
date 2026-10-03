// Best-effort fixed-window rate limiter.
// State lives per server instance (in-memory), so it is not a global limiter on
// serverless/multi-instance deployments. It still blocks cheap abuse from a single
// client and should be backed by a shared store if stronger limits are needed.

type Window = { count: number; resetAt: number }

const windows = new Map<string, Window>()
const MAX_TRACKED_KEYS = 5000

export function clientKey(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const first = forwarded.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()

  if (windows.size > MAX_TRACKED_KEYS) {
    for (const [trackedKey, window] of windows) {
      if (window.resetAt <= now) windows.delete(trackedKey)
    }
  }

  const current = windows.get(key)
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (current.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }

  current.count += 1
  return { ok: true, retryAfter: 0 }
}
