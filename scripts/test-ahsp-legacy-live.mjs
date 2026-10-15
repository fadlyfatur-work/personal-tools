import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { prepareLegacyItems, LEGACY_REGULATION, LEGACY_NOTICE } from './prepare-ahsp-legacy.mjs'

if (!process.argv[2]) throw new Error('Gunakan: node --env-file=.env.local scripts/test-ahsp-legacy-live.mjs <ekspor.json>')
const bytes = readFileSync(process.argv[2])
const rows = Object.values(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')))[0]
const sha256 = createHash('sha256').update(bytes).digest('hex')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const fields = await db.from('ahsp_master_fields').select('id,name')
if (fields.error) throw new Error('Daftar bidang belum dapat diperiksa.')
const expected = prepareLegacyItems(rows, fields.data)
const expectedById = new Map(expected.map(item => [item.id, item]))
const archive = []
for (let start = 0;; start += 1000) {
  const result = await db.from('ahsp_items').select('id,code,name,unit,field,ahsp_type,regulation_status,analysis_status,components,source_id,page_from,sipasti_status,sipasti_sha256,sipasti_rows').eq('regulation', LEGACY_REGULATION).order('id').range(start, start + 999)
  if (result.error) throw new Error('Data arsip belum dapat diperiksa.')
  archive.push(...result.data)
  if (result.data.length < 1000) break
}
const imported = archive.filter(item => expectedById.has(item.id))
assert.equal(imported.length, expected.length)
for (const item of imported) {
  const expectedItem = expectedById.get(item.id)
  for (const key of ['code', 'name', 'unit', 'field', 'ahsp_type', 'sipasti_rows']) assert.deepEqual(item[key], expectedItem[key])
  assert.equal(item.regulation_status, LEGACY_NOTICE)
  assert.equal(item.analysis_status, 'unavailable')
  assert.deepEqual(item.components, [])
  assert.equal(item.source_id, null)
  assert.equal(item.page_from, null)
  assert.equal(item.sipasti_status, 'sipasti_only')
  assert.equal(item.sipasti_sha256, sha256)
}
const active = await db.from('ahsp_items').select('id', { head: true, count: 'exact' }).in('regulation', ['SE 47/2026', 'PERMEN 08/2023'])
const all = await db.from('ahsp_items').select('id', { head: true, count: 'exact' })
if (active.error || all.error) throw new Error('Jumlah katalog belum dapat diperiksa.')
console.log(JSON.stringify({ imported: imported.length, archived: archive.length, active: active.count, total: all.count, sample_archive_id: expected[0].id, checks: 'identity, replacement tag, unavailable analysis, provenance passed' }, null, 2))
