import assert from 'node:assert/strict'

export async function documentsLiveSession() {
  try { process.loadEnvFile('.env.local') } catch (error) { if (error.code !== 'ENOENT') throw error }
  const base = process.env.DOCUMENTS_TEST_URL || 'http://localhost:3000'
  const pin = process.env.DOCUMENTS_TEST_PIN
  assert.ok(pin, 'Set DOCUMENTS_TEST_PIN to an existing test collection PIN. No PIN or admin is created by this script.')
  const headers = { 'Content-Type': 'application/json', Origin: new URL(base).origin }
  const access = await fetch(`${base}/api/documents/access`, { method: 'POST', headers, body: JSON.stringify({ pin }) })
  assert.equal(access.status, 200, 'The test collection could not be unlocked. Check its PIN and suite setup.')
  const cookies = access.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
  assert.ok(cookies.includes('documents_tag_access='), 'The protected Documents session cookie is missing.')
  const request = (path, init = {}) => fetch(`${base}${path}`, { ...init, headers: { ...headers, Cookie: cookies, ...init.headers } })
  const data = async path => {
    const response = await request(path)
    assert.equal(response.status, 200, `Protected Documents read failed: ${path}`)
    return (await response.json()).data
  }
  return { base, request, data }
}
