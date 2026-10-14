import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports })
  return exports
}
const presentation = load('lib/fintrackPresentation.ts')
const now = new Date('2026-10-12T18:30:00Z')
assert.equal(presentation.jakartaDate(now), '2026-10-13')
assert.equal(presentation.transactionDayLabel('2026-10-13', now), 'Hari ini')
assert.equal(presentation.transactionDayLabel('2026-10-12', now), 'Kemarin')
assert.equal(presentation.transactionDayLabel('2026-10-11', now), '11 Oktober 2026')
assert.equal(presentation.calendarCells('2026-10').filter(Boolean).length, 31)
assert.equal(presentation.calendarCells('2026-10')[3], '2026-10-01')
assert.equal(presentation.calendarCells('2024-02').filter(Boolean).length, 29)
const groups = presentation.groupTransactions([{ id: 'a', transaction_date: '2026-10-12' }, { id: 'b', transaction_date: '2026-10-13' }, { id: 'c', transaction_date: '2026-10-12' }])
assert.deepEqual(Array.from(groups, ([day, items]) => [day, Array.from(items, item => item.id)]), [['2026-10-13', ['b']], ['2026-10-12', ['a', 'c']]])
const providers = load('lib/fintrackProviders.ts')
assert.equal(providers.validProvider('bca', 'bank'), true)
assert.equal(providers.validProvider('dana', 'ewallet'), true)
assert.equal(providers.validProvider('bca', 'cash'), false)
assert.equal(providers.validProvider('unknown', 'bank'), false)
assert.equal(providers.validProvider(null, 'cash'), true)
const sources = JSON.parse(fs.readFileSync('public/fintrack/providers/sources.json', 'utf8'))
for (const provider of providers.walletProviders) {
  assert.ok(sources[provider.code]?.url, `Missing provenance for ${provider.code}`)
  assert.ok(fs.statSync(`public${sources[provider.code].path}`).size > 50)
}
console.log('PASS: Jakarta day groups, leap calendar, provider/type validation, nine local assets and source provenance.')
