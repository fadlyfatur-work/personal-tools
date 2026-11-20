import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += '"'; index += 1 }
      else if (char === '"') quoted = false
      else value += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(value); value = '' }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = '' }
    else value += char
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row) }
  const [header, ...data] = rows
  return data.filter(values => values.some(Boolean)).map(values =>
    Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])))
}

const root = 'anti-slop/ahsp-master-2026-11-19/cleaning-1502'
const clean = parseCsv(readFileSync(`${root}/unit-corrections.csv`, 'utf8').replace(/^\uFEFF/, ''))
const impact = parseCsv(readFileSync(`${root}/import-impact.csv`, 'utf8').replace(/^\uFEFF/, ''))
assert.equal(clean.length, 12)
const expected = clean.map(correction => {
  const matches = impact.filter(row => row.code === correction.code && row.name === correction.name &&
    row.field === correction.bidang && row.regulation === correction.regulasi_se && row.cleaning_status === 'unit_difference')
  assert.equal(matches.length, 1, `Pemetaan DB harus tepat satu untuk ${correction.code}`)
  assert.equal(matches[0].unit, correction.before_unit, `Unit awal rencana berubah: ${correction.code}`)
  assert.deepEqual(JSON.parse(matches[0].cleaned_units), [correction.after_unit])
  return { ...correction, id: matches[0].id }
})
assert.equal(new Set(expected.map(item => item.id)).size, 12)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const ids = expected.map(item => item.id)
const current = await db.from('ahsp_items').select('*').in('id', ids)
assert.ifError(current.error)
assert.equal(current.data.length, 12)
const byId = new Map(current.data.map(row => [row.id, row]))
let toUpdate = 0
for (const item of expected) {
  const row = byId.get(item.id)
  assert.ok(row)
  for (const key of ['code', 'name', 'field', 'regulation']) assert.equal(row[key], item[key === 'field' ? 'bidang' : key === 'regulation' ? 'regulasi_se' : key], `${key} berubah: ${item.code}`)
  assert.ok(row.unit === item.before_unit || row.unit === item.after_unit, `Satuan tidak cocok: ${item.code}`)
  assert.equal(row.verification_status, 'needs_review')
  assert.equal(row.analysis_status, 'unavailable')
  assert.deepEqual(row.components, [])
  assert.equal(row.source_id, null)
  if (row.unit === item.before_unit) toUpdate += 1
}

const mode = process.argv.includes('--apply') ? 'apply' : 'preflight'
if (mode === 'preflight') {
  console.log(JSON.stringify({ mode, matching_items: expected.length, requiring_update: toUpdate,
    target_units: expected.reduce((counts, item) => ((counts[item.after_unit] = (counts[item.after_unit] ?? 0) + 1), counts), {}) }, null, 2))
} else {
  const backupPath = resolve(root, 'unit-update-backup.json')
  mkdirSync(dirname(backupPath), { recursive: true })
  const summary = { mode: 'apply', checked_at: new Date().toISOString(), planned: 12, before_update: current.data }
  writeFileSync(backupPath, JSON.stringify(summary, null, 2))

  for (const unit of [...new Set(expected.map(item => item.after_unit))]) {
    const unitIds = expected.filter(item => item.after_unit === unit && byId.get(item.id).unit === item.before_unit).map(item => item.id)
    if (!unitIds.length) continue
    const result = await db.from('ahsp_items').update({ unit }).in('id', unitIds).eq('unit', '').select('id')
    assert.ifError(result.error)
    assert.equal(result.data.length, unitIds.length, `Jumlah update satuan ${unit} tidak sesuai`)
  }

  const after = await db.from('ahsp_items').select('id,code,name,field,regulation,unit').in('id', ids)
  assert.ifError(after.error)
  assert.equal(after.data.length, 12)
  const afterById = new Map(after.data.map(row => [row.id, row]))
  for (const item of expected) {
    const row = afterById.get(item.id)
    assert.equal(row.unit, item.after_unit, `Satuan belum sesuai clean: ${item.code}`)
  }
  const result = {
    mode: 'apply',
    checked_at: summary.checked_at,
    updated: toUpdate,
    already_current: 12 - toUpdate,
    units: expected.reduce((counts, item) => ((counts[item.after_unit] = (counts[item.after_unit] ?? 0) + 1), counts), {}),
    verified_clean_units: after.data.length,
    backup_path: backupPath,
  }
  writeFileSync(backupPath, JSON.stringify({ ...result, before_update: current.data, after_update: after.data }, null, 2))
  console.log(JSON.stringify(result, null, 2))
}
