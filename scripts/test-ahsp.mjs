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
const copied = core.formatAhspItemCopy({ code: '1.22.(7a)', name: 'Rambu\tPetunjuk\nsementara', field: 'SMKK', division: 'Komponen 7', unit: 'Buah', ahsp_type: 'Informatif', regulation: 'SE 47/2026', page_from: 43, page_to: 44 }, 'Lampiran V')
assert.deepEqual(copied.split('\t'), ['1.22.(7a)', 'Rambu Petunjuk sementara', 'SMKK', 'Komponen 7', 'Buah', 'Informatif', 'SE 47/2026', 'Lampiran V', '43-44'], 'A copied work item is one spreadsheet row with nine columns; embedded tabs/newlines cannot add cells or rows')
assert.ok(!copied.includes('\n'))
const item = {
  analysis_status: 'extracted', output_quantity: 1, overhead_min: 10, overhead_max: 15,
  components: [
    { id: 'labor', group: 'tenaga', name: 'Pekerja', coefficient: .02 },
    { id: 'material', group: 'bahan', name: 'Terpal', coefficient: 1.02 },
  ],
}
const input = { volume: 20, overhead: 10, prices: { labor: 150000, material: 5000 }, coefficients: {} }
const referenceOrigin = { ...item, id: 'origin', code: '1.1.1.3', name: 'Pagar kawat duri', regulation: 'SE 47/2026', unit: 'm', source_id: '10904', page_from: 159, page_to: 159 }
const referenceTarget = { ...referenceOrigin, id: 'target', code: 'U.1.1.3 (c)', regulation: 'PERMEN 08/2023', source_id: 'permen08-2023', page_from: 141, page_to: 141 }
const referenced = { ...referenceOrigin, analysis_target_id: 'target', analysis_reference: {
  status: 'verified', target_item_id: 'target', target_code: referenceTarget.code, target_regulation: referenceTarget.regulation,
  source_fingerprint: core.ahspAnalysisFingerprint(referenceOrigin), target_fingerprint: core.ahspAnalysisFingerprint(referenceTarget),
} }
assert.equal(core.canUseAhspReference(referenced, referenceTarget), true)
assert.equal(core.canUseAhspReference({ ...referenced, analysis_reference: { ...referenced.analysis_reference, status: 'review' } }, referenceTarget), false)
assert.equal(core.canUseAhspReference(referenced, null), false)
assert.equal(core.canUseAhspReference(referenced, { ...referenceTarget, components: [...referenceTarget.components, { id: 'extra', name: 'Seng', group: 'bahan', coefficient: 1 }] }), false, 'Changed analysis invalidates the previous verification')
assert.equal(core.canUseAhspReference({ ...referenced, name: 'Pagar seng' }, referenceTarget), false, 'A changed source item also invalidates verification')
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
let phraseSupport = true
let archiveSupport = true
let groupSupport = true
let result = { data: [], count: 0, error: null }
const query = new Proxy({}, { get: (_, prop) => {
  if (prop === 'then') return resolve => resolve(failure ? { error: failure } : result)
  return (...args) => { calls.push([prop, ...args]); return query }
} })
const route = load('app/api/ahsp/route.ts', {
  zod: { z }, '@/lib/ahsp': core,
  '@/lib/supabaseAdmin': { getSupabaseAdmin: () => ({ from: table => { calls.push(['from', table]); return query }, rpc: async (name, args) => { calls.push(['rpc', name, args]); return { data: name === 'ahsp_search_items' ? { items: [], total: 0, pageSize: 30, grouped_by_name: groupSupport, archive_supported: archiveSupport, search_stats: { match: phraseSupport ? args.p_match : undefined } } : { grouped_by_name: groupSupport, total: 5, version_total: 9, fields: ['Umum', 'SMKK'], field_counts: [{field:'Umum',count:3},{field:'SMKK',count:2}] }, error: failure } } }) },
})
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?page=-1'))).status, 400)
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?id=invalid'))).status, 400)
assert.equal(calls.length, 0, 'Invalid filters do not reach PostgreSQL')
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?q=galian'))).status, 200)
const countedOptions = await (await route.GET(new Request('http://localhost/api/ahsp?options=1'))).json()
assert.deepEqual(countedOptions.options.field_counts, [{ field: 'Umum', count: 3 }, { field: 'SMKK', count: 2 }], 'Field buttons use unique-name counts from the grouped SQL options')
assert.equal(countedOptions.options.total, 5)
assert.equal(countedOptions.options.version_total, 9)
assert.ok(!calls.some(call => call[0] === 'select' && call[2]?.head === true), 'Grouped counts are not replaced by raw version counts')
assert.ok(calls.some(c => c[0] === 'rpc' && c[1] === 'ahsp_search_items' && c[2].p_terms[0] === 'galian'))
await route.GET(new Request('http://localhost/api/ahsp'))
assert.ok(calls.some(c => c[0] === 'rpc' && c[1] === 'ahsp_search_items' && c[2].p_terms.length === 0), 'Unfiltered lists use the same PostgreSQL result and summary calculation')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?mode=multiple&q=x%2Cy%29%25'))
assert.deepEqual(Array.from(calls.find(c => c[0] === 'rpc')[2].p_terms), ['x,y)%'], 'Commas remain literal RPC parameters; punctuation is never interpreted as SQL or a filter expression')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?q=2.2.1.9.2&scope=components&analysis=extracted'))
const searchCall = calls.find(c => c[0] === 'rpc')
assert.equal(searchCall[2].p_terms[0], '2.2.1.9.2')
assert.equal(searchCall[2].p_scope, 'components')
assert.equal(searchCall[2].p_analysis, 'extracted')
assert.equal(searchCall[2].p_match, 'like')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?sipasti=database_only'))
assert.equal(calls.find(c => c[0] === 'rpc')[2].p_sipasti, 'database_only', 'SIPASTI status reaches the PostgreSQL search and statistics filter')
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?sipasti=invalid'))).status, 400)
calls = []
await route.GET(new Request('http://localhost/api/ahsp?q=Rambu%20Petunjuk&match=exact'))
assert.equal(calls.find(c => c[0] === 'rpc')[2].p_match, 'exact')
calls = []
await route.GET(new Request('http://localhost/api/ahsp?q=Beton%202%2C5%20mm'))
assert.deepEqual(Array.from(calls.find(c => c[0] === 'rpc')[2].p_terms), ['Beton 2,5 mm'], 'Single search never splits a job name on commas')
assert.equal((await route.GET(new Request(`http://localhost/api/ahsp?mode=multiple&q=${encodeURIComponent(Array.from({ length: 51 }, (_, i) => `term${i}`).join('\n'))}`))).status, 400)
const searchExample = 'Petugas pengatur lalu lintas,\\\nPeralatan P3K,\\\nRambu petunjuk,\\\nRambu peringatan,\\\nRambu informasi,\\\nKerucut lalu lintas (traffic cone),\\\nTongkat pengatur lalu lintas (Warning Lights Stick),\\\nLampu/alat penerangan sementara,'
assert.equal(core.parseAhspSearch(searchExample).length, 8)
assert.equal(core.parseAhspSearch(searchExample)[0], 'Petugas pengatur lalu lintas,', 'A trailing comma is also literal search text')
assert.deepEqual(Array.from(core.parseAhspSearch('Pekerja; PEKERJA\nBesi diameter 2,5 mm; Alat (kecil, sedang)')), ['Pekerja', 'Besi diameter 2,5 mm', 'Alat (kecil, sedang)'])
assert.deepEqual(Array.from(core.parseAhspSearch('Beton, mutu K-250;Pekerja\\Mandor\r\nAlat (kecil; sedang)')), ['Beton, mutu K-250', 'Pekerja', 'Mandor', 'Alat (kecil; sedang)'], 'Keep comma-containing names whole and preserve the other delimiter rules')
assert.deepEqual(Array.from(core.parseAhspSearch('Pekerja,Mandor')), ['Pekerja,Mandor'])
const phraseInput = '"Mobilisasi dan Demobilisasi" "Alat Berat" "Excavator"'
assert.deepEqual(Array.from(core.parseAhspSearch(phraseInput, 'phrases')), ['Mobilisasi dan Demobilisasi', 'Alat Berat', 'Excavator'])
assert.deepEqual(Array.from(core.parseAhspSearch('“Alat   Berat”\n"ALAT BERAT"; Excavator', 'phrases')), ['Alat Berat', 'Excavator'], 'Normalize whitespace, smart quotes, and duplicate phrases')
assert.deepEqual(Array.from(core.parseAhspSearch('Alat Berat "Excavator 20 ton"', 'phrases')), ['Alat', 'Berat', 'Excavator 20 ton'])
assert.deepEqual(Array.from(core.parseAhspSearch('"Beton, mutu K-250" "Alat (kecil; sedang)"', 'phrases')), ['Beton, mutu K-250', 'Alat (kecil; sedang)'])
assert.deepEqual(Array.from(core.parseAhspSearch(phraseInput)), [phraseInput], 'Existing match modes keep literal quotes and spaces')
assert.equal(core.ahspPhraseSearchError(phraseInput), '')
calls = []
const phraseResponse = await route.GET(new Request(`http://localhost/api/ahsp?match=phrases&scope=components&q=${encodeURIComponent(phraseInput)}`))
assert.equal(phraseResponse.status, 200)
assert.equal((await phraseResponse.json()).search_stats.match, 'phrases')
const phraseCall = calls.find(c => c[0] === 'rpc')[2]
assert.deepEqual(Array.from(phraseCall.p_terms), ['Mobilisasi dan Demobilisasi', 'Alat Berat', 'Excavator'])
assert.equal(phraseCall.p_match, 'phrases')
assert.equal(phraseCall.p_scope, 'jobs', 'Phrase matches always use job names, irrespective of requested scope')
for (const invalid of ['', '"Excavator"', '"Excavator" "EXCAVATOR"', '"Alat Berat" "Excavator']) {
  calls = []
  assert.equal((await route.GET(new Request(`http://localhost/api/ahsp?match=phrases&q=${encodeURIComponent(invalid)}`))).status, 400)
  assert.equal(calls.length, 0, 'Invalid phrase searches do not reach the database')
}
phraseSupport = false
assert.equal((await route.GET(new Request(`http://localhost/api/ahsp?match=phrases&q=${encodeURIComponent(phraseInput)}`))).status, 503, 'An unapplied migration cannot silently return Like-match results')
phraseSupport = true
calls = []
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?regulation=SE%20182%2F2025'))).status, 200)
assert.equal(calls.find(c => c[0] === 'rpc')[2].p_regulation, 'SE 182/2025')
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?regulation=SE%20147%2F2025'))).status, 400)
archiveSupport = false
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?regulation=SE%20182%2F2025'))).status, 503, 'Missing archive migration cannot appear as a successful empty catalogue')
archiveSupport = true
groupSupport = false
assert.equal((await route.GET(new Request('http://localhost/api/ahsp?q=Papan'))).status, 503, 'An unapplied grouping migration cannot silently return duplicate names')
groupSupport = true
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
