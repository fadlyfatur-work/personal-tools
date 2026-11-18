import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '../.tools/ahsp-sql-test/node_modules/@electric-sql/pglite/dist/index.js'

const db = new PGlite()
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  for (const file of ['202610120001_ahsp_catalog.sql','202610130007_ahsp_inline_matching.sql','202610130008_ahsp_sipasti_reconciliation.sql','202610130009_ahsp_analysis_references.sql','202610140003_ahsp_unique_work_names.sql','202610150001_ahsp_mptk_catalog.sql','202610150002_ahsp_mptk_validation.sql','202610270001_ahsp_master_verification.sql','202610270002_ahsp_master_mptk_units.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  await db.exec(readFileSync('supabase/migrations/202610270001_ahsp_master_verification.sql','utf8'))
  const id = '00000000-0000-4000-8000-000000000001'
  await db.query("insert into ahsp_items(id,code,name,unit,field,regulation,analysis_status,reconciliation_status) values ($1,'A.1','Pekerjaan','m3','Umum','SE 47/2026','unavailable','belum_ditemukan')",[id])
  const before = (await db.query('select to_jsonb(i) as item from ahsp_items i where id=$1',[id])).rows[0].item
  const run = { id:'a'.repeat(64),source_sha256:'b'.repeat(64),source_name:'master.json',snapshot_sha256:'c'.repeat(64),summary:{} }
  const change = { id,before,verification_status:'verified',verification_notes:[],matched:true,analysis_status:'extracted',components:[{id:'c1',group:'tenaga',name:'Pekerja',unit:'OH',coefficient:.5,expression:'',variables:[{code:'Q',final_value:2}]}],source_rows:[1],source_job_ids:['generated'],differences:[] }
  const apply = async changes => (await db.query('select ahsp_apply_master_batch($1::jsonb,$2::jsonb) as result',[JSON.stringify(run),JSON.stringify(changes)])).rows[0].result
  assert.deepEqual(await apply([change]),{changed:1,skipped:0})
  assert.deepEqual(await apply([change]),{changed:0,skipped:1})
  const after = (await db.query('select * from ahsp_items where id=$1',[id])).rows[0]
  assert.equal(after.analysis_origin,'sipasti')
  assert.equal(after.verification_status,'verified')
  assert.equal(after.source_id,null,'JSON tidak membuat halaman PDF fiktif')
  const projected=(await db.query('select component from ahsp_mptk_validation where item_id=$1',[id])).rows[0].component
  assert.equal(projected.variables,undefined,'Rekap MPTK tidak menyalin variabel rumus ke seluruh agregasi')
  assert.equal(after.components[0].variables.length,1,'Variabel tetap lengkap di rincian sumber')
  const nativeLabor = {group:'tenaga',name:'Pekerja',unit:'jam',coefficient:.5}
  const validate = async origin => (await db.query('select ahsp_validate_mptk_component($1::jsonb,$2) as component',[JSON.stringify(nativeLabor),origin])).rows[0].component
  assert.deepEqual((await validate('sipasti')).validation_issues,[],'Tenaga jam SIPASTI tetap muncul di MPTK')
  assert.equal((await validate('sipasti')).unit,'jam','Satuan sumber dipertahankan')
  assert.ok((await validate('pdf')).validation_issues.includes('labor_unit_mismatch'),'Validasi ekstraksi PDF tetap ketat')
  assert.equal((await db.query('select count(*)::int as n from ahsp_master_changes')).rows[0].n,1)
  const search = async status => (await db.query('select ahsp_search_items(p_sipasti=>$1) as result',[status])).rows[0].result
  assert.equal((await search('verified')).total,1)
  assert.equal((await search('needs_review')).total,0)
  await db.query("update ahsp_items set name='Diubah setelah audit' where id=$1",[id])
  await assert.rejects(apply([change]),/berubah sesudah/)
  await db.query("update ahsp_items set name='Pekerjaan' where id=$1",[id])
  const id2 = '00000000-0000-4000-8000-000000000002'
  await db.query("insert into ahsp_items(id,code,name,unit,field,regulation,analysis_status,reconciliation_status) values ($1,'S.1','Biaya SMKK','buah','SMKK','SE 47/2026','unavailable','belum_ditemukan')",[id2])
  const before2 = (await db.query('select to_jsonb(i) as item from ahsp_items i where id=$1',[id2])).rows[0].item
  assert.deepEqual(await apply([{...change,id:id2,before:before2,components:null,analysis_status:'unavailable'}]),{changed:1,skipped:0})
  assert.equal((await search('verified')).total,2)
  await db.exec('set role anon')
  await assert.rejects(apply([change]),/permission denied/)
  await db.exec('reset role')
  console.log('PASS: migrasi berulang, JSON tanpa PDF, SMKK, dua filter status, snapshot cadangan, idempotensi, drift, dan pembatasan akses')
} finally { await db.close() }
