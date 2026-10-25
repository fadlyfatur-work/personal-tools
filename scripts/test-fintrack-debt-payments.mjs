import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/fintrackCategories.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports })
const payment = { id: 'pay', type: 'transfer', debt_payment_expense: true, category_id: 'shopping', amount: 250000 }
assert.equal(exports.categorySlices([payment], [{ id: 'shopping', name: 'Belanja' }], 'expense')[0]?.amount, 250000, 'Categorized repayment must be included as an expense exactly once')
assert.equal(exports.categorySlices([{ ...payment, debt_payment_expense: false }], [], 'expense').length, 0, 'Ordinary transfers remain excluded')
assert.equal(exports.categorySlices([{ ...payment, category_id: null }], [], 'expense')[0].name, 'Tanpa kategori')
assert.equal(payment.type, 'transfer', 'Reporting must not rewrite ledger type or balance behavior')
console.log('Debt payment category reporting passed')

const reportExports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/fintrackReport.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports: reportExports, require: name => name === '@/lib/fintrackCategories' ? exports : {} })
const rows = [{ ...payment, transaction_date: '2026-10-25' }, { ...payment, id: 'ordinary-transfer', debt_payment_expense: false, transaction_date: '2026-10-25' }]
const report = reportExports.buildFintrackReport('2026-10', 1, rows, [{ id: 'shopping', name: 'Belanja' }])
assert.equal(report.expense[0].amount, 250000)
assert.equal(report.daily.find(day => day.day === '2026-10-25').expense, 250000)
assert.equal(report.weekly.reduce((sum, week) => sum + week.expense, 0), 250000)
assert.equal(report.monthly.at(-1).expense, 250000)
assert.equal(report.transactions[0].type, 'transfer')
console.log('Debt payment daily, weekly, monthly and category totals passed')
