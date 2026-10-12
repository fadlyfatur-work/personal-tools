import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import ts from 'typescript'
import { z } from 'zod'

const load = (file, imports = {}) => {
  const exports = {}
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(compiled, { exports, require(name) { if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name] }, Response, URL, URLSearchParams, console, crypto: webcrypto })
  return exports
}
const core = load('lib/ahsp.ts')
const { calculateAhsp, parseAhspNumber } = core
const item = {
  analysis_status: 'extracted', output_quantity: 1, overhead_min: 10, overhead_max: 15,
  components: [
    { id: 'labor', group: 'tenaga', name: 'Pekerja', coefficient: .02 },
    { id: 'material', group: 'bahan', name: 'Terpal', coefficient: 1.02 },
  ],
}
const input = { volume: 20, overhead: 10, prices: { labor: 150000, material: 5000 }, coefficients: {} }
let r = calculateAhsp(item, input)
assert.equal(r.direct, 8100)
assert.equal(r.unitPrice, 8910)
assert.equal(r.total, 178200)
assert.equal(calculateAhsp({ ...item, output_quantity: 10 }, input).total, 17820, 'Respect a multi-unit source analysis basis')
assert.equal(calculateAhsp(item, { ...input, prices: { labor: 0, material: 0 } }).total, 0, 'An explicitly entered zero is valid')
assert.equal(calculateAhsp(item, { ...input, prices: { labor: 150000 } }).total, null, 'Missing prices cannot silently become zero')
assert.equal(calculateAhsp(item, { ...input, overhead: 9 }).total, null, 'Use the actual source overhead range')
assert.equal(calculateAhsp(item, { ...input, volume: 0 }).total, null)
assert.equal(calculateAhsp({ ...item, analysis_status: 'needs_review' }, input).total, null, 'Unreviewed analysis does not yield an apparently complete estimate')
const dynamic = { ...item, components: [{ id: 'a', group: 'alat', name: 'Excavator', coefficient: null, expression: '1 / Q' }] }
assert.equal(calculateAhsp(dynamic, { ...input, prices: { a: 1000 }, coefficients: {} }).total, null)
assert.equal(calculateAhsp(dynamic, { ...input, prices: { a: 1000 }, coefficients: { a: .5 } }).total, 11000)
assert.equal(parseAhspNumber('125000,50'), 125000.5)
assert.equal(parseAhspNumber('0'), 0)
for (const n of ['', '1.000,5', '-2', 'Infinity', '1e5', '1,2,3']) assert.equal(parseAhspNumber(n), null)

const smkk = { ...item, overhead_min: 0, overhead_max: 0, components: [{ id: 'smkk', group: 'smkk', name: 'Helm', coefficient: 1 }] }
assert.equal(calculateAhsp(smkk, { volume: 5, overhead: 0, prices: { smkk: 50000 }, coefficients: {} }).total, 250000, 'SMKK is quantity multiplied by a project-specific unit cost')
assert.equal(calculateAhsp(smkk, { volume: 5, overhead: 10, prices: { smkk: 50000 }, coefficients: {} }).total, null, 'SMKK does not add work-item overhead')

