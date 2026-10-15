import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PGlite } from '../.next/ahsp-sql-test/node_modules/@electric-sql/pglite/dist/index.js'
import { prepareLegacyItems, legacyImportSql, applyLegacyItems, LEGACY_REGULATION, LEGACY_NOTICE } from './prepare-ahsp-legacy.mjs'

const fields = [{ id: 'sda', name: 'Sumber Daya Air' }]
const row = { code: 'A.1', name: 'Alat Berat Excavator', unit: 'jam', job_type: 'informative', job_field_id: 'sda', regulasi_se: 'SE 182/2025, SE 47/2026' }
const duplicate = { ...row, name: ' ALAT BERAT  EXCAVATOR ', code: ' a.1 ' }
const raw = [row, duplicate, { ...row, code: 'A.2', name: "Pekerjaan ' dan $ahsp_items$", regulasi_se: 'SE 182/2025' }]
const original = JSON.stringify(raw)
const items = prepareLegacyItems(raw, fields)
assert.equal(items.length, 2)
assert.deepEqual(items[0].sipasti_rows, [1, 2])
assert.equal(JSON.stringify(raw), original)
assert.deepEqual(prepareLegacyItems(raw, fields), items)
assert.throws(() => prepareLegacyItems([{ ...row, regulasi_se: 'SE 47/2026' }], fields), /tidak valid/)
assert.throws(() => prepareLegacyItems([{ ...row, job_field_id: 'missing' }], fields), /tidak valid/)
assert.throws(() => prepareLegacyItems([row, { ...duplicate, job_type: 'normative' }], fields), /duplikat berbeda/)
const snapshot = { sha256: createHash('sha256').update(original).digest('hex'), sourceName: "SE147 ' export.json", rows: raw, items }
const db = new PGlite()
try {
  await db.exec('create role anon; create role authenticated; create role service_role;')
  for (const file of ['202610120001_ahsp_catalog.sql', '202610130007_ahsp_inline_matching.sql', '202610130008_ahsp_sipasti_reconciliation.sql', '202610140001_ahsp_phrase_search.sql', '202610140002_ahsp_archived_regulations.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  await db.exec(`insert into ahsp_items (id,code,name,unit,field,regulation,analysis_status,reconciliation_status)
    values ('00000000-0000-4000-8000-000000000001','A.1','Alat Berat Excavator','jam','Sumber Daya Air','SE 47/2026','unavailable','belum_ditemukan')`)
  const before = (await db.query("select to_jsonb(i) as item from ahsp_items i where regulation='SE 47/2026'")).rows
  const sql = legacyImportSql(snapshot)
  await db.exec(sql)
  await db.exec(sql)
  const archived = (await db.query("select * from ahsp_items where regulation='SE 182/2025' order by code")).rows
  assert.equal(archived.length, 2, 'Re-importing adds no duplicates')
  assert.ok(archived.every(item => item.regulation_status === LEGACY_NOTICE && item.analysis_status === 'unavailable' && item.components.length === 0 && item.source_id === null))
  assert.deepEqual((await db.query("select to_jsonb(i) as item from ahsp_items i where regulation='SE 47/2026'")).rows, before, 'Latest-edition data is unchanged')
  const search = async query => (await db.query(`select ahsp_search_items(${query}) as result`)).rows[0].result
  assert.equal((await search('')).total, 1, 'Default search contains active regulations only')
  const legacy = await search("p_regulation => 'SE 182/2025', p_terms => array['Alat Berat','Excavator'], p_match => 'phrases'")
  assert.equal(legacy.total, 1)
  assert.equal(legacy.archive_supported, true)
  assert.equal(legacy.items[0].regulation, LEGACY_REGULATION)
  const options = (await db.query('select ahsp_catalog_options() as result')).rows[0].result
  assert.equal(options.total, 3, 'Catalog metadata includes active editions and archive')
  const collided = { ...snapshot, items: [{ ...items[0], id: '00000000-0000-4000-8000-000000000001' }] }
  await assert.rejects(db.exec(legacyImportSql(collided)), /bert[a-z]+.*data/)
  await db.exec('rollback')
  assert.deepEqual((await db.query("select to_jsonb(i) as item from ahsp_items i where regulation='SE 47/2026'")).rows, before)
  let writes = 0
  const collisionDb = { from: () => ({ select: () => ({ in: async () => ({ data: [{ ...items[0], regulation: 'SE 47/2026' }] }) }), upsert: () => { writes++; throw new Error('Unexpected write') } }) }
  await assert.rejects(applyLegacyItems(collisionDb, snapshot), /bertabrakan/)
  assert.equal(writes, 0, 'Direct importer completes collision checks before any write')
  if (process.argv[2]) {
    const bytes = readFileSync(process.argv[2])
    const rows = Object.values(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')))[0]
    const fields = JSON.parse(readFileSync(process.argv[3], 'utf8')).fields
    const fullItems = prepareLegacyItems(rows, fields)
    const full = { sha256: createHash('sha256').update(bytes).digest('hex'), sourceName: 'user-export.json', rows, items: fullItems }
    await db.exec(legacyImportSql(full))
    await db.exec(legacyImportSql(full))
    const count = (await db.query("select count(*)::integer as total from ahsp_items where regulation='SE 182/2025'")).rows[0].total
    assert.equal(count, fullItems.length + 2)
    assert.deepEqual((await db.query("select to_jsonb(i) as item from ahsp_items i where regulation='SE 47/2026'")).rows, before)
    console.log(`Full export: ${rows.length} rows, ${fullItems.length} unique archive items, repeated import passed.`)
  }
  console.log('AHSP archive: validation, provenance, SQL escaping, idempotence, collision protection, active default, and archive phrase search passed.')
} finally { await db.close() }
