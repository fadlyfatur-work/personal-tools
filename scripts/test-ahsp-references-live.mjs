import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { webcrypto } from 'node:crypto'

const load = (path, imports = {}) => {
  const exports = {}
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(code, { exports, require: name => imports[name], Response, URL, URLSearchParams, crypto: webcrypto, console })
  return exports
}
const core = load('lib/ahsp.ts')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const route = load('app/api/ahsp/route.ts', { zod: { z }, '@/lib/ahsp': core, '@/lib/supabaseAdmin': { getSupabaseAdmin: () => db } })
const get = async query => {
  const response = await route.GET(new Request(`http://localhost/api/ahsp?${query}`))
  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  return body
}
for (const [code, targetCode, ready] of [['1.1.1.3', 'U.1.1.3 (c)', true], ['1.1.1.2', 'U.1.1.2 (c)', false], ['1.3.1.5', 'U.3.5.1.e (a)', true]]) {
  const list = await get(`q=${code}&match=exact`)
  const row = list.items.find(item => item.code === code)
  assert.equal(row.analysis_reference.target_code, targetCode)
  assert.equal(row.analysis_reference.source_fingerprint, undefined, 'List responses omit internal analysis signatures')
  const detail = await get(`id=${row.id}`)
  assert.equal(detail.item.code, code, 'The original work item identity stays intact')
  assert.equal(detail.reference_target.code, targetCode)
  assert.equal(detail.reference_ready, ready)
  if (ready) {
    const target = detail.reference_target
    const calc = core.calculateAhsp(target, { volume: 1, overhead: target.overhead_min ?? 10, coefficients: {}, prices: Object.fromEntries(target.components.map(c => [c.id, 100])) })
    assert.ok(calc.total > 0)
    assert.equal(core.canUseAhspReference(detail.item, { ...target, output_quantity: target.output_quantity + 1 }), false, 'Stale target data cannot silently keep automatic calculation enabled')
  }
  console.log(JSON.stringify({ code, targetCode, ready, originPage: detail.item.analysis_reference.source_page, targetPage: detail.reference_target.page_from }))
}
const all = await get('')
assert.equal(all.total, 6377)
console.log('Live API handler + PostgreSQL: reference labels, target resolution, original identity, ready/review gating, stale analysis protection, calculation, and unchanged catalogue count passed.')
