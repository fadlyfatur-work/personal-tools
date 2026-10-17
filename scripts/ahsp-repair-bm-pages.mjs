import fs from 'node:fs'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const [file, mode] = process.argv.slice(2)
assert.ok(file && (!mode || mode === '--apply'), 'Usage: node --env-file=.env.local scripts/ahsp-repair-bm-pages.mjs repairs.json [--apply]')
const plan = JSON.parse(fs.readFileSync(file, 'utf8'))
assert.equal(plan.source_id, '10903')
assert.ok(plan.patches.length > 0)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const source = await db.from('ahsp_sources').select('sha256').eq('id', plan.source_id).single()
assert.ifError(source.error)
assert.equal(source.data.sha256, plan.sha256, 'Official PDF must match the catalog source fingerprint')
const prepared = []
for (const patch of plan.patches) {
  const { before, after } = patch
  assert.equal(before.field, 'Bina Marga')
  assert.equal(before.regulation, 'SE 47/2026')
  assert.equal(before.components.length, 0)
  assert.ok(!before.analysis_target_id)
  assert.deepEqual(Object.keys(after).sort(), ['page_from', 'page_to', 'printed_page', 'source_id', 'source_text'])
  assert.ok(after.page_from > 30 && after.page_to >= after.page_from)
  const result = await db.from('ahsp_items').select('*').eq('id', before.id).single()
  assert.ifError(result.error)
  const current = result.data
  for (const key of ['code', 'name', 'unit', 'field', 'regulation', 'source_id', 'page_from', 'page_to', 'source_text']) assert.deepEqual(current[key], before[key], `Stale repair plan: ${before.code} ${key}`)
  assert.equal(current.components.length, 0)
  assert.ok(!current.analysis_target_id)
  const references = await db.from('ahsp_items').select('id').eq('analysis_target_id', before.id).limit(1)
  assert.ifError(references.error)
  assert.equal(references.data.length, 0, 'Repair must not invalidate a linked analysis fingerprint')
  prepared.push({ before: current, after })
}
if (mode === '--apply') {
  const backup = file + '.backup.json'
  fs.writeFileSync(backup, JSON.stringify(prepared, null, 2), { flag: 'wx' })
  for (const { before, after } of prepared) {
    const update = await db.from('ahsp_items').update(after).eq('id', before.id).eq('source_text', before.source_text).eq('page_from', before.page_from).eq('code', before.code).eq('components', '[]').is('analysis_target_id', null).select('id,page_from,page_to')
    assert.ifError(update.error)
    assert.equal(update.data.length, 1, 'Concurrent source change; stop and inspect backup before retrying')
    console.log('REPAIRED', before.code, update.data[0].page_from, update.data[0].page_to)
  }
} else console.log('VERIFIED DRY RUN', prepared.length, 'source/page-only repairs; PDF SHA-256 and current records match.')
