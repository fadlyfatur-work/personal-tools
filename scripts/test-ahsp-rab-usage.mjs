import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import PizZip from 'pizzip'
import { z } from 'zod'

function load(file, imports) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name] }, Response, Date, Set, Map, Uint8Array })
  return exports
}
const core = load('lib/ahsp.ts', {})
const rab = load('lib/ahspRab.ts', { './ahsp': core })
const native = load('lib/ahspNativeComponents.ts', {})
const { buildRabUsage } = load('lib/ahspRabUsage.ts', { './ahspRab': rab })
const { exportRabWorkbook } = load('lib/ahspRabExcel.ts', { './ahspRab': rab, pizzip: PizZip })
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const job = (n, regulation = 'SE 47/2026') => ({ id: uuid(n), code: `A.${n}`, name: `Pekerjaan uji ${n}`, unit: 'm3', regulation, regulation_status: '' })
const a = job(1), b = { ...job(2, 'SE 182/2025'), code: a.code }, c = job(3)
const resource = (group, name, unit, code = '') => ({ group, name, unit, code })
const pekerja = resource('tenaga', 'Pekerja', 'OH', 'L.01')
const semen = resource('bahan', 'Semen Portland', 'kg', 'B.01')
const mixer = resource('alat', 'Mixer', 'jam', 'E.01')
const analyses = [
  { item: a, analysis: a, status: 'extracted', components: [pekerja, { ...pekerja, code: 'L.02' }, semen, mixer], excluded_components: 0, note: '' },
  { item: b, analysis: b, status: 'needs_review', components: [{ ...pekerja, name: ' PEKERJA ' }, { ...semen, unit: 'Kilogram' }, resource('bahan', 'Semen Portland Tipe II', 'kg'), resource('alat', 'Mixer', 'hari')], excluded_components: 1, note: 'Rincian sebagian' },
  { item: c, analysis: c, status: 'unavailable', components: [], excluded_components: 0, note: '' },
]
const row = (n, candidate, extra = {}) => ({ id: `RAB:${n}`, sheet: 'RAB', row: n + 1, source: `B${n + 1}`, originalName: candidate.name, name: candidate.name, code: candidate.code, unit: 'Meter Kubik', volume: n, price: 1200, total: n * 1200, raw: {}, refs: {}, issues: [], reviewed: true, excluded: false, exclusion: '', status: 'matched', candidate, candidates: [], manual: false, resolution: '', history: [], ...extra })
const rows = [row(1, a), row(2, a), row(3, b), row(4, c), row(5, a, { status: 'review' }), row(6, a, { excluded: true })]
const original = JSON.stringify(rows)
const report = buildRabUsage([...rows, rows[0]], analyses)
assert.equal(JSON.stringify(rows), original, 'Usage must never mutate RAB financial/source data')
assert.equal(report.matched, 4)
assert.equal(report.covered, 3)
assert.equal(report.review, 1)
assert.equal(report.uniqueJobs, 3)
const labor = report.components.find(c => c.name === 'Pekerja')
assert.equal(labor.total, 3, 'Count RAB rows; repeated occurrences inside one analysis count once')
assert.equal(labor.jobs.length, 2, 'Different regulatory versions with the same code remain distinct AHSPs')
assert.equal(labor.jobs[0].sources.length, 2)
assert.equal(labor.codes.length, 2, 'Keep alternate resource codes without double counting occurrences')
assert.equal(report.components.find(c => c.name === 'Semen Portland').total, 3, 'Approved unit aliases share an identity')
assert.equal(report.components.filter(c => c.name === 'Mixer').length, 2, 'Different units remain separate')
assert.equal(report.components.filter(c => c.group === 'bahan').length, 2, 'Different specifications remain separate')
assert.equal(report.coverage.find(c => c.source.row === 5).available, false)
assert.match(report.coverage[3].note, /belum tersedia/)
assert.equal(buildRabUsage([rows[0]], []).covered, 0)
assert.equal(buildRabUsage([rows[0]], [{ ...analyses[0], item: { ...a, name: 'Berubah' } }]).covered, 0, 'Catalog metadata drift needs a new reconciliation')
assert.equal(buildRabUsage([rows[0]], [{ ...analyses[0], components: [resource('smkk', 'SMKK', '%'), resource('bahan', 'Tanpa satuan', '-')] }]).covered, 0)
const scope = JSON.stringify(['SE 47/2026', 'Bina Marga', '10903'])
const scoped = [
  { ...analyses[0], identity_scope: scope, components: [resource('bahan', 'Semen', 'kg', 'M12'), resource('bahan', 'Semen (PC)', 'Kilogram', 'M12'), resource('bahan', 'Semen', 'kg', 'M13')] },
  { ...analyses[2], identity_scope: scope, components: [resource('bahan', 'Semen Portland', 'kg', 'M12')] },
  { ...analyses[1], identity_scope: JSON.stringify(['SE 182/2025', 'Bina Marga', 'archive']), components: [resource('bahan', 'Semen', 'kg', 'M12')] },
]
const aliases = buildRabUsage([row(1, a), row(2, c), row(3, b)], scoped)
assert.equal(aliases.components.length, 3, 'Verified code aliases merge; different codes and regulatory sources stay separate')
assert.equal(aliases.components.find(c => c.code === 'M12' && c.jobs.length === 2).total, 2, 'Aliases inside one AHSP count once')
assert.equal(buildRabUsage([row(1, a)], [{ ...scoped[0], components: [resource('bahan', 'Semen', 'kg', 'M12'), resource('bahan', 'Semen', 'ton', 'M12')] }]).components.length, 2, 'Same code does not convert units')
assert.equal(buildRabUsage([row(1, a)], [{ ...scoped[0], identity_scope: undefined }]).components.length, 2, 'Unverified codes never establish an alias')
const context = { filename: 'RAB penggunaan.xlsx', sheets: [{ name: 'RAB', start: 2, lastRow: 7 }], catalogAt: '2026-10-16', completed: true }
const base = new PizZip(exportRabWorkbook(rows, context))
const bytes = exportRabWorkbook(rows, { ...context, usage: report })
const zip = new PizZip(bytes)
assert.equal((base.file('xl/workbook.xml').asText().match(/<sheet /g) || []).length, 6)
assert.equal((zip.file('xl/workbook.xml').asText().match(/<sheet /g) || []).length, 9)
assert.equal(zip.file('xl/worksheets/sheet6.xml').asText(), base.file('xl/worksheets/sheet6.xml').asText(), 'Final RAB preserves all financial values')
const laborXml = zip.file('xl/worksheets/sheet7.xml').asText()
assert.match(laborXml, /<c r="D3"[^>]*><v>3<\/v>/)
assert.match(laborXml, /<c r="E3"[^>]*><v>2<\/v>/)
assert.ok(zip.file('xl/workbook.xml').asText().includes('name="Rekapitulasi MPTK"'))
for (const title of ['TENAGA KERJA', 'MATERIAL', 'PERALATAN']) assert.ok(laborXml.includes(title))
const detail = zip.file('xl/worksheets/sheet8.xml').asText()
assert.equal((detail.match(/<row /g) || []).length, report.components.reduce((sum, c) => sum + c.total, 1))
assert.ok(detail.includes('SE 182/2025'))
assert.ok(zip.file('xl/worksheets/sheet9.xml').asText().includes('Belum tersedia'))
assert.ok(zip.file('xl/worksheets/sheet1.xml').asText().includes('CAKUPAN REKAP PENGGUNAAN KOMPONEN'))
fs.mkdirSync('.next/rab-tests', { recursive: true })
fs.writeFileSync('.next/rab-tests/usage-export.xlsx', bytes)

