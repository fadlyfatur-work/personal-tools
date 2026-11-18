import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

// This is an isolated PostgreSQL/WASM check, never a connection to Supabase.
const runtime=path.resolve(process.env.OFFICE_PGLITE_PATH||'.next/office-db-check/node_modules/@electric-sql/pglite/dist/index.js')
if(!fs.existsSync(runtime))throw new Error('Install the temporary PGlite test runtime first; see docs/office-suite.md. No database was contacted.')
const{PGlite}=await import(pathToFileURL(runtime).href)
const db=new PGlite()
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const scalar=async(sql,params=[]) => (await db.query(sql,params)).rows[0].value
const mutate=(workspace,kind,action,id,revision,data,actor=a)=>scalar('select office_mutate($1,$2,$3,$4,$5,$6,$7::jsonb) as value',[actor,workspace,kind,action,id,revision,JSON.stringify(data)])
try{
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key,email text); create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table public.templates(code text primary key,name text,file_path text,fields jsonb); grant usage on schema public to anon,authenticated,service_role;")
  await db.query('insert into auth.users values($1,$2),($3,$4)',[a,'a@example.invalid',b,'b@example.invalid'])
  for(const filename of ['202610260001_tools.sql','202610260002_documents.sql','202610260003_office.sql','202610260004_operations.sql']){
    await db.exec(fs.readFileSync(path.join('supabase/migrations',filename),'utf8'))
    console.log(`PASS migration: ${filename}`)
  }
  const bootstrap=await scalar('select tools_bootstrap($1,$2) as value',[a,'A'])
  const workspace=bootstrap.workspaces[0].id
  assert.equal((await scalar('select tools_bootstrap($1,$2) as value',[a,'A'])).workspaces.length,1)
  await scalar('select tools_bootstrap($1,$2) as value',[b,'B'])
  await db.query("insert into tools_workspace_members values($1,$2,'member')",[workspace,b])
  await db.query('update tools_profiles set is_template_admin=true where user_id=$1',[a])
  const tag=await scalar('select documents_save_tag($1,null,null,$2::jsonb,$3,$4,false) as value',[a,JSON.stringify({name:'Kelompok Uji',kind:'instansi'}),'test-verifier','digest-a'])
  assert.equal(tag.pin_configured,true)
  await assert.rejects(()=>scalar('select documents_save_tag($1,null,null,$2::jsonb,$3,$4,false) as value',[a,JSON.stringify({name:'Kelompok Lain',kind:'divisi'}),'other-verifier','digest-a']),/PIN_ALREADY_USED/)
  const version='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  const metadata={code:'template_test',name:'Template uji',access_tag_id:tag.id}
  const descriptor={id:version,fields:{single:[],groups:[]},file_key:'test/version.docx',file_name:'test.docx',checksum:'test-checksum'}
  const template=await scalar('select documents_save_template($1,null,null,$2::jsonb,$3::jsonb) as value',[a,JSON.stringify(metadata),JSON.stringify(descriptor)])
  const retry=await scalar('select documents_save_template($1,null,null,$2::jsonb,$3::jsonb) as value',[a,JSON.stringify(metadata),JSON.stringify(descriptor)])
  assert.equal(retry.id,template.id)
  await assert.rejects(()=>scalar('select documents_publish_template($1,$2,$3,$4,true) as value',[a,template.id,version,template.revision]),/VALIDATION_REQUIRED/)
  await scalar('select documents_validate_version($1,$2,$3) as value',[a,template.id,version])
  const published=await scalar('select documents_publish_template($1,$2,$3,$4,true) as value',[a,template.id,version,template.revision])
  assert.equal(published.active_version_id,version)
  assert.equal(published.status,'published')
  await db.exec('set role anon')
  try{await assert.rejects(()=>db.query('select * from documents_templates'),/permission denied/);await assert.rejects(()=>db.query('select * from templates'),/permission denied/)}finally{await db.exec('reset role')}
  const domain=loadSuiteModule('lib/office/domain.ts')
  const privateTask=await mutate(workspace,'tasks','save',null,null,domain.taskSchema.parse({title:'Privat',visibility:'private',assignee_id:a}))
  await assert.rejects(()=>scalar('select office_read($1,$2,$3,$4) as value',[b,workspace,'tasks',privateTask.id]),/OFFICE_NOT_FOUND/)
  const task=await mutate(workspace,'tasks','save',null,null,domain.taskSchema.parse({title:'Bersama',visibility:'workspace',assignee_id:a}))
  const follow=await mutate(workspace,'followups','save',null,null,domain.followupSchema.parse({title:'Menunggu respons',task_id:task.id,contact:'Rekan',requested_on:'2026-01-01',due_date:'2026-01-02',reminder_at:'2026-01-01T00:00:00Z'}))
  await assert.rejects(()=>mutate(workspace,'tasks','save',task.id,task.revision,{...task.data,status:'done'}),/OFFICE_FOLLOWUPS_OPEN/)
  const reassigned=await mutate(workspace,'tasks','save',task.id,task.revision,{...task.data,assignee_id:b})
  await scalar("select office_process_reminders('2027-01-01T00:00:00Z') as value")
  const recipients=await db.query('select distinct recipient_id from office_notifications where followup_id=$1',[follow.id])
  assert.equal(recipients.rows.length,1)
  assert.equal(recipients.rows[0].recipient_id,b)
  await mutate(workspace,'followups','save',follow.id,follow.revision,{...follow.data,status:'done',result:'Selesai'})
  assert.equal((await mutate(workspace,'tasks','save',task.id,reassigned.revision,{...reassigned.data,status:'done'})).status,'done')
  const actionId='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  const meeting=await mutate(workspace,'meetings','save',null,null,domain.meetingSchema.parse({title:'Rapat',visibility:'workspace',held_at:'2026-10-27T00:00:00Z',action_items:[{id:actionId,title:'Hasil rapat',assignee_id:a,due_date:null}]}))
  const converted=await mutate(workspace,'meetings','convert',meeting.id,meeting.revision,{action_item_id:actionId})
  const twice=await mutate(workspace,'meetings','convert',meeting.id,meeting.revision,{action_item_id:actionId})
  assert.equal(converted.task_id,twice.task_id)
  const service=(await db.query('insert into tools_services(workspace_id,name) values($1,$2) returning id',[workspace,'Layanan uji'])).rows[0].id
  const environment=(await db.query('insert into tools_environments(workspace_id,service_id,name) values($1,$2,$3) returning id',[workspace,service,'test'])).rows[0].id
  const monitor=(await db.query("insert into operations_monitors(workspace_id,service_id,environment_id,name,url,failure_threshold,recovery_threshold,created_by) values($1,$2,$3,'Monitor uji','https://example.com/health',1,1,$4) returning id",[workspace,service,environment,a])).rows[0].id
  const jobs=await scalar('select operations_claim_checks(8) as value')
  assert.equal(jobs.length,1)
  const job=jobs[0].slot
  const failed={outcome:'failed',http_status:500,response_ms:1,tls_valid:true,tls_expires_at:'2030-01-01T00:00:00Z',error_code:'HTTP_STATUS'}
  assert.equal(await scalar('select operations_finish_check($1,$2,$3::jsonb) as value',[job.id,job.lease_token,JSON.stringify(failed)]),true)
  assert.equal(await scalar('select operations_finish_check($1,$2,$3::jsonb) as value',[job.id,job.lease_token,JSON.stringify(failed)]),false)
  assert.equal((await db.query('select count(*)::int as value from operations_incidents where monitor_id=$1',[monitor])).rows[0].value,1)
  console.log('PASS: real PostgreSQL SQL bootstrap, tag uniqueness, version publish/idempotency, anonymous denial, Office privacy/closure/current PIC/conversion, monitoring result dedupe/incident.')
  console.log((await db.query('select version() as value')).rows[0].value)
}catch(error){console.error('FAIL migration/SQL behavior:',error.message);process.exitCode=1}
finally{await db.close()}
