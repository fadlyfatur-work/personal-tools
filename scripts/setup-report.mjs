import fs from 'node:fs'
import path from 'node:path'
import {randomBytes} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

if(fs.existsSync('.env.local'))process.loadEnvFile('.env.local')
const command=process.argv[2]||'help'
const {summarize,provinceSummary}=loadSuiteModule('lib/report/model.ts')
const {createSeed}=loadSuiteModule('lib/report/seed.ts')
if(command==='help'){
  console.log('Report setup: prepare | check\nprepare: writes ignored activation SQL using REPORT_ADMIN_PIN and REPORT_USER_PIN (or ignored .env.report.local). Never prints PINs. SQL is applied manually. check: read-only readiness check.')
  process.exit(0)
}
if(command==='prepare'){
  if(fs.existsSync('.env.report.local'))process.loadEnvFile('.env.report.local')
  const admin=process.env.REPORT_ADMIN_PIN,user=process.env.REPORT_USER_PIN
  if(!/^\d{6,12}$/.test(admin||'')||!/^\d{6,12}$/.test(user||'')||admin===user)throw new Error('Configure two different 6-12 digit report PINs in ignored .env.report.local or environment.')
  if((process.env.REPORT_SESSION_SECRET||'').length<32){
    const current=fs.existsSync('.env.local')?fs.readFileSync('.env.local','utf8'):''
    if(/^REPORT_SESSION_SECRET=/m.test(current))throw new Error('Existing REPORT_SESSION_SECRET is too short. Update it explicitly before continuing.')
    fs.appendFileSync('.env.local',`${current.endsWith('\n')?'':'\n'}REPORT_SESSION_SECRET=${randomBytes(48).toString('base64url')}\n`)
  }
  const doc=createSeed(),summary={all:summarize(doc),provinces:doc.provinces.map(p=>({id:p.id,total:p.totalPackages,integrated:p.integratedPackages,percent:provinceSummary(p).percent,accounts:Object.values(p.accounts).filter(a=>a.status==='ada').length}))}
  const quote=value=>`'${value.replaceAll("'","''")}'`
  const migration=fs.readFileSync('supabase/migrations/202611110001_report.sql','utf8')
  const sql=`${migration}\n\nbegin;\ninsert into public.report_access(role,pin) values ('admin',${quote(admin)}),('user',${quote(user)}) on conflict(role) do nothing;\nwith inserted as (\n insert into public.report_daily(date,revision,document,summary) values ('2026-11-10',1,${quote(JSON.stringify(doc))}::jsonb,${quote(JSON.stringify(summary))}::jsonb) on conflict(date) do nothing returning date,revision\n) insert into public.report_changes(report_date,revision,actor_role,source,reason) select date,revision,'admin','seed','Rekap sumber PDF 10 November 2026' from inserted;\ncommit;\n`
  fs.mkdirSync('.next/report-work',{recursive:true})
  fs.writeFileSync('.next/report-activation.sql',sql)
  console.log('Prepared .next/report-activation.sql. Apply manually in Supabase SQL Editor, then restart the server. Existing PINs/reports are preserved. Contains private PINs; do not share or commit.')
  process.exit(0)
}
if(command==='check'){
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase server environment is missing.')
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  let ready=(process.env.REPORT_SESSION_SECRET||'').length>=32
  for(const [table,columns] of [['report_access','role,version'],['report_daily','date,revision'],['report_changes','id']]){
    const {data,error}=await db.from(table).select(columns).limit(2).abortSignal(AbortSignal.timeout(10000))
    const ok=!error&&(table!=='report_access'||data?.length===2)
    ready&&=ok
    console.log(`${table}: ${ok?'ready':'not ready'}`)
  }
  console.log(`REPORT_SESSION_SECRET: ${(process.env.REPORT_SESSION_SECRET||'').length>=32?'configured':'not configured'}`)
  process.exit(ready?0:1)
}
throw new Error(`Unknown command: ${path.basename(command)}`)
