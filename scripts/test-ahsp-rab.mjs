import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import PizZip from 'pizzip'

function load(file, imports) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, require: name => { if (!(name in imports)) throw new Error(name); return imports[name] }, Date, Set, Map, Uint8Array, DataView, Number, JSON, Response })
  return exports
}
const core = load('lib/ahsp.ts', {})
const rab = load('lib/ahspRab.ts', { './ahsp': core })
const excel = load('lib/ahspRabExcel.ts', { './ahspRab': rab, pizzip: PizZip })
const cell = value => ({ text: String(value), value: typeof value === 'number' ? value : null, formula: false })
const sheet = { name: 'Rincian', lastRow: 1002, hidden: false, columns: ['A', 'B', 'C', 'D', 'E', 'F'], merges: [], cells: {
  A1: cell('Kode'), B1: cell('Uraian'), C1: cell('Satuan'), D1: cell('Volume'), E1: cell('Harga Satuan'), F1: cell('Jumlah Harga'),
  A2: cell('7.1.(7a)'), B2: cell('Beton struktur fc 20 MPa'), C2: cell('m³'), D2: cell(0), E2: cell(100), F2: cell(0),
  B3: cell('Jumlah Harga Pekerjaan DIVISI 1'), F3: cell(0),
  A4: cell('6.5.(3)'), B4: cell('Total Aspal Keras dan Bitumen dari Asbuton'), C4: cell('Kg'), D4: cell(1), E4: cell(10), F4: cell(10),
  A1001: cell('10.1.(1)'), B1001: cell('Tidak boleh terbaca'), C1001: cell('m3'), D1001: cell(1),
} }
sheet.mapping = rab.detectRabMapping(sheet)
assert.equal(sheet.mapping.name, 'B')
assert.equal(sheet.mapping.price, 'E')
let rows = rab.extractRabRows(sheet, sheet.mapping)
assert.equal(rows.filter(row => !row.excluded).length, 2, 'Zero-volume work and Total Aspal are work items; subtotal is excluded')
assert.equal(rows.some(row => row.row > 1000), false)
assert.equal(rows[0].volume, 0)
assert.equal(rab.rabNumber(cell('1.000')).value, null, 'Ambiguous text cannot become a guessed price')
assert.equal(rab.rabNumber(cell('1.234,50')).value, 1234.5)
assert.equal(rab.rabNumber({ text: '', value: null, formula: true }).issue.length > 0, true)
const candidate = { id: 'a', name: rows[0].name, code: '7.1.(7a)', unit: 'm3', regulation: 'SE 47/2026', regulation_status: '' }
const archive = { ...candidate, id: 'b', regulation: 'SE 182/2025', regulation_status: 'Digantikan oleh SE 47/2026' }
const different = { ...candidate, id: 'c', name: 'Beton struktur fc 15 MPa' }
assert.ok(rab.rabDifferences(rows[0], different).some(s => s.includes('spesifikasi')))
assert.equal(rab.matchRabRow(rows[0], [different]).status, 'review')
assert.equal(rab.matchRabRow(rows[0], [candidate, archive]).candidate.id, 'a')
assert.equal(rab.matchRabRow(rows[0], [archive, different]).candidate.id, 'b', 'An approximate primary must not hide an exact archive match')
assert.equal(rab.matchRabRow(rows[0], [{ ...candidate, unit: 'm2' }, archive]).candidate.id, 'b', 'A conflicting primary unit must not hide a compatible archive match')
assert.equal(rab.matchRabRow({ ...rows[0], reviewed: false }, [candidate]).status, 'review')
assert.equal(rab.matchRabRow(rows[0], [{ ...candidate, unit: 'm2' }]).status, 'review')
const merged = { ...sheet, lastRow: 5, merges: [{ from: 2, to: 4, left: 2, right: 2, ref: 'B2:B4' }], cells: { ...sheet.cells, B2: cell('PEKERJAAN PERSIAPAN\nMobilisasi\nGalian Tanah'), B3: undefined, B4: undefined, A2: cell('La.04'), C2: cell('LS'), D2: cell(1), A3: cell('A.3'), C3: cell('m3'), D3: cell(2), D4: undefined, E4: undefined, F4: undefined } }
const split = rab.extractRabRows(merged, sheet.mapping).filter(row => !row.excluded)
assert.equal(split.length, 2)
assert.equal(split.every(row => !row.reviewed), true)
assert.equal(split[0].name, 'Mobilisasi')
assert.equal(split[1].name, 'Galian Tanah')
rows[0] = rab.matchRabRow(rows[0], [archive])
let recap = rab.rabRecap(rows)
assert.equal(recap.primary, 0)
assert.equal(recap.additional, 1)
assert.equal(recap.total, 2)
assert.equal(recap.additionalPercent, 50)
assert.equal(recap.percent, 0)
rows[0].originalName = '=HYPERLINK("https://example.invalid")'
const bytes = excel.exportRabWorkbook(rows, { filename: 'RAB.xlsx', sheets: [{ name: sheet.name, lastRow: 1002, start: 2 }], catalogAt: '2026-10-15', completed: false })
const zip = new PizZip(bytes)
assert.equal(zip.file('xl/workbook.xml').asText().includes('Regulasi Tambahan'), true)
const exported = zip.file('xl/worksheets/sheet3.xml').asText()
assert.equal(exported.includes('t="inlineStr"'), true)
assert.equal(exported.includes('<f>'), false, 'Source text cannot become an executable formula')
assert.equal(exported.includes('HYPERLINK'), true)
assert.equal(zip.file('xl/worksheets/sheet1.xml').asText().includes('TERBATAS'), true)
assert.equal(zip.file('xl/worksheets/sheet1.xml').asText().includes('Sementara'), true)
fs.mkdirSync('.next/rab-tests', { recursive: true })
fs.writeFileSync('.next/rab-tests/export.xlsx', bytes)
const ranges = []
let allowed = true
const query = {
  select(columns) { assert.equal(columns.includes('components'), false); return query },
  in(column, regulations) { assert.equal(column, 'regulation'); assert.equal(regulations.length, 3); return query },
  order(column) { assert.equal(column, 'id'); return query },
  async range(start, end) { ranges.push([start, end]); return { data: Array.from({ length: start === 0 ? 1000 : 1 }, (_, i) => ({ ...candidate, id: String(start + i) })), error: null } },
}
const db = { from(table) { assert.equal(table, 'ahsp_items'); return query } }
const imports = { '@/lib/ahsp': core, '@/lib/supabaseAdmin': { getSupabaseAdmin: () => db }, '@/lib/rateLimit': { clientKey: () => 'test', rateLimit: () => ({ ok: allowed, retryAfter: 60 }) } }
const api = load('app/api/ahsp/rab/route.ts', imports)
const responses = await Promise.all([api.GET(new Request('http://localhost/api/ahsp/rab')), api.GET(new Request('http://localhost/api/ahsp/rab'))])
assert.equal((await responses[0].json()).items.length, 1001)
assert.equal(responses[1].status, 200)
assert.deepEqual(ranges, [[0, 999], [1000, 1999]], 'Concurrent callers share a complete paginated catalog load')
await api.GET(new Request('http://localhost/api/ahsp/rab'))
assert.equal(ranges.length, 2, 'Catalog cache does not reread every item')
allowed = false
assert.equal((await api.GET(new Request('http://localhost/api/ahsp/rab'))).status, 429)
const failed = load('app/api/ahsp/rab/route.ts', { ...imports, '@/lib/rateLimit': { clientKey: () => 'test', rateLimit: () => ({ ok: true }) }, '@/lib/supabaseAdmin': { getSupabaseAdmin: () => { throw new Error('private database detail') } } })
const failure = await failed.GET(new Request('http://localhost/api/ahsp/rab'))
assert.equal(failure.status, 503)
assert.equal((await failure.text()).includes('private database detail'), false)
console.log('PASS: extraction, merged items, row cap, numbers, specification/unit guards, archive separation, recap denominator, safe XLSX export, catalog pagination/cache, concurrency, rate limit and failure handling.')