let calls = []
let failure = null
let result = { data: [], count: 0, error: null }
const query = new Proxy({}, { get: (_, prop) => {
  if (prop === 'then') return resolve => resolve(failure ? { error: failure } : result)
  return (...args) => { calls.push([prop, ...args]); return query }
} })
const route = load('app/api/ahsp/route.ts', {
  zod: { z }, '@/lib/ahsp': core,
  '@/lib/supabaseAdmin': { getSupabaseAdmin: () => ({ from: table => { calls.push(['from', table]); return query }, rpc: async (name, args) => { calls.push(['rpc', name, args]); return { data: name === 'ahsp_search_items' ? { items: [], total: 0, pageSize: 30 } : {}, error: failure } } }) },
})
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?page=-1'))).status, 400)
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?id=invalid'))).status, 400)
assert.equal(calls.length, 0, 'Invalid filters do not reach PostgreSQL')
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?q=galian'))).status, 200)
assert.ok(calls.some(c => c[0] === 'rpc' && c[1] === 'ahsp_search_items' && c[2].p_terms[0] === 'galian'))
await route.GET(new Request('http://localhost/api/ahsp'))
assert.ok(calls.some(c => c[0] === 'rpc' && c[1] === 'ahsp_search_items' && c[2].p_terms.length === 0), 'Unfiltered lists use the same PostgreSQL result and summary calculation')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?mode=multiple&q=x%2Cy%29%25'))
assert.deepEqual(Array.from(calls.find(c => c[0] === 'rpc')[2].p_terms), ['x', 'y)%'], 'Search terms are RPC parameters; punctuation is never interpreted as SQL or a filter expression')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?q=2.2.1.9.2&scope=components&analysis=extracted'))
const searchCall = calls.find(c => c[0] === 'rpc')
assert.equal(searchCall[2].p_terms[0], '2.2.1.9.2')
assert.equal(searchCall[2].p_scope, 'components')
assert.equal(searchCall[2].p_analysis, 'extracted')
assert.equal(searchCall[2].p_match, 'like')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?q=Rambu%20Petunjuk&match=exact'))
assert.equal(calls.find(c => c[0] === 'rpc')[2].p_match, 'exact')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?q=Beton%202%2C5%20mm'))
assert.deepEqual(Array.from(calls.find(c => c[0] === 'rpc')[2].p_terms), ['Beton 2,5 mm'], 'Single search never splits a job name on commas')
assert.equal((await route.GET(new Request(`http://localhost/api/ahsp?mode=multiple&q=${encodeURIComponent(Array.from({ length: 51 }, (_, i) => `term${i}`).join('\n'))}`))).status, 400)
const searchExample = 'Petugas pengatur lalu lintas,\\\nPeralatan P3K,\\\nRambu petunjuk,\\\nRambu peringatan,\\\nRambu informasi,\\\nKerucut lalu lintas (traffic cone),\\\nTongkat pengatur lalu lintas (Warning Lights Stick),\\\nLampu/alat penerangan sementara,'
assert.equal(core.parseAhspSearch(searchExample).length, 8)
assert.deepEqual(Array.from(core.parseAhspSearch('Pekerja; PEKERJA\nBesi diameter 2,5 mm; Alat (kecil, sedang)')), ['Pekerja', 'Besi diameter 2,5 mm', 'Alat (kecil, sedang)'])
failure = { message: 'private credential or database error' }
const unavailable = await route.GET(new Request('http://localhost/api/ahsp'))
assert.equal(unavailable.status, 503)
assert.ok(!(await unavailable.text()).includes('private credential'), 'Database details are not returned to visitors')
for (const [databaseError, expected] of [
  [{ code: '57014', message: 'canceling statement due to statement timeout' }, 'SEARCH_TIMEOUT'],
  [{ code: 'PGRST202', message: 'private database function detail' }, 'SEARCH_FUNCTION_UNAVAILABLE'],
  [{ message: 'TypeError: fetch failed' }, 'DATABASE_CONNECTION_FAILED'],
]) {
  failure = databaseError
  const response = await route.GET(new Request('http://localhost/api/ahsp?q=Rambu'))
  assert.equal(response.status, 503)
  const body = await response.json()
  assert.equal(body.code, expected)
  assert.match(body.reference, /^[a-f0-9-]{36}$/)
  assert.ok(!JSON.stringify(body).includes(databaseError.message), 'Public diagnostics exclude raw database messages')
}
failure = null; result = { data: null, error: null }
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?id=11111111-1111-4111-8111-111111111111'))).status, 404)
console.log('AHSP: source basis, totals, missing/zero inputs, dynamic coefficients, filters, and API error handling passed.')
