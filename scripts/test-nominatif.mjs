import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'lib/nominatif/calculate.ts', 'lib/nominatif/excel.ts', '--outDir', '.next/nominatif-check', '--module', 'commonjs', '--target', 'es2020', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck'], { stdio: 'inherit' })
const { calculate, documentErrors, duration, provinces, hotelTier } = require('../.next/nominatif-check/calculate.js')
const { createWorkbook, terbilang } = require('../.next/nominatif-check/excel.js')
const { pickTemplate, readTemplate, templateErrors, TEMPLATE_STORAGE_KEY } = require('../.next/nominatif-check/template.js')
const PizZip = require('pizzip')
const person = { id: '1', name: 'Pegawai contoh', nip: '199001012020011001', grade: 'III/a', position: 'staff', nights: '2', hotelActual: '', jobTitle: 'Jabatan contoh' }
const trip = {
  satker: 'Satker contoh', budget: 'MAK.2026', sptNumber: 'SPT/01', sptDate: '2026-10-01', documentNumber: 'SPD/01', documentDate: '2026-10-04', issueCity: 'Jakarta', signer: 'PPK contoh', signerNip: '000000000000000000', treasurer: 'Bendahara contoh', treasurerNip: '000000000000000001',
  rule: 'pmk2026', mode: 'estimate', year: '2026', purpose: 'Koordinasi', originProvince: 'DKI Jakarta', destinationProvince: 'Sumatra Selatan', origin: 'Jakarta', destination: 'Palembang', start: '2026-10-05', end: '2026-10-07', activity: 'ordinary', before: false, after: false,
  transport: 'plane', ticket: '', ticketProvided: false, originTrips: '2', destinationTrips: '2', originRate: '', destinationRate: '', dailyProvided: false, hotelProvided: false, localActual: false, localCost: '', representationDuty: false,
  manual: { name: 'Aturan uji 2027', year: '2027', daily: '400000', hotel: '700000', representation: '0', originTransfer: '200000', destinationTransfer: '150000', localPercent: '50' },
}
const run = (changes = {}, employees = [person]) => calculate({ ...trip, ...changes }, employees)
const master = pickTemplate({ ...trip, bank: 'Bank contoh / 123', address: 'Alamat contoh', purpose: 'Tidak disimpan', start: '2026-01-01', people: [person] })
assert.equal(TEMPLATE_STORAGE_KEY, 'nominatif-template-v1')
assert.deepEqual(templateErrors(master), [])
assert.deepEqual(readTemplate(JSON.stringify(master)), master)
assert.ok(!('purpose' in master) && !('start' in master) && !('people' in master) && !('documentNumber' in master) && !('budget' in master) && !('issueCity' in master), 'Only reusable master fields are persisted')
for (const value of ['', '{', '[]', 'null', '42', '{}', JSON.stringify({ ...master, signerNip: 123 })]) assert.equal(readTemplate(value), null)
assert.equal(readTemplate(JSON.stringify({ ...master, extra: 'ignored' })).extra, undefined)
assert.equal(pickTemplate({ ...trip, satker: 'x'.repeat(500) }).satker.length, 250)
const result = run()
assert.deepEqual(result.errors, [])
assert.equal(result.total, 5954000)
assert.equal(run({ mode: 'actual', ticket: '2000000' }, [{ ...person, hotelActual: '600000' }]).total, 5164000)
assert.equal(run({ localActual: true, localCost: '500000' }).total, 5998000)
assert.equal(run({}, [person, { ...person, id: '2', name: 'Pegawai kedua' }]).total, 11908000)
assert.equal(run({ hotelProvided: true, ticketProvided: true, dailyProvided: true, originTrips: '0', destinationTrips: '0' }).total, 0)
assert.equal(run({ activity: 'fullboard' }, [{ ...person, nights: '0' }]).total, 3482000)
assert.equal(run({ activity: 'fullboard', before: true }, [{ ...person, nights: '1' }]).total, 4593000)
assert.equal(run({ activity: 'fullday' }, [{ ...person, nights: '0' }]).lines[0].amount, 0)
assert.equal(run({ activity: 'training' }).lines[0].amount, 330000)
assert.equal(run({ representationDuty: true }).lines.at(-1).amount, 0)
assert.equal(run({ representationDuty: true }, [{ ...person, position: 'echelon2' }]).lines.at(-1).amount, 450000)
assert.equal(hotelTier({ ...person, grade: 'IV/a' }), 2)
assert.equal(hotelTier({ ...person, position: 'echelon2' }), 1)
for (const changes of [{ end: '2026-10-04' }, { year: '2027' }, { start: '2026-02-30' }, { start: '' }, { ticket: '-1' }, { ticket: 'Infinity' }, { originTrips: '1.5' }, { activity: 'local' }, { mode: 'actual' }, { destination: 'Tidak terdaftar' }, { destinationProvince: 'Papua Tengah' }]) assert.equal(run(changes).total, null, JSON.stringify(changes))
assert.equal(run({ mode: 'actual', ticket: '2000000' }, [{ ...person, hotelActual: '900000' }]).total, null)
assert.equal(run({}, [{ ...person, nights: '3' }]).total, null)
assert.equal(run({}, [{ ...person, nip: '123' }]).total, null)
assert.equal(run({ activity: 'fullboard', before: true, after: true, start: '2026-10-06' }).total, null)
const manual = run({ rule: 'manual', year: '2027', start: '2027-10-05', end: '2027-10-07', ticket: '2000000' })
assert.deepEqual(manual.errors, [])
assert.equal(manual.total, 5300000)
assert.equal(duration('2028-02-28', '2028-03-01'), 3)
assert.equal(provinces.length, 38)
assert.equal(provinces.filter(p => p.transfer === null).length, 4)
const bytes = createWorkbook(trip, result)
const zip = new PizZip(bytes)
const sheet = zip.file('xl/worksheets/sheet3.xml').asText()
assert.ok(sheet.includes('<v>5954000</v>'))
assert.ok(sheet.includes('<f>T3*U3+X3+AA3</f>'))
assert.ok(zip.file('xl/worksheets/sheet4.xml').asText().includes('<f>SUM(U14:U14)</f>'))
assert.ok(sheet.includes('199001012020011001</t>'))
const dangerous = '=HYPERLINK("https://example.com") & <test>'
const safeSheet = new PizZip(createWorkbook(trip, run({}, [{ ...person, name: dangerous }]))).file('xl/worksheets/sheet3.xml').asText()
assert.ok(safeSheet.includes('=HYPERLINK(&quot;https://example.com&quot;) &amp; &lt;test&gt;'))
assert.ok(!safeSheet.includes('<f>=HYPERLINK'))
assert.throws(() => createWorkbook(trip, run({ start: '' })))
assert.throws(() => createWorkbook({ ...trip, signer: '' }, result), /Nama PPK/)
assert.equal(documentErrors(trip, [person]).length, 0)
assert.ok(documentErrors({ ...trip, sptDate: '2026-02-30' }, [person]).length)
assert.equal(terbilang(380000), 'tiga ratus delapan puluh ribu rupiah')
assert.equal(terbilang(0), 'nol rupiah')
assert.equal(terbilang(111001001), 'seratus sebelas juta seribu satu rupiah')
const templateTrip = { ...trip, rule: 'manual', transport: 'land', year: '2026', destinationProvince: 'DKI Jakarta', destination: 'Jakarta', activity: 'local', start: '2026-09-24', end: '2026-09-24', ticket: '170000', originTrips: '0', destinationTrips: '0', manual: { ...trip.manual, year: '2026', daily: '210000', hotel: '0' } }
const templatePerson = { ...person, nights: '0', expenses: [{ description: 'Transport DKI Jakarta', amount: '170000' }] }
const templateResult = calculate(templateTrip, [templatePerson])
assert.deepEqual(templateResult.errors, [])
assert.equal(templateResult.total, 380000)
assert.equal(calculate(templateTrip, [{ ...templatePerson, mealRate: '50000', mealDays: '1', snackRate: '10000', snackDays: '1' }]).total, 320000)
assert.equal(calculate(templateTrip, [{ ...templatePerson, mealRate: '300000', mealDays: '1' }]).total, null)
assert.equal(calculate(templateTrip, [{ ...templatePerson, expenses: [{ description: 'Transport', amount: '170001' }] }]).total, null)
assert.equal(calculate(templateTrip, [{ ...templatePerson, expenses: [{ description: '', amount: '100' }] }]).total, null)
assert.equal(calculate({ ...templateTrip, ticket: '' }, [{ ...templatePerson, ticket: '200000' }]).total, 410000)
assert.equal(calculate({ ...templateTrip, ppn: '-1' }, [templatePerson]).total, null)
assert.equal(calculate({ ...templateTrip, pph: '380001' }, [templatePerson]).total, null)
const shortTrip = { ...templateTrip, activity: 'localShort', ticket: '', originTrips: '2', destinationTrips: '2', representationDuty: true, localActual: true, localCost: '500000' }
const stalePerson = { ...templatePerson, nights: '8', hotelActual: '900000', position: 'echelon2', mealRate: '50000', mealDays: '1', snackRate: '10000', snackDays: '1' }
const shortResult = calculate(shortTrip, [stalePerson])
assert.deepEqual(shortResult.errors, [])
assert.equal(shortResult.total, 170000)
assert.equal(calculate({ ...shortTrip, rule: 'pmk2026' }, [stalePerson]).total, 170000)
assert.equal(calculate({ ...shortTrip, ticket: '0' }, [{ ...stalePerson, expenses: [] }]).total, 0)
assert.equal(calculate({ ...shortTrip, ticket: '-1' }, [stalePerson]).total, null)
assert.ok(shortResult.lines.filter(l => l.amount).every(l => l.component === 'Transportasi utama PP'))
assert.equal(calculate({ ...shortTrip, ticket: '185000' }, [stalePerson]).total, 185000)
assert.equal(calculate(shortTrip, [{ ...stalePerson, ticket: '200000' }]).total, 200000)
assert.equal(calculate({ ...shortTrip, end: '2026-09-25' }, [stalePerson]).total, null)
assert.equal(calculate({ ...shortTrip, destination: 'Bekasi' }, [stalePerson]).total, null)
assert.ok(documentErrors({ ...trip, budget: '', issueCity: '' }, [person]).length === 2)
writeFileSync('.next/nominatif-check/short-trip.xlsx', createWorkbook(shortTrip, shortResult))
const templateBytes = createWorkbook(templateTrip, templateResult)
const templateZip = new PizZip(templateBytes)
const originalZip = new PizZip(JSON.parse(readFileSync('lib/nominatif/template-original.json', 'utf8')).archive, { base64: true })
for (let n = 1; n <= 10; n++) {
  const path = `xl/worksheets/sheet${n}.xml`, before = originalZip.file(path).asText(), after = templateZip.file(path).asText()
  for (const tag of ['cols', 'sheetFormatPr', 'mergeCells', 'pageMargins', 'pageSetup', 'headerFooter', 'printOptions', 'drawing', 'legacyDrawing', 'rowBreaks', 'colBreaks']) {
    const pattern = new RegExp(`<${tag}\\b[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`, 'g')
    assert.deepEqual(after.match(pattern), before.match(pattern), `Original ${tag} preserved: ${n}`)
  }
  assert.deepEqual([...after.matchAll(/<row\b[^>]*>/g)].map(m => m[0]), [...before.matchAll(/<row\b[^>]*>/g)].map(m => m[0]), `Original row geometry: ${n}`)
  const styles = new Map([...after.matchAll(/<c\b([^>]*?)(?:\/>|>)/g)].map(m => [m[1].match(/r="([^"]+)"/)[1], Number(m[1].match(/s="(\d+)"/)?.[1] || 0)]))
  for (const cell of before.matchAll(/<c\b([^>]*?)(?:\/>|>)/g)) {
    const ref = cell[1].match(/r="([^"]+)"/)[1]
    assert.equal(styles.get(ref), Number(cell[1].match(/s="(\d+)"/)?.[1] || 0), `Original cell style: ${n}:${ref}`)
  }
}
assert.equal(templateZip.file('xl/styles.xml').asText(), originalZip.file('xl/styles.xml').asText())
for (const file of originalZip.file(/xl\/(media|printerSettings)\//)) assert.deepEqual(templateZip.file(file.name).asUint8Array(), file.asUint8Array(), `Original asset: ${file.name}`)
const names = [...templateZip.file('xl/workbook.xml').asText().matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1])
assert.deepEqual(names, ['XXXXX', '00000', ' DATA', 'nominatif-LS', 'nominatif-KPN', 'SPPD-Form', 'Kwitansi', 'Kartu Kendali TA.2018', 'Amplop', 'Lamp-Transport'])
for (const file of templateZip.file(/\.xml$/)) {
  const xml = file.asText()
  assert.ok(!/#REF!|<c[^>]* t="e"|externalLink|VLOOKUP|Elsimanata|8100126943691000|199609062022031013/.test(xml), file.name)

}
const getCell = (zip, n, ref) => zip.file(`xl/worksheets/sheet${n + 2}.xml`).asText().match(new RegExp(`<c r="${ref}"[^>]*>(.*?)</c>`))?.[1]
for (const [n, ref] of [[1, 'AS3'], [2, 'U15'], [3, 'N16'], [5, 'N17'], [5, 'X61'], [6, 'I13'], [7, 'U14']]) assert.ok(getCell(templateZip, n, ref).includes('<v>380000</v>'), `${n}:${ref}`)
assert.ok(getCell(templateZip, 8, 'H33').includes('<v>170000</v>'))
const taxedZip = new PizZip(createWorkbook({ ...templateTrip, ppn: '10000', pph: '5000' }, calculate({ ...templateTrip, ppn: '10000', pph: '5000' }, [templatePerson])))
assert.ok(getCell(taxedZip, 6, 'I17').includes('<v>365000</v>'))
for (const [n, ref] of [[1,'H3'],[2,'C14'],[3,'D15'],[4,'W16'],[8,'D14']]) assert.ok(getCell(templateZip,n,ref).includes('199001012020011001</t>'), `NIP stored verbatim ${n}:${ref}`)
const twoPeople = [{ ...templatePerson, advance: '100000' }, { ...templatePerson, id: '2', name: 'Pegawai kedua', spdNumber: 'SPD/02', ticket: '220000' }]
const twoResult = calculate(templateTrip, twoPeople)
assert.equal(twoResult.total, 810000)
const twoBytes = createWorkbook(templateTrip, twoResult), twoZip = new PizZip(twoBytes)
assert.equal([...twoZip.file('xl/workbook.xml').asText().matchAll(/<sheet name=/g)].length, 14)
assert.ok(getCell(twoZip, 2, 'U16').includes('<v>810000</v>'))
assert.ok(getCell(twoZip, 3, 'L16').includes('<v>46289</v>'))
assert.ok(getCell(twoZip, 5, 'K84').includes('<v>280000</v>'))
assert.ok(getCell(twoZip, 9, 'AC8').includes('SPD/02'))
assert.ok(getCell(twoZip, 10, 'X61').includes('<v>430000</v>'))
mkdirSync('.next/nominatif-check', { recursive: true })
writeFileSync('.next/nominatif-check/sample.xlsx', bytes)
writeFileSync('.next/nominatif-check/template-sample.xlsx', templateBytes)
writeFileSync('.next/nominatif-check/multiple-employees.xlsx', twoBytes)
console.log('Nominatif: calculations, template parity (Rp380,000), deductions, advances, per-person documents, and safe XLSX formulas passed.')
