import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import PizZip from 'pizzip'

const folder = process.argv[2]
assert.ok(folder, 'Usage: node scripts/check-ahsp-gorontalo.mjs evidence-folder [--live]')
function load(file, imports = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name] }, Date, Set, Map, Uint8Array })
  return exports
}
const core = load('lib/ahsp.ts'), rab = load('lib/ahspRab.ts', { './ahsp': core })
const { buildRabUsage } = load('lib/ahspRabUsage.ts', { './ahspRab': rab })
const { readAhspNativeComponents } = load('lib/ahspNativeComponents.ts')
const { exportRabWorkbook } = load('lib/ahspRabExcel.ts', { './ahspRab': rab, pizzip: PizZip })
const books = JSON.parse(fs.readFileSync(`${folder}/rab-compare.json`, 'utf8'))
const manual = Object.values(books).find(book => book['Rincian Lampiran'])
const system = Object.values(books).find(book => book['Cakupan Komponen'])
const get = (row, col) => row.cells[col + row.row] ?? ''
const expected = manual['Rincian Lampiran'].filter(row => String(get(row, 'J')) === '1')
const groups = { 'Tenaga kerja': 'tenaga', Material: 'bahan', Peralatan: 'alat' }
const identity = (group, code, name) => `${group}:${String(code).trim().toLowerCase() || rab.rabText(name).replace(/\s/g, '')}`
const expectedKeys = expected.map(row => JSON.stringify([get(row, 'D'), identity(groups[get(row, 'E')], get(row, 'F'), get(row, 'G'))])).sort()
const patches = JSON.parse(fs.readFileSync(`${folder}/page-repairs.json`, 'utf8')).patches
const items = JSON.parse(fs.readFileSync(`${folder}/gorontalo-ahsp.json`, 'utf8')).map(({ item }) => ({ ...item, ...patches.find(p => p.before.id === item.id)?.after }))
let analyses
let candidates = items
if (process.argv.includes('--live')) {
  const catalogResponse = await fetch('http://localhost:3000/api/ahsp/rab')
  assert.equal(catalogResponse.status, 200)
  const catalog = (await catalogResponse.json()).items
  candidates = system['Cakupan Komponen'].slice(1).map(row => {
    const matches = catalog.filter(item => item.code === get(row, 'E') && item.name === get(row, 'F') && item.regulation === get(row, 'G'))
    assert.equal(matches.length, 1, `Exact catalog identity: ${get(row, 'E')}`)
    return matches[0]
  })
  const response = await fetch('http://localhost:3000/api/ahsp/rab/components', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: candidates.map(item => item.id) }) })
  assert.equal(response.status, 200)
  analyses = (await response.json()).analyses
} else analyses = items.map(item => ({ item, analysis: item, identity_scope: JSON.stringify([item.regulation, item.field, item.source_id]), status: 'needs_review', ...readAhspNativeComponents(item), excluded_components: 0, note: '' }))
const numeric = value => value === '' ? null : Number(value)
const rows = ['Regulasi Utama', 'Regulasi Tambahan', 'Belum Cocok', 'Dikecualikan'].flatMap(sheet => system[sheet].slice(1).map(source => {
  const candidate = sheet.startsWith('Regulasi') ? candidates.find(item => item.code === get(source, 'L') && item.name === get(source, 'K') && item.regulation === get(source, 'N')) : null
  return { id: `${get(source, 'A')}:${get(source, 'B')}`, sheet: get(source, 'A'), row: Number(get(source, 'B')), source: get(source, 'C'), originalName: get(source, 'D'), name: get(source, 'E'), code: get(source, 'F'), unit: get(source, 'G'), volume: numeric(get(source, 'H')), price: numeric(get(source, 'I')), total: numeric(get(source, 'J')), raw: JSON.parse(get(source, 'U') || '{}'), refs: JSON.parse(get(source, 'T') || '{}'), issues: [], reviewed: true, excluded: sheet === 'Dikecualikan', exclusion: '', status: candidate ? 'matched' : 'missing', candidate, candidates: [], manual: get(source, 'Q') === 'Manual', resolution: get(source, 'R'), history: [get(source, 'V')] }
})).sort((a, b) => a.row - b.row)
const report = buildRabUsage(rows, analyses)
const actual = report.components.flatMap(c => c.jobs.map(job => JSON.stringify([job.item.code, identity(c.group, c.code, c.name)]))).sort()
const missing = expectedKeys.filter(k => !actual.includes(k)), extra = actual.filter(k => !expectedKeys.includes(k))
const byJob = items.map(item => ({ code: item.code, expected: expected.filter(row => get(row, 'D') === item.code).length, actual: report.components.filter(c => c.jobs.some(job => job.item.id === item.id)).length }))
console.log(JSON.stringify({ covered: report.covered, components: report.components.length, relations: actual.length, groups: Object.fromEntries(['tenaga', 'bahan', 'alat'].map(group => [group, report.components.filter(c => c.group === group).length])), byJob, missing, extra }, null, 2))
assert.equal(JSON.stringify(actual), JSON.stringify(expectedKeys), 'Every component–AHSP pair must match the independent manual detail')
for (const row of manual['Komponen Unik'].filter(row => get(row, 'G') && row.row >= 6)) {
  const key = identity(groups[get(row, 'C')], get(row, 'D'), get(row, 'E'))
  const component = report.components.find(c => identity(c.group, c.code, c.name) === key)
  assert.ok(component, key)
  assert.equal(component.total, Number(get(row, 'G')), key)
}
assert.equal(report.covered, 14)
assert.equal(report.components.length, 44)
assert.equal(actual.length, 122)
const context = { filename: 'ASB Rekonstruksi Jalan Lebar 4 m, 2 lapis - aldy saputra.xlsx', sheets: [{ name: 'Sheet2', start: 2, lastRow: Math.max(...rows.map(row => row.row)) }], catalogAt: '', completed: true }
const baseline = new PizZip(exportRabWorkbook(rows, context))
const bytes = exportRabWorkbook(rows, { ...context, usage: report })
const zip = new PizZip(bytes)
assert.equal(zip.file('xl/worksheets/sheet6.xml').asText(), baseline.file('xl/worksheets/sheet6.xml').asText(), 'Usage never changes original RAB units/volumes/prices/totals')
assert.equal((zip.file('xl/worksheets/sheet8.xml').asText().match(/<row /g) || []).length, 123)
fs.writeFileSync(`${folder}/verification-export.xlsx`, bytes)
fs.writeFileSync(`${folder}/verification.json`, JSON.stringify({ mode: process.argv.includes('--live') ? 'live' : 'offline', covered: report.covered, unique: report.components.length, relations: actual.length, byJob, components: report.components.map(c => ({ name: c.name, group: c.group, code: c.code, unit: c.unit, total: c.total })) }, null, 2))
console.log('PASS: all 122 relationships and all 44 component counts match the independent manual workbook; 9-sheet export verified.')
