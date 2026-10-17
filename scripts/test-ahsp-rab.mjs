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
const pricedHeading = { ...sheet, lastRow: 6, merges: [], cells: { A1: cell('Kode'), B1: cell('Uraian'), C1: cell('Satuan'), D1: cell('Volume'), E1: cell('Harga Satuan'), F1: cell('Jumlah Harga'), B2: cell('DIVISI 1'), E2: cell(0), B3: cell('Jumlah Harga Pekerjaan'), E3: cell(100), B4: cell('PEKERJAAN PERSIAPAN'), E4: cell('1.000'), E5: cell(20), B6: cell('DIVISI 2') } }
const pricedRows = rab.extractRabRows(pricedHeading, sheet.mapping)
assert.equal(pricedRows.filter(row => !row.excluded).length, 4, 'Any unit price, including zero and ambiguous numeric text, retains a work row')
assert.equal(pricedRows.find(row => row.row === 5).name, 'Uraian belum terbaca', 'A price-only row is retained for review even without a code/unit/description')
assert.equal(pricedRows.find(row => row.row === 6).excluded, true, 'Unpriced headings stay excluded')
const skipped = rab.confirmRabNoMatch(pricedRows[0])
assert.equal(skipped.status, 'missing')
assert.equal(skipped.noMatch, true)
assert.equal(rab.matchRabRow(skipped, []).noMatch, true, 'Rematching preserves an explicit no-match decision')
assert.equal(rab.rabRecap([skipped]).total, 1)
assert.equal(rab.rabRecap([skipped]).checkedMissing, 1)
assert.equal(rab.rabRecap([skipped]).percent, 0, 'No-match decisions never inflate the matching percentage')
const included = rab.includeRabRows(pricedRows, [pricedRows.at(-1).id], [])
assert.equal(included.at(-1).excluded, false)
assert.equal(included.at(-1).exclusion, '')
assert.equal(included[0], pricedRows[0], 'Bulk inclusion touches only selected exclusions')
const unclearExcluded = { ...pricedRows[0], excluded: true, reviewed: false, issues: ['Periksa sumber'] }
assert.equal(rab.includeRabRows([unclearExcluded], [unclearExcluded.id], [])[0].reviewed, false, 'Bulk inclusion never confirms ambiguous source data')
assert.equal(rab.rabNumber(cell('1.000')).value, null, 'Ambiguous text cannot become a guessed price')
assert.equal(rab.rabNumber(cell('1.234,50')).value, 1234.5)
assert.equal(rab.rabNumber({ text: '', value: null, formula: true }).issue.length > 0, true)
const candidate = { id: 'a', name: rows[0].name, code: '7.1.(7a)', unit: 'm3', regulation: 'SE 47/2026', regulation_status: '' }
const unitGroups = [
  ['ls', ['LS', 'Ls', 'ls', 'Lumsum', 'Lumpsum', 'Lump Sum', 'Lumsun']],
  ['m3', ['M3', 'm3', 'M³', 'Meter Kubik']],
  ['m2', ['M2', 'm2', 'M²', 'Meter Persegi']],
  ['m', ['M1', "m'", 'm', 'Meter', 'Meter Panjang']],
  ['kg', ['Kg', 'kg', 'Kilogram']],
  ['buah', ['Bh', 'bh', 'Buah', 'buah']],
  ['ob', ['Org / Bln', 'org-bln', 'OB', 'org/bln', 'Orang-Bulan', 'Orang Bulan']],
  ['org', ['org', 'Orang']],
  ['pasang', ['Psg', 'Pasang']],
]
for (const [canonical, aliases] of unitGroups) for (const alias of aliases) {
  assert.equal(rab.rabUnit(alias), canonical, `Approved unit alias: ${alias}`)
  assert.equal(rab.rabUnit(`  ${alias.toUpperCase()}  `), canonical, `Unit casing and whitespace: ${alias}`)
  const source = { ...rows[0], unit: alias, volume: 2.5, price: 1200, total: 3000 }
  const identity = { ...candidate, unit: canonical }
  assert.equal(rab.rabDifferences(source, identity).length, 0, `Equivalent units do not produce a mismatch: ${alias}`)
  const matched = rab.matchRabRow(source, [identity])
  assert.equal(matched.status, 'matched', `Equivalent unit allows the same work name to match: ${alias}`)
  assert.equal(matched.unit, alias, 'The original unit label is retained')
  assert.equal(matched.volume, 2.5)
  assert.equal(matched.price, 1200)
  assert.equal(matched.total, 3000)
}
for (const [a, b] of [['Set', 'Buah'], ['Psg', 'Buah'], ['Roll', 'Meter'], ['Dos', 'Buah'], ['LS', 'Paket'], ['Alat/Kend', 'Unit'], ['M1', 'M2'], ['M2', 'M3'], ['Kg', 'Ton'], ['Liter', 'M3'], ['Orang', 'Orang-Bulan'], ['Orang-Bulan', 'Orang-Jam'], ['Meter Kubik per km', 'M3'], ["M3/M'", 'M3'], ['-', 'LS'], ['', 'LS'], ['100 Buah', 'Buah']]) {
  assert.notEqual(rab.rabUnit(a), rab.rabUnit(b), `Different or context-dependent units stay different: ${a} / ${b}`)
  assert.equal(rab.matchRabRow({ ...rows[0], unit: a }, [{ ...candidate, unit: b }]).status, 'review')
}
for (const unit of ['constructor', '__proto__', 'Unit khusus']) assert.equal(typeof rab.rabUnit(unit), 'string', 'Unknown units remain literal unit names')
const archive = { ...candidate, id: 'b', regulation: 'SE 182/2025', regulation_status: 'Digantikan oleh SE 47/2026' }
const different = { ...candidate, id: 'c', name: 'Beton struktur fc 15 MPa' }
assert.ok(rab.rabDifferences(rows[0], different).some(s => s.includes('spesifikasi')))
assert.equal(rab.matchRabRow(rows[0], [different]).status, 'review')
assert.equal(rab.matchRabRow(rows[0], [candidate, archive]).candidate.id, 'a')
assert.equal(rab.matchRabRow(rows[0], [archive, different]).candidate.id, 'b', 'An approximate primary must not hide an exact archive match')
assert.equal(rab.matchRabRow(rows[0], [{ ...candidate, unit: 'm2' }, archive]).candidate.id, 'b', 'A conflicting primary unit must not hide a compatible archive match')
assert.equal(rab.matchRabRow({ ...rows[0], reviewed: false }, [candidate]).status, 'review')
assert.equal(rab.matchRabRow(rows[0], [{ ...candidate, unit: 'm2' }]).status, 'review')
assert.equal(rab.matchRabRow(rows[0], [{ ...archive, unit: 'm3' }, { ...candidate, unit: 'Meter Kubik' }]).candidate.id, 'a', 'Equivalent primary unit retains priority over an archive exact match')
assert.equal(rab.matchRabRow({ ...rows[0], reviewed: false }, [{ ...candidate, unit: 'Meter Kubik' }]).status, 'review', 'Unit aliases do not bypass source confirmation')
assert.equal(rab.matchRabRow(rows[0], [{ ...different, unit: 'Meter Kubik' }]).status, 'review', 'Unit aliases do not bypass different work specifications')
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
assert.ok(!exported.includes('Riwayat tindakan') && !exported.includes('Sel angka asal'), 'Detail export omits technical audit columns')
assert.equal(zip.file('xl/worksheets/sheet1.xml').asText().includes('TERBATAS'), true)
assert.equal(zip.file('xl/worksheets/sheet1.xml').asText().includes('Sementara'), true)
const summaryXml = zip.file('xl/worksheets/sheet1.xml').asText()
for (const section of ['CAKUPAN SHEET', 'HASIL PENCOCOKAN', 'RINGKASAN NILAI PER KELOMPOK', 'CATATAN PEMBACAAN DAN REKONSILIASI']) assert.ok(summaryXml.includes(section))
assert.ok(summaryXml.includes('<mergeCells'), 'Summary uses separate merged section headings and value areas')
assert.ok(zip.file('xl/styles.xml').asText().includes('numFmtId="3"'), 'Integer counts do not use a dangling decimal separator')
const unmatchedSource = rows.find(row => !row.excluded && row.id !== rows[0].id)
const finalSource = [{ ...rows[0], status: 'matched', candidate: { ...candidate, code: 'AHSP.20', name: 'Beton standar hasil rekonsiliasi', unit: 'm2' }, manual: true, resolution: '' }, { ...unmatchedSource, candidate: different, status: 'missing' }, { ...unmatchedSource, id: 'excluded', excluded: true, name: 'JANGAN MASUK FINAL' }]
const finalZip = new PizZip(excel.exportRabWorkbook(finalSource, { filename: 'RAB.xlsx', sheets: [{ name: sheet.name, lastRow: 5, start: 2 }], catalogAt: '', completed: true }))
assert.ok(finalZip.file('xl/workbook.xml').asText().includes('name="Final RAB"'))
const finalXml = finalZip.file('xl/worksheets/sheet6.xml').asText()
const cellXml = (xml, address) => xml.match(new RegExp(`<c r="${address}"[^>]*>[\\s\\S]*?</c>`))?.[0] ?? ''
assert.ok(cellXml(finalXml, 'A7').includes('AHSP.20'))
assert.ok(cellXml(finalXml, 'B7').includes(finalSource[0].originalName.replaceAll('"', '&quot;')), 'Final RAB includes the escaped original source description')
assert.ok(cellXml(finalXml, 'C7').includes('Beton standar hasil rekonsiliasi'))
assert.ok(cellXml(finalXml, 'D7').includes('m³'), 'Source unit stays paired with the original price and quantity, even after a manual unit mismatch')
assert.ok(cellXml(finalXml, 'E7').includes('<v>100</v>'))
assert.ok(cellXml(finalXml, 'F7').includes('<v>0</v>'), 'Real zero quantity is retained')
assert.ok(cellXml(finalXml, 'G7').includes('<v>0</v>'), 'Real zero total is retained')
assert.ok(cellXml(finalXml, 'H7').includes('SE 47/2026'))
assert.ok(cellXml(finalXml, 'A8').includes(unmatchedSource.code), 'Unmatched work uses the source code, ignoring stale candidates')
assert.ok(cellXml(finalXml, 'C8').includes(unmatchedSource.name))
assert.ok(!cellXml(finalXml, 'H8').includes('SE 47/2026'), 'Unmatched work does not acquire a candidate regulation')
assert.ok(cellXml(finalXml, 'G9').includes('<v>10</v>'), 'Final grand total equals included source totals')
assert.equal(finalXml.includes('JANGAN MASUK FINAL'), false)
assert.ok(finalZip.file('xl/worksheets/sheet2.xml').asText().includes('Satuan berbeda'), 'Differences are retained even when the optional resolution is blank')
const unmatchedZip = new PizZip(excel.exportRabWorkbook([{ ...unmatchedSource, status: 'missing', candidate: null, total: null }], { filename: 'RAB.xlsx', sheets: [], catalogAt: '', completed: true }))
const unmatchedFinal = unmatchedZip.file('xl/worksheets/sheet6.xml').asText()
assert.ok(cellXml(unmatchedFinal, 'C7').includes(unmatchedSource.name), 'Final RAB also works when nothing matches')
assert.equal(cellXml(unmatchedFinal, 'G7'), '', 'Missing totals remain blank')
assert.equal(cellXml(unmatchedFinal, 'G8'), '', 'An entirely unavailable total is not presented as zero')
const aliasRow = rab.matchRabRow({ ...rows[0], unit: 'M³', volume: 2.5, price: 1200, total: 3000 }, [{ ...candidate, unit: 'Meter Kubik' }])
const aliasExport = new PizZip(excel.exportRabWorkbook([aliasRow], { filename: 'alias.xlsx', sheets: [], catalogAt: '', completed: true }))
const aliasFinal = aliasExport.file('xl/worksheets/sheet6.xml').asText()
assert.ok(cellXml(aliasFinal, 'D7').includes('M³'), 'Final RAB retains the source unit after alias matching')
assert.ok(cellXml(aliasFinal, 'E7').includes('<v>1200</v>'))
assert.ok(cellXml(aliasFinal, 'F7').includes('<v>2.5</v>'))
assert.ok(cellXml(aliasFinal, 'G7').includes('<v>3000</v>'))
assert.equal(rab.rabPercent(100/3), '33,33')
assert.equal(rab.rabPercent(100), '100,00')
assert.equal(rab.rabMoney(95762945303.97902), '95.762.945.303,98')
const repeated = [aliasRow, { ...aliasRow, id: 'repeat', row: 20, unit: 'm2', volume: 7, price: 11, total: 77 }, { ...aliasRow, id: 'case', name: aliasRow.name.toUpperCase() }, { ...aliasRow, id: 'code', code: aliasRow.code + ' ' }, { ...aliasRow, id: 'skip', excluded: true }]
assert.equal(rab.groupRabRows(repeated).length, 3, 'Grouping requires exact, case-sensitive names AND codes and excludes excluded rows')
const groupChanged = rab.updateRabGroup(repeated, aliasRow, row => rab.confirmRabNoMatch(row))
assert.equal(groupChanged.filter(row => row.noMatch).length, 2)
assert.equal(JSON.stringify(groupChanged.map(({ volume, price, total, unit, originalName, source }) => [volume, price, total, unit, originalName, source])), JSON.stringify(repeated.map(({ volume, price, total, unit, originalName, source }) => [volume, price, total, unit, originalName, source])))
const mixed = rab.groupRabRows([aliasRow, { ...aliasRow, id: 'unmatched-repeat', candidate: null, status: 'review' }])[0]
assert.equal(mixed.mixed, true)
assert.equal(mixed.matched, false, 'Conflicting decisions stay visible for review')
const detailXml = aliasExport.file('xl/worksheets/sheet2.xml').asText()
assert.ok(cellXml(detailXml, 'B2').includes('s="8"') && cellXml(detailXml, 'H2').includes('s="9"'), 'Source and reconciliation descriptions use distinct styles')
const oldFinal = new PizZip(excel.exportRabWorkbook([{ ...aliasRow, candidate: archive }], { filename: 'old.xlsx', sheets: [], catalogAt: '', completed: true })).file('xl/worksheets/sheet6.xml').asText()
assert.ok(cellXml(oldFinal, 'A7').includes('s="10"') && cellXml(oldFinal, 'E7').includes('s="13"'), 'Archived regulation rows are colored while prices retain two-decimal numeric formats')
assert.ok(!summaryXml.includes('Persentase utama (%)') && summaryXml.includes('(50,00%)'), 'Recap combines counts and two-decimal percentages')
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
console.log('PASS: nine approved unit groups (37 aliases), 17 distinct/contextual unit guards, unchanged source units/amounts, extraction, matching, archive priority, recap, Final RAB, safe XLSX export, catalog cache/concurrency and errors.')
