import { isIP } from 'node:net'

export function publicAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2)) || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0))
  }
  if (isIP(ip) === 6) {
    const [first, second] = ip.split(':').map(part => parseInt(part || '0',16))
    return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff && !(first === 0x2001 && (second < 0x200 || second === 0xdb8))
  }
  return false
}

export function monitorTarget(value: string): URL {
  const url = new URL(value)
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1] || ''
  const sourceHost = authority.startsWith('[') ? authority.slice(1, authority.indexOf(']')) : authority.split(':')[0]
  if (isIP(hostname) === 4 && sourceHost !== hostname) throw new Error('Gunakan bentuk alamat IPv4 standar.')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.port || hostname === 'localhost' || !hostname.includes('.') && !isIP(hostname) || /\.(localhost|local|internal|test|invalid)$/.test(hostname) || isIP(hostname) && !publicAddress(hostname)) throw new Error('Target harus HTTP/HTTPS publik pada port standar, tanpa kredensial, query, atau fragmen.')
  return url
}

export type MonitorCondition = { active: boolean; maintenance: boolean; interval_seconds: number; timeout_ms: number; last_checked_at: string | null; state: string }
export function monitorState(m: MonitorCondition, now = Date.now()): string {
  if (!m.active) return 'paused'
  if (m.maintenance) return 'maintenance'
  if (!m.last_checked_at) return 'unknown'
  return now - Date.parse(m.last_checked_at) > m.interval_seconds * 2000 + m.timeout_ms ? 'stale' : m.state
}

export type Sample = { scheduled_at: string; outcome: string; duration_seconds: number }
export function coverage(samples: Sample[], from: number, to: number, interval: number) {
  let healthy = 0, failed = 0, excluded = 0
  const rows = Array.from(new Map(samples.map(row => [row.scheduled_at,row])).values()).sort((a,b) => Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at))
  for (const [index, row] of rows.entries()) {
    const start = Date.parse(row.scheduled_at)
    const duration = row.duration_seconds > 0 ? row.duration_seconds : interval
    const next = rows[index+1] ? Date.parse(rows[index+1].scheduled_at) : to
    const seconds = Math.max(0, Math.min(to, next, start + duration * 1000) - Math.max(from, start)) / 1000
    if (row.outcome === 'healthy') healthy += seconds
    else if (row.outcome === 'failed' || row.outcome === 'blocked') failed += seconds
    else if (row.outcome === 'maintenance' || row.outcome === 'paused') excluded += seconds
  }
  const total = Math.max(0, (to - from) / 1000 - excluded), known = healthy + failed
  const rounded = (x: number) => Math.round(x * 100) / 100
  return { uptime: known ? rounded(healthy / known * 100) : null, coverage: total ? rounded(known / total * 100) : 0, unknownSeconds: Math.max(0, total - known), excludedSeconds: excluded }
}
