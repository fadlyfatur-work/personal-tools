import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import http from 'node:http'
const require = createRequire(import.meta.url)
function load(file, overrides = {}) {
  const compiled = { exports: {} }
  const localRequire = name => Object.hasOwn(overrides, name) ? overrides[name] : name.startsWith('.') ? load(path.join(path.dirname(file), name + '.ts'), overrides) : require(name)
  vm.runInNewContext(ts.transpileModule(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { module: compiled, exports: compiled.exports, require: localRequire, URL, Date, Buffer, Request, Response, setTimeout, clearTimeout, process })
  return compiled.exports
}
async function main() {
  const d = load('lib/operations/domain.ts')
  assert.equal(typeof d.publicAddress, 'function', 'public network boundary must exist')
  for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '172.16.1.1', '192.168.0.1', '100.64.0.1', '0.0.0.0', '224.1.1.1', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fc00::1', '2001:db8::1', '2002:7f00:1::', '2001:0000:0:0:0:0:7f00:1', '2001:2::1']) assert.equal(d.publicAddress(ip), false, ip)
  assert.equal(d.publicAddress('8.8.8.8'), true)
  assert.equal(d.publicAddress('2606:4700:4700::1111'), true)
  for (const url of ['file:///etc/passwd', 'https://user:pass@example.com', 'http://localhost', 'http://2130706433', 'http://134744072', 'http://0x08080808', 'http://[::1]', 'https://example.com:444', 'https://example.com/?token=secret']) assert.throws(() => d.monitorTarget(url))
  assert.equal(d.monitorTarget('https://example.com/health').hostname, 'example.com')
  const now = Date.parse('2026-10-26T12:00:00Z')
  const monitor = { active: true, maintenance: false, interval_seconds: 300, timeout_ms: 10000, last_checked_at: new Date(now - 611000).toISOString(), state: 'healthy' }
  assert.equal(d.monitorState(monitor, now), 'stale')
  assert.equal(d.monitorState({ ...monitor, maintenance: true }, now), 'maintenance')
  assert.equal(d.monitorState({ ...monitor, active: false }, now), 'paused')
  assert.equal(d.monitorState({ ...monitor, last_checked_at: null }, now), 'unknown')
  const stats = d.coverage([{ scheduled_at: new Date(now - 600000).toISOString(), outcome: 'healthy', duration_seconds: 300 }, { scheduled_at: new Date(now - 300000).toISOString(), outcome: 'failed', duration_seconds: 300 }], now - 900000, now, 300)
  assert.equal(stats.uptime, 50)
  assert.equal(stats.coverage, 66.67)
  assert.equal(stats.unknownSeconds, 300)
  assert.equal(d.coverage([], now - 900000, now, 300).uptime, null)
  const overlapping = d.coverage([{ scheduled_at: new Date(now - 600000).toISOString(), outcome: 'healthy', duration_seconds: 600 }, { scheduled_at: new Date(now - 300000).toISOString(), outcome: 'failed', duration_seconds: 300 }], now - 600000, now, 300)
  assert.equal(overlapping.coverage, 100)
  assert.equal(overlapping.uptime, 50)
  const changedInterval = d.coverage([{ scheduled_at: new Date(now - 600000).toISOString(), outcome: 'healthy', duration_seconds: 600 }], now - 600000, now, 300)
  assert.equal(changedInterval.coverage, 100, 'historic slot keeps its saved duration after interval changes')
  const network = load('lib/operations/network.ts')
  const upstream = http.createServer((_request, response) => { response.writeHead(200); response.end('local deterministic probe') })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  try {
    const port = upstream.address().port
    const actualProbe = await network.requestHeaders(new URL(`http://adapter.example.test:${port}/health`), { address: '127.0.0.1', family: 4 }, 1000)
    assert.equal(actualProbe.status, 200, 'real Node transport must connect to its pinned address')
  } finally { await new Promise(resolve => upstream.close(resolve)) }
  let connected = 0
  const resolve = async () => [{ address: '8.8.8.8', family: 4 }]
  const result = await network.checkTarget({ url: 'https://example.com/health', expected_statuses: [200], timeout_ms: 1000 }, { resolve, request: async (url, address) => { connected++; assert.equal(address.address, '8.8.8.8'); return { status: 200, tlsValid: true, tlsExpiresAt: '2027-01-01T00:00:00Z' } } })
  assert.equal(result.outcome, 'healthy')
  assert.equal(result.tls_expires_at, '2027-01-01T00:00:00Z')
  const blocked = await network.checkTarget({ url: 'https://example.com', expected_statuses: [200], timeout_ms: 1000 }, { resolve: async () => [{ address: '127.0.0.1', family: 4 }], request: async () => { throw new Error('must never connect') } })
  assert.equal(blocked.outcome, 'blocked')
  const redirected = await network.checkTarget({ url: 'https://example.com', expected_statuses: [200], timeout_ms: 1000 }, { resolve, request: async () => ({ status: 302, location: 'http://169.254.169.254/latest', tlsValid: true, tlsExpiresAt: '2027-01-01T00:00:00Z' }) })
  assert.equal(redirected.outcome, 'blocked')
  const expired = await network.checkTarget({ url: 'https://example.com', expected_statuses: [200], timeout_ms: 1000 }, { resolve, request: async () => ({ status: 200, tlsValid: false, tlsExpiresAt: '2020-01-01T00:00:00Z' }) })
  assert.equal(expired.outcome, 'failed')
  assert.equal(connected, 1)
  const workerCalls = []
  const worker = load('app/api/monitoring/worker/route.ts', {
    '@/lib/supabaseAdmin': { supabaseAdmin: { rpc: async name => { workerCalls.push(name); return { data: name === 'operations_claim_checks' ? [] : 0, error: null } } } },
    '@/lib/operations/network': network,
  })
  const originalSecret = process.env.TOOLS_WORKER_SECRET
  process.env.TOOLS_WORKER_SECRET = 's'.repeat(40)
  try {
    assert.equal((await worker.POST(new Request('http://localhost/api/monitoring/worker', { method: 'POST' }))).status, 401)
    assert.equal(workerCalls.length, 0)
    const unicode = new Request('http://localhost/api/monitoring/worker', { method: 'POST', headers: { authorization: 'Bearer ' + 'é'.repeat(40) } })
    assert.equal((await worker.POST(unicode)).status, 401)
    assert.equal((await worker.POST(new Request('http://localhost/api/monitoring/worker', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.TOOLS_WORKER_SECRET } }))).status, 200)
    assert.ok(workerCalls.includes('office_process_reminders'), 'an empty monitor queue must still process Office reminders')
  } finally { if (originalSecret === undefined) delete process.env.TOOLS_WORKER_SECRET; else process.env.TOOLS_WORKER_SECRET = originalSecret }
  class ToolsError extends Error { constructor(status, message) { super(message); this.status = status } }
  const workspace = '11111111-1111-4111-8111-111111111111', user = '22222222-2222-4222-8222-222222222222'
  const service = '33333333-3333-4333-8333-333333333333', environment = '44444444-4444-4444-8444-444444444444'
  let role = 'member', pairExists = true
  const queries = []
  const db = { from(table) {
    const query = { table, filters: [], value: null, op: 'select' }; queries.push(query)
    const chain = { select() { return chain }, eq(key, value) { query.filters.push([key,value]); return chain }, order() { return chain }, limit() { return chain }, insert(value) { query.value = value; query.op = 'insert'; return chain }, update(value) { query.value = value; query.op = 'update'; return chain }, maybeSingle() { return Promise.resolve({ data: table === 'tools_environments' && pairExists ? { id: environment } : null, error: null }) }, single() { return Promise.resolve({ data: { id: service }, error: null }) }, then(resolve) { return Promise.resolve({ data: [], count: 0, error: null }).then(resolve) } }
    return chain
  } }
  const apiHelpers = load('lib/operations/api.ts', { '@/lib/supabaseAdmin': { supabaseAdmin: db }, '@/lib/tools/server': { ToolsError, toolsJson: value => Response.json(value), getToolsContext: async (_request, options) => { if (options?.write && role === 'viewer') throw new ToolsError(403, 'Denied'); return { workspaceId: workspace, userId: user } } } })
  const post = value => new Request('http://localhost/api/operations', { method: 'POST', body: JSON.stringify(value) })
  const release = { service_id: service, environment_id: environment, version: '1.0', deployed_at: '2026-10-26T12:00:00Z', performer: 'Penguji', status: 'succeeded', changelog: '', configuration_notes: '', evidence_url: '', rollback_plan: '' }
  role = 'viewer'
  await assert.rejects(() => apiHelpers.deploymentWrite(post({ action: 'create', data: release })), err => err.status === 403)
  assert.equal(queries.length, 0, 'viewer denial must happen before querying records')
  role = 'member'; pairExists = false
  await assert.rejects(() => apiHelpers.deploymentWrite(post({ action: 'create', data: release })), err => err.status === 404)
  assert.ok(queries[0].filters.some(([key,value]) => key === 'workspace_id' && value === workspace))
  assert.equal(queries.some(q => q.op === 'insert'), false, 'foreign-workspace pair must never be written')
  pairExists = true; queries.length = 0
  assert.equal((await apiHelpers.deploymentWrite(post({ action: 'create', data: release }))).status, 200)
  assert.equal(queries.find(q => q.op === 'insert').value.workspace_id, workspace)
  assert.equal(queries.find(q => q.op === 'insert').value.created_by, user)
  await assert.rejects(() => apiHelpers.deploymentWrite(post({ action: 'create', data: { ...release, workspace_id: 'forged' } })), err => err.status === 400)
  await assert.rejects(() => apiHelpers.deploymentWrite(post({ action: 'update', id: service, revision: 1, data: release })), err => err.status === 409)
  const sql = fs.readFileSync('supabase/migrations/202610260004_operations.sql', 'utf8')
  assert.match(sql, /unique\s*\(monitor_id, scheduled_at\)/i)
  assert.match(sql, /for update skip locked/i)
  assert.match(sql, /scheduled_at > .*watermark/i)
  assert.match(sql, /unique\s*\(incident_id, kind, recipient_id\)/i)
  assert.match(sql, /revoke execute.*from public, anon, authenticated/is)
  const api = fs.readFileSync('lib/operations/api.ts', 'utf8')
  assert.ok(!/exec\(|spawn\(|execFile/.test(api), 'deployment actions only record data')
  assert.match(api, /getToolsContext/)
  assert.match(api, /workspace_id/)
  console.log('Operations checks passed: SSRF/DNS/redirect/TLS simulations, stale/paused/maintenance, sampled uptime coverage, lease/result/notification constraints, recording-only deployment boundary.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
