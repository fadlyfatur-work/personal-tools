import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { z } from 'zod'

function load(file, imports = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name] } })
  return exports
}
const { goalProgress } = load('lib/fintrackGoals.ts')
const progress = (balance, spent, target = 30000000) => goalProgress({ current_balance: balance, spent, target_amount: target })
assert.equal(progress(12000000, 0).funded, 12000000)
assert.equal(progress(7000000, 5000000).funded, 12000000, 'Spending on the goal preserves funding progress')
assert.equal(progress(5000000, 5000000).remaining, 20000000, 'Withdrawing reduces goal funding')
assert.equal(progress(40000000, 0).percentage, 100)
assert.equal(progress(-500, 0).funded, 0)
assert.equal(progress(100, 0, 0).percentage, 0)

const ownerId = '11111111-1111-4111-8111-111111111111'
const itemId = '22222222-2222-4222-8222-222222222222'
const txnId = '33333333-3333-4333-8333-333333333333'
let authorized = true
let rpcError = null
const calls = []
const imports = {
  zod: { z },
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@/lib/supabaseAdmin': { supabaseAdmin: { rpc: async (name, args) => { calls.push({ name, args }); return { data: { id: txnId, ...args }, error: rpcError } } } },
  '@/lib/fintrackUser': { requireFintrackIdentity: async () => authorized ? { identity: { id: ownerId } } : { identity: null, response: Response.json({}, { status: 401 }) } },
  '@/lib/fintrackPin': { requireSensitivePin: async () => null },
}
const transactions = load('app/api/fintrack/transactions/route.ts', imports)
const editing = load('app/api/fintrack/transactions/[id]/route.ts', imports)
const goals = load('app/api/fintrack/goals/route.ts', imports)
const req = body => ({ json: async () => body })
const body = { type: 'expense', amount: 125000, from_account_id: ownerId, transaction_date: '2026-10-04' }
assert.equal((await transactions.POST(req(body))).status, 201)
assert.equal(calls.at(-1).name, 'fintrack_create_transaction', 'Ordinary transactions keep working before migration')
assert.equal((await transactions.POST(req({ ...body, goal_item_id: itemId }))).status, 201)
assert.equal(calls.at(-1).name, 'fintrack_save_goal_transaction')
assert.equal(calls.at(-1).args.p_goal_item_id, itemId)
assert.equal((await editing.PUT(req({ ...body, goal_item_id: null }), { params: Promise.resolve({ id: txnId }) })).status, 200)
assert.equal(calls.at(-1).args.p_transaction_id, txnId)
assert.equal(calls.at(-1).args.p_goal_item_id, null, 'Editing can detach an item atomically')
const before = calls.length
assert.equal((await transactions.POST(req({ ...body, amount: -1 }))).status, 400)
assert.equal((await transactions.POST(req({ ...body, goal_item_id: 'invalid' }))).status, 400)
assert.equal((await goals.POST(req({ name: 'Liburan', target_amount: 0 }))).status, 400)
assert.equal(calls.length, before, 'Invalid writes never reach the database')
rpcError = { message: 'FINTRACK_NEGATIVE_BALANCE' }
assert.equal((await transactions.POST(req({ ...body, goal_item_id: itemId }))).status, 409)
rpcError = null
assert.equal((await goals.POST(req({ name: 'Liburan', target_amount: 30000000 }))).status, 201)
assert.equal(calls.at(-1).name, 'fintrack_create_goal', 'Goal and wallet are created by one RPC')
authorized = false
assert.equal((await goals.POST(req({ name: 'Liburan', target_amount: 30000000 }))).status, 401)
assert.equal((await transactions.POST(req(body))).status, 401)
console.log('FinTrack Goals: progress, validation, authentication, and atomic RPC routing passed')
