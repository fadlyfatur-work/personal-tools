import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PGlite} from '../.tools/ahsp-sql-test/node_modules/@electric-sql/pglite/dist/index.js'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'
const db=new PGlite(),{createSeed}=loadSuiteModule('lib/report/seed.ts')
try{
  await db.exec('create role anon; create role authenticated; create role service_role;')
  await db.exec(fs.readFileSync('supabase/migrations/202611110001_report.sql','utf8'))
  await db.query("insert into report_access(role,pin) values('admin',$1),('user',$2)",['731845','845731'])
  const date=(await db.query("select (now() at time zone 'Asia/Jakarta')::date::text as date")).rows[0].date
  const save=async(revision,role='user',version=1)=> (await db.query('select report_save_daily($1::date,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9::text[]) as value',[date,revision,JSON.stringify(createSeed()),'{}',role,version,'manual','Koreksi uji',['jawa-tengah']])).rows[0].value
  assert.equal((await save(0)).revision,1)
  await assert.rejects(save(0),/REPORT_CONFLICT/)
  assert.equal((await db.query('select count(*)::integer as count from report_changes')).rows[0].count,1)
  const rotated=(await db.query('select report_set_pins(1,null,$1) as value',['845732'])).rows[0].value
  assert.equal(rotated.admin_version,1)
  await assert.rejects(save(1,'user',1),/REPORT_ACCESS_DENIED/)
  assert.equal((await save(1,'user',2)).revision,2)
  await assert.rejects(db.query('select report_set_pins(1,$1,$1)',['123456']),/REPORT_PIN_INVALID/)
  await db.exec('set role authenticated;')
  await assert.rejects(db.query('select pin from report_access'),/permission denied/)
  await assert.rejects(save(2,'admin',1),/permission denied/)
  await db.exec('reset role;')
  assert.equal((await db.query('select count(*)::integer as count from report_changes')).rows[0].count,2)
  console.log('PASS: isolated PostgreSQL migration, atomic revisions/audit, access revocation, PIN separation and browser-role denial.')
}finally{await db.close()}
