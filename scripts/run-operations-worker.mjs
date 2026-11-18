const origin = process.env.NEXT_PUBLIC_SITE_URL
const secret = process.env.TOOLS_WORKER_SECRET
if (!origin || !secret || secret.length < 32) throw new Error('Set NEXT_PUBLIC_SITE_URL and TOOLS_WORKER_SECRET (minimum 32 characters).')
const url = new URL('/api/monitoring/worker', origin)
if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid site origin.')
const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55000) })
if (!response.ok) throw new Error(`Operations worker returned HTTP ${response.status}.`)
console.log(await response.json())
