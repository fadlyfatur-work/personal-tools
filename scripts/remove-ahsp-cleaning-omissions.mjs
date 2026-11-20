import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const root = 'anti-slop/ahsp-master-2026-11-19/cleaning-1502'
const csv = readFileSync(`${root}/imported-not-in-cleaned-source.csv`, 'utf8').replace(/^\uFEFF/, '')
const lines = csv.trim().split(/\r?\n/)
assert.equal(lines[0], '"id","code","name","field","regulation","unit","verification_status"')
const expected = lines.slice(1).map(line => {
  const values = line.match(/^"([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"$/)
  assert.ok(values, `Baris CSV tidak valid: ${line}`)
  const [, id, code, name, field, regulation, unit, verification_status] = values
  assert.match(id, /^[0-9a-f-]{36}$/i)
  return { id, code, name, field, regulation, unit, verification_status }
})
assert.equal(expected.length, 44)
assert.equal(new Set(expected.map(row => row.id)).size, 44)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const ids = expected.map(row => row.id)
const { data: rows, error } = await db.from('ahsp_items').select('*').in('id', ids)
assert.ifError(error)
assert.equal(rows.length, 44, 'Jumlah item database harus tepat 44')
const byId = new Map(rows.map(row => [row.id, row]))
for (const item of expected) {
  const row = byId.get(item.id)
  assert.ok(row, `ID tidak ditemukan: ${item.id}`)
  for (const key of ['code', 'name', 'field', 'regulation', 'unit', 'verification_status']) {
    assert.equal(row[key], item[key], `${key} berubah untuk ${item.id}`)
  }
  assert.equal(row.verification_status, 'needs_review', `Status berubah untuk ${item.id}`)
  assert.equal(row.analysis_status, 'unavailable', `Status analisis berubah untuk ${item.id}`)
  assert.deepEqual(row.components, [], `Komponen ditemukan untuk ${item.id}`)
  assert.equal(row.source_id, null, `Referensi sumber ditemukan untuk ${item.id}`)
}

const references = [
  ['ahsp_master_changes', 'item_id'],
  ['ahsp_master_rows', 'item_id'],
  ['ahsp_items', 'analysis_target_id'],
]
for (const [table, column] of references) {
  const result = await db.from(table).select(column).in(column, ids).limit(1)
  assert.ifError(result.error)
  assert.equal(result.data.length, 0, `Ada relasi masuk dari ${table}.${column}`)
}

const mode = process.argv.includes('--apply') ? 'apply' : 'preflight'
const summary = {
  mode,
  checked_at: new Date().toISOString(),
  count: rows.length,
  by_regulation: rows.reduce((counts, row) => ((counts[row.regulation] = (counts[row.regulation] ?? 0) + 1), counts), {}),
  by_field: rows.reduce((counts, row) => ((counts[row.field] = (counts[row.field] ?? 0) + 1), counts), {}),
  matching_needs_review_empty_analysis: true,
  incoming_references: 0,
}

if (mode === 'preflight') {
  console.log(JSON.stringify(summary, null, 2))
} else {
  const backupPath = resolve(root, 'removal-backup.json')
  mkdirSync(dirname(backupPath), { recursive: true })
  writeFileSync(backupPath, JSON.stringify({ ...summary, rows }, null, 2))
  const removed = await db.from('ahsp_items').delete().in('id', ids).select('id')
  assert.ifError(removed.error)
  assert.equal(removed.data.length, 44, 'Jumlah item yang dihapus harus tepat 44')
  const remaining = await db.from('ahsp_items').select('id').in('id', ids)
  assert.ifError(remaining.error)
  assert.equal(remaining.data.length, 0, 'Sebagian item masih ditemukan setelah penghapusan')
  const inCatalog = await db.from('ahsp_catalog_versions').select('id').in('id', ids)
  assert.ifError(inCatalog.error)
  assert.equal(inCatalog.data.length, 0, 'Sebagian item masih terlihat pada katalog')
  summary.deleted = removed.data.length
  summary.remaining_in_items = remaining.data.length
  summary.remaining_in_catalog = inCatalog.data.length
  summary.backup_path = backupPath
  writeFileSync(backupPath, JSON.stringify({ ...summary, rows }, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}
