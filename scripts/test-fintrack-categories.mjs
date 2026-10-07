import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, imports = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: name => imports[name] })
  return exports
}
const helpers = load('lib/fintrackCategories.ts')
const categories = [
  { id: 'food', name: 'Makanan', type: 'expense', budget_mode: 'children' },
  { id: 'coffee', parent_id: 'food', name: 'Kopi', budget_amount: 100 },
  { id: 'lunch', parent_id: 'food', name: 'Makan siang', budget_amount: 200 },
  { id: 'old', parent_id: 'food', name: 'Lama', budget_amount: 900, archived_at: '2026-01-01' },
  { id: 'other', name: 'Makanan', type: 'expense', budget_amount: 500 },
]
const transactions = [
  { id: '1', category_id: 'coffee', type: 'expense', amount: 50, transaction_date: '2026-10-01' },
  { id: '2', category_id: 'lunch', type: 'expense', amount: 150, transaction_date: '2026-10-02' },
  { id: '3', category_id: 'food', type: 'expense', amount: 20, transaction_date: '2026-10-03' },
  { id: '4', category_id: 'other', type: 'expense', amount: 30, transaction_date: '2026-10-04' },
  { id: '5', type: 'transfer', amount: 900, transaction_date: '2026-10-04' },
]
assert.equal(helpers.categoryBudget(categories[0], categories), 300)
assert.equal(helpers.categoryBudget({ ...categories[0], budget_mode: 'fixed', budget_amount: 400 }, categories), 400)
const macro = helpers.categorySlices(transactions, categories, 'expense')
assert.equal(macro.length, 2, 'Same-name parents remain separate')
assert.equal(macro[0].amount, 220, 'Parent includes child spending and direct transactions')
const detail = helpers.categorySlices(transactions, categories, 'expense', 'food')
assert.equal(detail.length, 3)
assert.equal(detail.reduce((sum, item) => sum + item.amount, 0), 220)
assert.equal(helpers.categorySlices(transactions, categories, 'expense', null, false).find(item => item.category_id === 'coffee').amount, 50)
const reports = load('lib/fintrackReport.ts', { '@/lib/fintrackCategories': helpers })
const report = reports.buildFintrackReport('2026-10', 1, [...transactions, transactions[0]], categories)
assert.equal(report.expense[0].amount, 220, 'Duplicate transaction IDs do not inflate totals')
assert.equal(report.category_expense.find(item => item.category_id === 'lunch').amount, 150)
console.log('PASS: parent budgets, archived allocations, macro grouping, parent detail, direct spending, transfer exclusion, deduplication and full-period child totals.')
