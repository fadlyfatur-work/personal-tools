import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const canonicalId = '12c27bb3-fc35-5264-839b-8ee1059b4d43'
const duplicateId = 'd309f8aa-b2c6-8a99-b3a7-83027c0a2df6'
const result = await db.from('ahsp_items').select('*').in('id', [canonicalId, duplicateId])
if (result.error) throw result.error
const canonical = result.data.find(row => row.id === canonicalId)
const duplicate = result.data.find(row => row.id === duplicateId)
assert.equal(canonical?.code, '2.3.(25a)')
assert.equal(canonical.name, 'Saluran U Pracetak Tipe DS 5')
assert.equal(canonical.field, 'Bina Marga')
assert.equal(canonical.regulation, 'SE 47/2026')
assert.equal(canonical.sipasti_origin, false)
if (duplicate) {
  assert.equal(duplicate.code, '2.3.(25a)1')
  assert.equal(duplicate.name, '1Saluran U Pracetak Tipe DS 5')
  assert.equal(duplicate.sipasti_origin, true)
  assert.equal(duplicate.analysis_status, 'unavailable')
  assert.equal(duplicate.source_id, null)
  assert.deepEqual(duplicate.components, [])
  assert.deepEqual(duplicate.sipasti_rows, [2862])
  assert.equal(duplicate.sipasti_sha256, canonical.sipasti_sha256)
  if (!process.argv[2]) throw new Error('Berikan path backup sebelum koreksi')
  writeFileSync(process.argv[2], JSON.stringify({ corrected_at: new Date().toISOString(), reason: 'Koreksi kode dan nama oleh pengguna; gabungkan ke item yang sudah ada', canonical, duplicate }, null, 2))
  const updated = await db.from('ahsp_items').update({ sipasti_status: 'both', sipasti_rows: [2862], sipasti_sha256: duplicate.sipasti_sha256 }).eq('id', canonicalId).eq('code', canonical.code).eq('name', canonical.name).select('id')
  if (updated.error) throw updated.error
  assert.equal(updated.data.length, 1)
  const removed = await db.from('ahsp_items').delete().eq('id', duplicateId).eq('code', duplicate.code).eq('name', duplicate.name).eq('sipasti_origin', true).eq('analysis_status', 'unavailable').is('source_id', null).eq('components', '[]').select('id')
  if (removed.error) throw removed.error
  assert.equal(removed.data.length, 1, 'Hanya duplikat kosong yang telah diperiksa boleh dihapus')
}
const checked = await db.from('ahsp_items').select('id,code,name,sipasti_status,sipasti_rows').in('id', [canonicalId, duplicateId])
if (checked.error) throw checked.error
assert.equal(checked.data.length, 1)
assert.equal(checked.data[0].sipasti_status, 'both')
assert.deepEqual(checked.data[0].sipasti_rows, [2862])
console.log(JSON.stringify(checked.data[0]))
