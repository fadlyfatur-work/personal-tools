const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(path, globals) {
  const scope = { exports: {}, ...globals }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, scope)
  return scope.exports
}
let stored = '[]'
const cache = load('app/timemark/location-cache.ts', { localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value } } })
cache.cacheLocations('  Duren   Tiga ', ['Duren Tiga, Jakarta'])
assert.equal(cache.cachedLocations('duren tiga')[0], 'Duren Tiga, Jakarta')
cache.cacheLocations('kosong', [])
assert.equal(cache.cachedLocations('kosong').length, 0)
assert.equal(cache.cachedLocations('belum dicari'), undefined)
stored = JSON.stringify([{ query: 'lama', results: ['Alamat'], expires: 1 }])
assert.equal(cache.cachedLocations('lama'), undefined)
for (let i = 0; i < 205; i++) cache.cacheLocations(`query ${i}`, ['Alamat'])
assert.equal(JSON.parse(stored).length, 200)
stored = 'broken'
assert.equal(cache.cachedLocations('broken'), undefined)

async function main() {
  const env = {}
  let calls = 0
  let mode = 'ok'
  const route = load('app/api/timemark/locations/route.ts', { URL, URLSearchParams, Response, AbortSignal, process: { env }, fetch: async url => {
    calls++
    assert.equal(url.searchParams.get('filter'), 'countrycode:id')
    assert.equal(url.searchParams.get('limit'), '5')
    if (mode === 'error') return new Response('', { status: 429 })
    if (mode === 'empty') return Response.json({ results: [] })
    return Response.json({ results: [{ country_code: 'sg', formatted: 'Singapore' }, ...Array.from({ length: 8 }, (_, i) => ({ country_code: 'id', formatted: `Alamat ${i}` }))] })
  } })
  const request = q => new Request(`http://localhost/api/timemark/locations?q=${encodeURIComponent(q)}`)
  assert.equal((await route.GET(request('abcd'))).status, 400)
  assert.equal(calls, 0)
  assert.equal((await route.GET(request('jakarta'))).status, 503)
  env.GEOAPIFY_API_KEY = 'test-only-key'
  const result = await (await route.GET(request('jakarta'))).json()
  assert.equal(result.results.length, 5)
  assert.ok(!result.results.includes('Singapore'))
  mode = 'empty'
  assert.equal((await (await route.GET(request('jakarta'))).json()).results.length, 0)
  mode = 'error'
  assert.equal((await route.GET(request('jakarta'))).status, 429)
  console.log('Location tests passed: query threshold, Indonesia filter, five results, missing key, provider errors, normalized cache, expiry, and capacity.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
