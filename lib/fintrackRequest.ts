export async function fintrackRequest(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 5000) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Permintaan melewati batas 5 detik. Data akan diperiksa ulang.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
