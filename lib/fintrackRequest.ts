export async function fintrackRequest(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 5000) {
  if (!navigator.onLine) {
    window.dispatchEvent(new CustomEvent('fintrack:connection', { detail: 'offline' }))
    throw new Error('Tidak ada koneksi internet. Sambungkan perangkat lalu coba lagi.')
  }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal, cache: init?.cache || 'no-store' })
    window.dispatchEvent(new CustomEvent('fintrack:connection', { detail: 'online' }))
    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      window.dispatchEvent(navigator.onLine ? new Event('fintrack:verify-connection') : new CustomEvent('fintrack:connection', { detail: 'offline' }))
      throw new Error(`Permintaan melewati batas ${Math.ceil(timeoutMs / 1000)} detik. Silakan coba kembali.`)
    }
    window.dispatchEvent(navigator.onLine ? new Event('fintrack:verify-connection') : new CustomEvent('fintrack:connection', { detail: 'offline' }))
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
