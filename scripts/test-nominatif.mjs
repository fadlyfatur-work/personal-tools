import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', 'lib/nominatif/calculate.ts', 'lib/nominatif/excel.ts', '--outDir', '.next/nominatif-check', '--module', 'commonjs', '--target', 'es2020', '--resolveJsonModule', '--esModuleInterop', '--skipLibCheck'], { stdio: 'inherit' })
const { calculate, duration, provinces, hotelTier } = require('../.next/nominatif-check/calculate.js')
const { createWorkbook } = require('../.next/nominatif-check/excel.js')
const PizZip = require('pizzip')
const person = { id: '1', name: 'Pegawai contoh', nip: '199001012020011001', grade: 'III/a', position: 'staff', nights: '2', hotelActual: '' }
const trip = {
  rule: 'pmk2026', mode: 'estimate', year: '2026', purpose: 'Koordinasi', originProvince: 'DKI Jakarta', destinationProvince: 'Sumatra Selatan', origin: 'Jakarta', destination: 'Palembang', start: '2026-10-05', end: '2026-10-07', activity: 'ordinary', before: false, after: false,
  transport: 'plane', ticket: '', ticketProvided: false, originTrips: '2', destinationTrips: '2', originRate: '', destinationRate: '', dailyProvided: false, hotelProvided: false, localActual: false, localCost: '', representationDuty: false,
  manual: { name: 'Aturan uji 2027', year: '2027', daily: '400000', hotel: '700000', representation: '0', originTransfer: '200000', destinationTransfer: '150000', localPercent: '50' },
}
const run = (changes = {}, employees = [person]) => calculate({ ...trip, ...changes }, employees)
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
const sheet = zip.file('xl/worksheets/sheet1.xml').asText()
assert.ok(sheet.includes('<v>5954000</v>'))
assert.ok(sheet.includes('<f>F8*H8</f>'))
assert.ok(sheet.includes('<f>SUM(I8:I13)</f>'))
assert.ok(sheet.includes('199001012020011001</t>'))
const dangerous = '=HYPERLINK("https://example.com") & <test>'
const safeSheet = new PizZip(createWorkbook(trip, run({}, [{ ...person, name: dangerous }]))).file('xl/worksheets/sheet1.xml').asText()
assert.ok(safeSheet.includes('=HYPERLINK(&quot;https://example.com&quot;) &amp; &lt;test&gt;'))
assert.ok(!safeSheet.includes('<f>=HYPERLINK'))
assert.throws(() => createWorkbook(trip, run({ start: '' })))
mkdirSync('.next/nominatif-check', { recursive: true })
writeFileSync('.next/nominatif-check/sample.xlsx', bytes)
console.log('Nominatif: calculation, validation, custom rules, multiple employees, and XLSX checks passed.')
