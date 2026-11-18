import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import type { TLSSocket } from 'node:tls'
import { monitorTarget, publicAddress } from './domain'

type Address = { address: string; family: number }
type Probe = { status: number; location?: string; tlsValid?: boolean; tlsExpiresAt?: string | null }
type Dependencies = { resolve: (host: string) => Promise<Address[]>; request: (url: URL, address: Address, timeout: number) => Promise<Probe> }
export type CheckResult = { outcome: 'healthy' | 'failed' | 'blocked'; http_status: number | null; response_ms: number; tls_expires_at: string | null; tls_valid: boolean | null; error_code: string | null }

export async function requestHeaders(url: URL, address: Address, timeout: number): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http
    const req = transport.request(url, {
      method: 'GET', agent: false, maxHeaderSize: 16384, family: address.family,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      // Inspect the actual peer even for an expired certificate; unauthorized TLS is always a failed check.
      rejectUnauthorized: false, headers: { 'User-Agent': 'PersonalTools-Monitor/1.0', Accept: '*/*' },
    }, response => {
      const socket = response.socket as TLSSocket
      const cert = url.protocol === 'https:' ? socket.getPeerCertificate() : null
      const expiry = cert?.valid_to ? new Date(cert.valid_to) : null
      resolve({ status: response.statusCode || 0, location: response.headers.location, tlsValid: url.protocol === 'https:' ? socket.authorized : undefined, tlsExpiresAt: expiry && Number.isFinite(expiry.getTime()) ? expiry.toISOString() : null })
      response.destroy()
    })
    const timer = setTimeout(() => req.destroy(new Error('TIMEOUT')), timeout)
    req.once('close', () => clearTimeout(timer))
    req.once('error', reject)
    req.end()
  })
}

export async function checkTarget(monitor: { url: string; timeout_ms: number; expected_statuses: number[] }, dependencies?: Partial<Dependencies>): Promise<CheckResult> {
  const start = Date.now(), deadline = start + monitor.timeout_ms
  const deps: Dependencies = { resolve: host => lookup(host, { all: true, verbatim: true }), request: requestHeaders, ...dependencies }
  let status: number | null = null, tlsExpires: string | null = null, tlsValid: boolean | null = null
  const result = (outcome: CheckResult['outcome'], error: string | null): CheckResult => ({ outcome, error_code: error, http_status: status, response_ms: Date.now() - start, tls_expires_at: tlsExpires, tls_valid: tlsValid })
  try {
    let url: URL
    try { url = monitorTarget(monitor.url) } catch { return result('blocked', 'TARGET_BLOCKED') }
    for (let redirects = 0; redirects <= 3; redirects++) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) return result('failed', 'TIMEOUT')
      const addresses = await Promise.race([deps.resolve(url.hostname.replace(/^\[|\]$/g, '')), new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('TIMEOUT')), remaining); timer.unref?.() })])
      if (!addresses.length || addresses.some(a => !publicAddress(a.address))) return result('blocked', 'DNS_BLOCKED')
      const probe = await deps.request(url, addresses[0], Math.max(1, deadline - Date.now()))
      status = probe.status
      if (url.protocol === 'https:') {
        tlsExpires = probe.tlsExpiresAt || null; tlsValid = probe.tlsValid === true
        if (!tlsValid || !tlsExpires || Date.parse(tlsExpires) <= Date.now()) return result('failed', 'TLS_INVALID')
      }
      if (probe.location && [301, 302, 303, 307, 308].includes(status)) {
        try { url = monitorTarget(new URL(probe.location, url).href) } catch { return result('blocked', 'REDIRECT_BLOCKED') }
        continue
      }
      return result(monitor.expected_statuses.includes(status) ? 'healthy' : 'failed', monitor.expected_statuses.includes(status) ? null : 'HTTP_STATUS')
    }
    return result('failed', 'REDIRECT_LIMIT')
  } catch { return result('failed', Date.now() >= deadline ? 'TIMEOUT' : 'CONNECTION_FAILED') }
}