const makeItem = candidate => ({ ...candidate, field: 'Bina Marga', division: '', ahsp_type: '', reconciliation_status: '', reconciliation_notes: [], source_id: null, page_from: 1, page_to: 1, printed_page: '', analysis_status: 'extracted', components: [{ ...pekerja, coefficient: null, expression: '', sourceLine: 'A. TENAGA KERJA' }], source_text: '', overhead_min: null, overhead_max: null, master_rows: [], output_quantity: 1 })
const items = [makeItem(a), makeItem(b), makeItem(c)]
items[2].analysis_target_id = a.id
items[2].analysis_reference = { status: 'verified', target_item_id: a.id, target_code: a.code, target_regulation: a.regulation, source_fingerprint: core.ahspAnalysisFingerprint(items[2]), target_fingerprint: core.ahspAnalysisFingerprint(items[0]) }
let fail = false, limited = false, calls = [], validations = []
const db = { from(table) {
  const filters = {}
  const query = { select() { return query }, in(key, values) { filters[key] = values; return query }, order() { return query }, range(start, end) { calls.push({ table, start, end }); return Promise.resolve(fail ? { error: 'secret backend failure' } : { data: validations.filter(c => filters.item_id.includes(c.item_id)).slice(start, end + 1) }) }, then(resolve) { calls.push({ table, filters }); return Promise.resolve(fail ? { error: 'secret backend failure' } : { data: items.filter(item => filters.id.includes(item.id)) }).then(resolve) } }
  return query
} }
const api = load('app/api/ahsp/rab/components/route.ts', { zod: { z }, '@/lib/ahsp': core, '@/lib/ahspNativeComponents': native, '@/lib/supabaseAdmin': { getSupabaseAdmin: () => db }, '@/lib/rateLimit': { clientKey: () => 'test', rateLimit: () => ({ ok: !limited, retryAfter: 10 }) } })
const post = (body, headers = {}) => api.POST(new Request('http://localhost/api/ahsp/rab/components', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }))
for (const body of [{ ids: [] }, { ids: ['invalid'] }, { ids: Array(101).fill(a.id) }, { ids: [a.id], prices: [] }, '{']) assert.equal((await post(body)).status, 400)
assert.equal((await post('x'.repeat(10001))).status, 413)
limited = true
assert.equal((await post({ ids: [a.id] })).status, 429)
limited = false
validations = Array.from({ length: 1001 }, (_, position) => ({ item_id: a.id, position, component: { ...pekerja, coefficient: null, validation_issues: [] } }))
validations.push({ item_id: a.id, position: 1001, component: { ...semen, validation_issues: ['nonlabor_name_in_labor'] } })
let response = await post({ ids: [a.id, a.id, c.id] })
assert.equal(response.status, 200)
let body = await response.json()
assert.equal(body.analyses.length, 2, 'Deduplicate item IDs')
assert.equal(body.analyses[0].components.length, 1001, 'Paginate validation rows beyond Supabase default cap')
assert.equal(body.analyses[0].excluded_components, 1)
assert.equal(body.analyses[0].components[0].group, 'tenaga')
assert.equal(body.analyses[0].components[0].coefficient, undefined, 'Counts do not require or transmit coefficients')
validations.push({ item_id: a.id, position: 1002, component: { ...semen, coefficient: 0, validation_issues: [] } })
const zeroBody = await (await post({ ids: [a.id] })).json()
assert.equal(zeroBody.analyses[0].components.length, 1001, 'Structured zero coefficients are not usage')
assert.equal(zeroBody.analyses[0].excluded_components, 1, 'Zero coefficients are not identity validation failures')
assert.equal(body.analyses[1].analysis.id, a.id, 'Verified fingerprint-bound reference uses the official linked analysis')
assert.ok(calls.some(c => c.start === 1000))
items[2].analysis_reference.status = 'review'
response = await post({ ids: [c.id] })
body = await response.json()
assert.equal(body.analyses[0].analysis.id, c.id, 'Unverified links do not pull unrelated details')
assert.equal(body.analyses[0].components.length, 0)
assert.match(body.analyses[0].note, /belum terverifikasi/)
const sourceText = `C.13 Galian Perkerasan Beton (3.1.(12))
A. TENAGA
1. Pekerja    L01    Jam    1,0040    27.643,54    27.754,56
2. Mandor     L03    Jam    0,1673    33.312,62    5.574,40
B. BAHAN
1. Paku M18    kg    0,0000    15.000,00    0,00
JUMLAH HARGA BAHAN 0,00
C. PERALATAN
1. CONCRETE CUTTER (0,5-0,7 m/menit)    E76    Jam    0,2869    101.054,21    28.988,58
2. Alat Bantu    Ls    1,000    0,00    0,00
D. JUMLAH HARGA TENAGA, BAHAN DAN PERALATAN
A. TENAGA
1. Tidak boleh dari analisis berikutnya    L01    Jam    1    1    1`
const nativeItem = { ...items[2], field: 'Bina Marga', code: '3.1.(12)', source_text: sourceText, components: [], analysis_status: 'unavailable', analysis_target_id: null }
const parsed = native.readAhspNativeComponents(nativeItem)
assert.equal(parsed.components.length, 4)
assert.equal(parsed.components[0].name, 'Pekerja')
assert.equal(parsed.components[0].unit, 'Jam', 'Native Bina Marga labor hours stay literal; no unit conversion')
assert.equal(parsed.components[2].code, 'E76')
assert.equal(parsed.zero, 1, 'Filter by coefficient, never by example price')
assert.equal(native.readAhspNativeComponents({ ...nativeItem, code: '7.1.(6a)' }).components.length, 0, 'Never use a table for another job code')
assert.equal(native.readAhspNativeComponents({ ...nativeItem, field: 'SMKK' }).components.length, 0)
assert.equal(native.readAhspNativeComponents({ ...nativeItem, source_text: 'Daftar Isi: ' + sourceText }).components.length, 0, 'A TOC listing does not identify an analysis heading')
items[2] = nativeItem
response = await post({ ids: [c.id] })
body = await response.json()
assert.equal(body.analyses[0].components.length, 4, 'RAB uses source identities when structured components are absent')
assert.match(body.analyses[0].note, /teks sumber/)
assert.equal(body.analyses[0].status, 'needs_review')
if (fs.existsSync('.next/rab-trace.json')) {
  const trace = JSON.parse(fs.readFileSync('.next/rab-trace.json', 'utf8'))
  const inventory = trace.details.flatMap(({ item }) => native.readAhspNativeComponents(item).components)
  assert.ok(inventory.some(c => c.name === 'Pekerja'))
  assert.ok(inventory.some(c => /Concrete Mixer/i.test(c.name)))
  console.log('BANTEN native identities', inventory.length)
}
fail = true
response = await post({ ids: [a.id] })
assert.equal(response.status, 503)
assert.equal((await response.text()).includes('secret'), false)
console.log('PASS: usage row/AHSP counts, deduplication, unit/specification/version separation, coverage, source immutability, combined MPTK export, API validation/pagination/reference safety/errors.')
