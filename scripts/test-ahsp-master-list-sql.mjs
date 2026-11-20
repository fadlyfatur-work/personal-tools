import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '../.tools/ahsp-sql-test/node_modules/@electric-sql/pglite/dist/index.js'
import { prepareMasterList } from './import-ahsp-master-list.mjs'

const db=new PGlite()
try{
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  for(const file of ['202610120001_ahsp_catalog.sql','202610130007_ahsp_inline_matching.sql','202610130008_ahsp_sipasti_reconciliation.sql','202610130009_ahsp_analysis_references.sql','202610140003_ahsp_unique_work_names.sql','202610270001_ahsp_master_verification.sql','202611190001_ahsp_sptjm_catalog.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
  await db.exec(readFileSync('supabase/migrations/202611190001_ahsp_sptjm_catalog.sql','utf8'))
  const sha='a'.repeat(64),row={row:2,code:'S.1',name:'Master SPTJM tanpa analisis',bidang:'Bina Marga',unit:'',job_type:'informative',regulasi_se:'null, SPTJM',overheat_and_profit_percentage:10}
  const {additions}=prepareMasterList([row],[],{sha256:sha,sourceName:'master.xlsx'})
  await db.query('insert into ahsp_sipasti_imports(sha256,source_name,source_rows) values ($1,$2,$3::jsonb)',[sha,'master.xlsx',JSON.stringify([row])])
  const insert=async item=>{const columns=Object.keys(item).join(',');return db.query(`insert into ahsp_items(${columns}) select ${columns} from jsonb_populate_record(null::ahsp_items,$1::jsonb)`,[JSON.stringify(item)])}
  await insert(additions[0])
  const search=async args=>(await db.query(`select ahsp_search_items(${args}) as result`)).rows[0].result
  assert.equal((await search("p_regulation=>'SPTJM',p_sipasti=>'needs_review'")).total,1)
  assert.equal((await search("p_regulation=>'SPTJM',p_sipasti=>'verified'")).total,0)
  assert.equal((await search('')).total,0,'SPTJM dipilih eksplisit, tidak diberi label regulasi aktif')
  assert.equal((await db.query('select ahsp_catalog_options() as result')).rows[0].result.version_total,1)
  const saved=(await db.query('select * from ahsp_items')).rows[0]
  assert.deepEqual(saved.components,[])
  assert.equal(saved.unit,'')
  assert.equal(saved.analysis_status,'unavailable')
  assert.equal(saved.source_id,null)
  await assert.rejects(insert(additions[0]),/duplicate key/)
  await db.exec('set role anon')
  await assert.rejects(db.query('select * from ahsp_catalog_versions'),/permission denied/)
  await db.exec('reset role')
  console.log('PASS: migrasi berulang, impor master tanpa analisis, filter SPTJM, status merah, cakupan aktif, ID unik, dan akses privat')
}finally{await db.close()}
