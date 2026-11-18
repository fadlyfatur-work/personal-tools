import assert from 'node:assert/strict'
import fs from 'node:fs'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

assert.ok(fs.existsSync('lib/report/session.ts'), 'Report PIN sessions are not implemented')
const session=loadSuiteModule('lib/report/session.ts')
const secret='test-report-session-secret-'.repeat(3)
const token=await session.createReportSession('user',1,secret)
assert.equal((await session.readReportSession(token,secret)).role,'user')
assert.equal(await session.readReportSession(token,secret+'wrong'),null)
assert.equal(await session.readReportSession('bad',secret),null)
const model={...loadSuiteModule('lib/report/model.ts'),...loadSuiteModule('lib/report/seed.ts')}
const seed=model.createSeed(), cookieJar=new Map()
const state={access:[{role:'admin',pin:'731845',version:1},{role:'user',pin:'845731',version:1}],snapshot:null,rpc:[],limited:false}
const query=table=>{
  const filters=[]
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},lt(){return q},gte(){return q},lte(){return q},order(){return q},limit(){return q},maybeSingle(){return Promise.resolve(result(true))},single(){return Promise.resolve(result(true))},then(resolve,reject){return Promise.resolve(result(false)).then(resolve,reject)}}
  function result(single){
    if(table==='report_access'){const rows=state.access.filter(row=>filters.every(([key,value])=>row[key]===value));return{data:single?rows[0]||null:rows,error:null}}
    if(table==='report_daily')return{data:single?state.snapshot:[],error:null}
    return{data:[],error:null}
  }
  return q
}
const db={from:query,async rpc(name,args){state.rpc.push({name,args});if(name==='report_save_daily')return{data:null,error:{message:'REPORT_CONFLICT'}};return{data:[],error:null}}}
process.env.REPORT_SESSION_SECRET=secret
const server=loadSuiteModule('lib/report/server.ts',{'@/lib/supabaseAdmin':{supabaseAdmin:db},'@/lib/tools/limits':{sharedRateLimit:async()=>({allowed:!state.limited,retry_after:90}),trustedSource:()=> 'test'},'next/headers':{cookies:async()=>({get:key=>cookieJar.has(key)?{value:cookieJar.get(key)}:undefined,set:(key,value)=>cookieJar.set(key,value),delete:key=>cookieJar.delete(key)})}})
const request=(path,body,method='POST')=>new Request(`https://app.test/api/report${path}`,{method,headers:{origin:'https://app.test','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
await assert.rejects(server.getReportIdentity(),e=>e.status===401)
await assert.rejects(server.readReport(request('',null,'GET')),e=>e.status===401)
await assert.rejects(server.loginReport(request('/auth',{pin:'000000'})),e=>e.status===401)
state.limited=true
await assert.rejects(server.loginReport(request('/auth',{pin:'845731'})),e=>e.status===429)
state.limited=false
await server.loginReport(request('/auth',{pin:'845731'}))
assert.equal((await server.getReportIdentity()).role,'user')
const response=await server.getAccess(request('/access',null,'GET')).catch(e=>e)
assert.equal(response.status,403)
state.access[1].version=2
await assert.rejects(server.getReportIdentity(),e=>e.status===401)
await server.loginReport(request('/auth',{pin:'845731'}))
await assert.rejects(server.saveReport(request('',{date:'2026-11-11',revision:0,document:seed,source:'manual',reason:''})),e=>e.status===409)
const invalid=structuredClone(seed);invalid.provinces[0].integratedPackages=1
await assert.rejects(server.saveReport(request('',{date:'2026-11-11',revision:0,document:invalid,source:'manual',reason:''})),e=>e.status===400)
await server.loginReport(request('/auth',{pin:'731845'}))
const access=await (await server.getAccess(request('/access',null,'GET'))).json()
assert.ok(!JSON.stringify(access).includes('731845'))
assert.ok(!JSON.stringify(access).includes('845731'))
const {isSameOriginMutation}=loadSuiteModule('lib/tools/policy.ts')
assert.equal(isSameOriginMutation(new Request('https://app.test/api/report',{method:'POST',headers:{origin:'https://other.test'}})),false)
const sql=fs.readFileSync('supabase/migrations/202611110001_report.sql','utf8')
assert.match(sql,/enable row level security/i)
assert.match(sql,/revoke all.*anon, authenticated/i)
assert.match(sql,/REPORT_CONFLICT/)
assert.match(sql,/p_access_version/)
assert.ok(!sql.includes('731845'))
console.log('PASS: signed sessions, PIN rejection/limiter, role boundary, revocation, validation, conflicts and SQL access.')
