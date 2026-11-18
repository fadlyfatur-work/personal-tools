import fs from 'node:fs'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

if(fs.existsSync('.env.local'))process.loadEnvFile('.env.local')
const args=process.argv.slice(2),command=args[0]||'help'
const option=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined}
if(command==='help'){
  console.log('Setup Office Suite (manual SQL migrations first)\n  check\n  admin --email <existing-suite-account> [--apply]\n  import --email <admin-account> --tag <existing-tag-id> [--apply]\nNo PIN or secrets are read from command arguments. Imports remain draft until reviewed in admin.')
  process.exit(0)
}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!url||!key)throw new Error('Configure Supabase server environment before running setup.')
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const check=({data,error})=>{if(error)throw new Error('Database operation failed. Check that migrations and server access are configured.');return data}
if(command==='check'){
  let ready=true
  for(const table of ['tools_profiles','tools_workspaces','documents_access_tags','documents_templates','office_tasks','tools_services','operations_monitors']){
    const result=await db.from(table).select(table==='tools_profiles'?'user_id,is_suite_admin,is_active,revision':'*').limit(0).abortSignal(AbortSignal.timeout(8000))
    if(result.error)ready=false
    console.log(`${table}: ${result.error?'not ready':'ready'}`)
  }
  for(const name of ['DOCUMENTS_PIN_LOOKUP_SECRET','DOCUMENTS_SESSION_SECRET','TOOLS_WORKER_SECRET']){
    const configured=(process.env[name]?.length||0)>=32
    if(!configured)ready=false
    console.log(`${name}: ${configured?'configured':'not ready (minimum 32 characters)'}`)
  }
  process.exit(ready?0:1)
}
if(!['admin','import'].includes(command))throw new Error('Unknown command. Run without arguments for help.')
const email=option('--email')?.trim().toLowerCase()
if(!email)throw new Error('Provide --email of an account that has signed into the suite.')
const profile=check(await db.from('tools_profiles').select('user_id,is_template_admin').eq('email',email).maybeSingle())
if(!profile)throw new Error('Account profile not found. Sign into the suite first, then rerun setup.')
const apply=args.includes('--apply')
if(command==='admin'){
  if(!apply){console.log('Dry run: existing account found. Add --apply to grant template admin.');process.exit(0)}
  check(await db.from('tools_profiles').update({is_template_admin:true,is_suite_admin:true}).eq('user_id',profile.user_id))
  check(await db.from('tools_audit').insert({actor_id:profile.user_id,action:'documents.admin.bootstrap',subject_id:profile.user_id}))
  console.log('Suite and template admin roles granted. Sign in at /tools/users or /documents/admin.')
  process.exit(0)
}
if(!profile.is_template_admin)throw new Error('This account is not a template admin.')
const tagId=option('--tag')
if(!tagId||!/^[0-9a-f-]{36}$/i.test(tagId))throw new Error('Provide --tag with the organizational access tag created in admin.')
const tag=check(await db.from('documents_access_tags').select('id,active').eq('id',tagId).maybeSingle())
if(!tag?.active)throw new Error('The access tag must exist and be active.')
const builtins=loadSuiteModule('lib/documentTemplates.ts').documentTemplates
const {inspectDocx,validateTemplateFields,validatePlaceholderCoverage}=loadSuiteModule('lib/documents/policy.ts')
const legacy=check(await db.from('templates').select('code,name,file_path,fields').eq('code','perjadin_2026').maybeSingle())
if(!legacy)throw new Error('The existing Perjadin template configuration was not found. Import stopped without inventing fields.')
for(const source of [builtins.surat_tugas,legacy]){
  const existing=check(await db.from('documents_templates').select('id').eq('code',source.code).maybeSingle())
  if(existing){console.log(`${source.code}: already imported, unchanged`);continue}
  const bytes=fs.readFileSync(path.join('storage','data',path.basename(source.file_path)))
  const inspected=inspectDocx(bytes),fields=validateTemplateFields(source.fields)
  validatePlaceholderCoverage(inspected.placeholders,fields)
  if(!apply){console.log(`${source.code}: ready for draft import (dry run)`);continue}
  const versionId=randomUUID(),fileKey=`${profile.user_id}/${versionId}.docx`
  check(await db.storage.from('documents-private').upload(fileKey,bytes,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:false}))
  check(await db.rpc('documents_save_template',{p_actor:profile.user_id,p_id:null,p_revision:null,p_data:{code:source.code,name:source.name,kind:'Surat',organization:'',division:'',description:'Template lama yang dipindahkan ke katalog terkelola.',access_tag_id:tagId},p_version:{id:versionId,fields,file_key:fileKey,file_name:path.basename(source.file_path),checksum:createHash('sha256').update(bytes).digest('hex')}}))
  console.log(`${source.code}: draft imported; test and publish through admin`)
}
console.log(apply?'Import complete. Original files and legacy rows were preserved.':'Dry run complete. Add --apply to create drafts.')
