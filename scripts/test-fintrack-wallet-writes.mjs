import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { z } from 'zod'

let written, databaseError = null
const database = {
  from() {
    const query = {
      select() { return query }, eq() { return query }, order() { return query }, limit() { return query },
      insert(value) { written = value; return query },
      update(value) { written = value; return query },
      async maybeSingle() { return { data: { sort_order: 0 } } },
      async single() { return { data: { kind: 'bank', ...written }, error: databaseError } },
    }
    return query
  },
}
function load(file, imports = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require(name) { assert.ok(name in imports, name); return imports[name] },
  })
  return exports
}
const imports = {
  'zod': { z },
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@/lib/fintrackProviders': load('lib/fintrackProviders.ts'),
  '@/lib/supabaseAdmin': { supabaseAdmin: database },
  '@/lib/fintrackUser': {
    requireFintrackIdentity: async () => ({ identity: { id: 'user' } }),
    getOwnedPlanId: async () => 'plan',
    getAccountAccess: async () => ({ canManage: true, role: 'owner' }),
  },
}
const create = load('app/api/fintrack/accounts/route.ts', imports)
const update = load('app/api/fintrack/accounts/[id]/route.ts', imports)
const request = body => ({ json: async () => body })
const context = { params: Promise.resolve({ id: 'goal-wallet' }) }

const investment = await create.POST(request({ name: 'Investasi', kind: 'investment', initial_balance: 50000, provider_code: null }))
assert.equal(investment.status, 201)
assert.equal(written.kind, 'investment')
assert.equal(written.current_balance, 50000)
assert.equal(Object.hasOwn(written, 'provider_code'), false, 'No provider column dependency for ordinary wallets')

assert.equal((await update.PUT(request({ name: 'Tujuan baru' }), context)).status, 200)
assert.equal(written.name, 'Tujuan baru')
assert.equal(Object.hasOwn(written, 'provider_code'), false, 'Renaming must not write provider metadata')

assert.equal((await update.PUT(request({ provider_code: null }), context)).status, 200)
assert.equal(written.provider_code, null, 'Explicit provider removal must remain supported')

databaseError = { code: 'PGRST204', message: "Could not find the 'provider_code' column" }
const provider = await create.POST(request({ name: 'Bank', kind: 'bank', provider_code: 'bca' }))
assert.equal(provider.status, 500)
assert.match((await provider.json()).error, /202610130010_fintrack_wallet_provider.sql/)
const providerUpdate = await update.PUT(request({ provider_code: 'bca' }), context)
assert.match((await providerUpdate.json()).error, /202610130010_fintrack_wallet_provider.sql/)
console.log('PASS: investment creation, goal-wallet rename, explicit provider removal, and missing-migration errors.')
