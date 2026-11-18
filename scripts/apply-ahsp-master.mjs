import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const [filename, flag] = process.argv.slice(2)
if (!filename || (flag && !['--apply','--verify'].includes(flag))) throw new Error('Gunakan: node --env-file=.env.local scripts/apply-ahsp-master.mjs <plan.json> [--apply|--verify]')
const plan = JSON.parse(readFileSync(filename,'utf8'))
const bytes = readFileSync(plan.snapshot)
assert.equal(createHash('sha256').update(bytes).digest('hex'),plan.snapshot_sha256,'Snapshot berubah')
const backup = JSON.parse(bytes), originals = new Map(backup.items.map(i => [i.id,i]))
assert.equal(plan.changes.length,backup.items.length)
assert.equal(new Set(plan.changes.map(c=>c.id)).size,plan.changes.length)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const run = { id:createHash('sha256').update(`${plan.source_sha256}:${plan.snapshot_sha256}`).digest('hex'), source_sha256:plan.source_sha256, source_name:plan.source_name, snapshot_sha256:plan.snapshot_sha256, summary:plan.summary }
const schema = await db.from('ahsp_items').select('id,verification_status,analysis_origin').limit(1)
if (schema.error) throw new Error('Migrasi 202610270001_ahsp_master_verification.sql belum tersedia. Jalankan melalui SQL Editor dahulu.')
const applied = await db.from('ahsp_master_changes').select('item_id').eq('run_id',run.id)
if (applied.error) throw new Error('Tabel jejak rekonsiliasi belum tersedia.')
const current = []
for (let offset=0;;offset+=300) {
  const result=await db.from('ahsp_items').select('*').order('id').range(offset,offset+299)
  if(result.error)throw new Error(`Pembacaan katalog gagal: ${result.error.code}`)
  current.push(...result.data)
  if(result.data.length<300)break
}
assert.equal(current.length,backup.items.length,'Jumlah katalog berubah; buat audit baru sebelum menerapkan')
const actual=new Map(current.map(i=>[i.id,i]))
const verify = async () => {
  let verified=0,needsReview=0,components=0,variables=0
  for(const change of plan.changes) {
    const item=actual.get(change.id)
    assert.ok(item,`Item hilang: ${change.id}`)
    assert.equal(item.verification_status,change.verification_status,`Status berbeda: ${change.code}`)
    assert.deepEqual(item.verification_notes,change.verification_notes)
    assert.equal(item.analysis_status,change.analysis_status)
    assert.equal(item.master_provenance?.source_sha256,plan.source_sha256)
    assert.equal(item.master_provenance?.run_id,run.id)
    if(change.components!==null)assert.deepEqual(item.components,change.components,`Komponen berbeda: ${change.code}`)
    const original=originals.get(change.id)
    for(const key of ['code','name','unit','field','regulation','source_id','page_from','page_to','source_text','output_quantity'])assert.deepEqual(item[key],original[key],`Metadata sumber berubah: ${change.code} ${key}`)
    if(change.verification_status==='verified')verified++;else needsReview++
    components+=item.components.length
    variables+=item.components.reduce((n,c)=>n+(c.variables?.length??0),0)
  }
  const report={run_id:run.id,verified_at:new Date().toISOString(),versions:current.length,verified,needs_review:needsReview,components,variables}
  writeFileSync(join(dirname(resolve(filename)),'applied-verification.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
}
if(flag==='--verify') { await verify(); process.exit(0) }
// Every row is checked before the first write; SQL rechecks and locks each bounded batch.
const appliedIds=new Set()
for(let offset=0;;offset+=1000){const r=await db.from('ahsp_master_changes').select('item_id,after_row').eq('run_id',run.id).order('item_id').range(offset,offset+999);if(r.error)throw new Error('Jejak batch tidak dapat dibaca');for(const row of r.data){appliedIds.add(row.item_id);assert.deepEqual(actual.get(row.item_id),row.after_row,'Data berubah setelah batch sebelumnya')}if(r.data.length<1000)break}
for(const change of plan.changes){if(appliedIds.has(change.id))continue;const original=originals.get(change.id),item=actual.get(change.id);assert.ok(item);for(const [key,value] of Object.entries(original))assert.deepEqual(item[key],value,`Katalog berubah sejak snapshot: ${change.code} ${key}`)}
if(flag!=='--apply'){console.log(JSON.stringify({ready:true,run_id:run.id,versions:current.length,already_applied:appliedIds.size,summary:plan.summary}));process.exit(0)}
let done=0
for(let start=0;start<plan.changes.length;start+=25){
  const changes=plan.changes.slice(start,start+25).map(change=>({...change,before:originals.get(change.id)}))
  const r=await db.rpc('ahsp_apply_master_batch',{p_run:run,p_changes:changes})
  if(r.error)throw new Error(`Batch ${start+1} gagal (${r.error.code}): ${r.error.message}. Batch terdahulu tersimpan; jalankan ulang dengan rencana sama.`)
  done+=r.data.changed+r.data.skipped
  if(done%500===0||done===plan.changes.length)console.log(`Diterapkan: ${done}/${plan.changes.length}`)
}
console.log('Penerapan batch selesai. Jalankan kembali dengan --verify untuk pembacaan ulang seluruh hasil.')
