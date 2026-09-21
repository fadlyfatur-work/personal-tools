import { clearFintrackReportCache } from './fintrackReportCache'

export async function fintrackRequest(input: RequestInfo | URL, init?: RequestInit, timeoutMs: number | null = 15000) {
  if (!navigator.onLine) {
    window.dispatchEvent(new CustomEvent('fintrack:connection', { detail: 'offline' }))
    throw new Error('Tidak ada koneksi internet. Sambungkan perangkat lalu coba lagi.')
  }
  const controller = new AbortController()
  const timeout = timeoutMs === null ? null : window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal, cache: init?.cache || 'no-store' })
    window.dispatchEvent(new CustomEvent('fintrack:connection', { detail: 'online' }))
    if (response.ok && init?.method && init.method !== 'GET') clearFintrackReportCache()
    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      window.dispatchEvent(navigator.onLine ? new Event('fintrack:verify-connection') : new CustomEvent('fintrack:connection', { detail: 'offline' }))
      throw new Error('Server belum merespons. Coba kembali saat koneksi stabil.')
    }
    window.dispatchEvent(navigator.onLine ? new Event('fintrack:verify-connection') : new CustomEvent('fintrack:connection', { detail: 'offline' }))
    throw error
  } finally {
    if (timeout !== null) window.clearTimeout(timeout)
  }
}
