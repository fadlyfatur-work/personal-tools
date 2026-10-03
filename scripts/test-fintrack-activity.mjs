// Run: node scripts/test-fintrack-activity.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, imports = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] } })
  return exports
}
const ordering = load('lib/fintrackOrdering.ts')
const budgets = [{ used: 900, budget: 1000 }, { used: 120, budget: 100 }, { used: 91, budget: 100 }]
assert.deepEqual([...budgets].sort(ordering.compareBudgetUsage).map(item => item.used), [120, 91, 900])
assert.ok(ordering.compareBudgetUsage({ used: 904, budget: 1000 }, { used: 901, budget: 1000 }) < 0, 'Sort exact ratios before rounding display percentages')
const categories = [{ name: 'Jarang', usage_count: 1 }, { name: 'Sering', usage_count: 8 }, { name: 'Baru' }, { name: 'Abjad', usage_count: 1 }]
assert.deepEqual([...categories].sort(ordering.compareCategoryUsage).map(item => item.name), ['Sering', 'Abjad', 'Jarang', 'Baru'])

const transactions = Array.from({ length: 25 }, (_, i) => ({ id: String(i), note: i >= 11 ? `Kopi kantor ${i}` : 'Belanja', type: i === 24 ? 'income' : 'expense', category_id: 'food' }))
transactions.push({ id: 'no-note', note: null, type: 'expense', category_id: null })
const report = { income: [], expense: [{ category_id: 'food', category_ids: ['food'] }], transactions }
const route = load('app/api/fintrack/reports/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@/lib/fintrackReport': { getFintrackReport: async () => report },
  '@/lib/fintrackUser': { requireFintrackIdentity: async () => ({ identity: { id: 'test-user' } }) },
  '@/lib/supabaseAdmin': {},
  '@/lib/fintrackOrdering': ordering,
})
const request = query => route.GET({ nextUrl: new URL(`http://localhost/api/fintrack/reports?month=2026-10&${query}`) })
const first = await (await request('q=%20KOPI%20&category_id=food&transaction_type=expense')).json()
assert.equal(first.data.transaction_total, 13)
assert.equal(first.data.transactions.length, 10)
assert.equal(first.data.transactions[0].id, '11', 'Search must include records beyond the unfiltered first page')
const second = await (await request('q=kopi&category_id=food&transaction_type=expense&page=2')).json()
assert.equal(second.data.transactions.length, 3)
assert.equal(second.data.transactions[0].id, '21')
const empty = await (await request('q=does-not-exist')).json()
assert.equal(empty.data.transaction_total, 0)
const noCategory = await (await request('category_id=__none__')).json()
assert.equal(noCategory.data.transaction_total, 1)
assert.equal(noCategory.data.transactions[0].id, 'no-note')
const clearSearch = await (await request('q=')).json()
assert.equal(clearSearch.data.transaction_total, 26)
assert.equal((await request(`q=${'x'.repeat(101)}`)).status, 400)
assert.equal((await request('account_id=invalid')).status, 400)
console.log('PASS: budget ratios, category frequency/ties, note search before pagination, combined filters and validation.')
