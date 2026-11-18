import assert from 'node:assert/strict'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

let suiteAdmin=false,templateAdmin=true,active=true,creationError=null
const mutations=[],created=[]
const profile={user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'member@example.invalid',name:'Anggota',is_suite_admin:false,is_template_admin:false,is_active:true,revision:1}
const db={
 auth:{admin:{createUser:async input=>{created.push(input);return{data:{user:creationError?null:{id:profile.user_id}},error:creationError}}}},
 rpc:async(name,args)=>{
  if(name==='tools_bootstrap')return{data:{name:'Admin',is_suite_admin:suiteAdmin,is_template_admin:templateAdmin,is_active:active,workspaces:[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Pribadi',role:'owner'}]},error:null}
  mutations.push({name,args});return{data:{...profile,...args.p_data,revision:2},error:null}
 },
 from:()=>{const query={select(){return this},order(){return this},range(){return this},ilike(){return this},eq(){return this},single:async()=>({data:profile,error:null}),then(resolve){return Promise.resolve({data:[profile],error:null}).then(resolve)}};return query},
}
const routes=loadSuiteModule('app/api/tools/users/route.ts',{
 '@/lib/supabaseAdmin':{supabaseAdmin:db},
 '@/lib/tools/auth':{getToolsAuth:async()=>({auth:{getUser:async()=>({data:{user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'admin@example.invalid'}},error:null})}})},
 './auth':{getToolsAuth:async()=>({auth:{getUser:async()=>({data:{user:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'admin@example.invalid'}},error:null})}})},
 '@/lib/tools/limits':{sharedRateLimit:async()=>({allowed:true,retry_after:60}),trustedSource:()=> 'test'},
 './limits':{sharedRateLimit:async()=>({allowed:true,retry_after:60})},
})
const request=(method,body)=>new Request('https://app.test/api/tools/users',{method,headers:{origin:'https://app.test','Content-Type':'application/json'},...(body&&method!=='GET'?{body:JSON.stringify(body)}:{})})
for(const method of ['GET','POST','PATCH'])assert.equal((await routes[method](request(method,{email:'new@example.invalid',password:'password-test',name:'Baru'}))).status,403,'Template admin alone must not manage suite users')
assert.equal(created.length,0)
suiteAdmin=true
assert.equal((await routes.GET(request('GET'))).status,200)
let response=await routes.POST(request('POST',{email:'new@example.invalid',password:'password-test',name:'Baru'}))
assert.equal(response.status,201)
assert.equal(created[0].email_confirm,true)
assert.equal(created[0].user_metadata.is_suite_admin,undefined)
assert.equal((await response.json()).data.is_suite_admin,false)
response=await routes.POST(request('POST',{email:'new@example.invalid',password:'password-test',name:'Baru',is_suite_admin:true}))
assert.equal(response.status,400,'New users must not gain privileged roles through account creation')
response=await routes.PATCH(request('PATCH',{user_id:profile.user_id,revision:1,name:'Baru',is_suite_admin:false,is_template_admin:true,is_active:false}))
assert.equal(response.status,200)
assert.equal(mutations.at(-1).name,'tools_manage_user')
assert.equal(mutations.at(-1).args.p_actor,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
assert.equal(mutations.at(-1).args.p_data.is_active,false)
creationError={code:'email_exists',message:'private provider detail'}
response=await routes.POST(request('POST',{email:'new@example.invalid',password:'password-test',name:'Baru'}))
assert.equal(response.status,409);assert.ok(!(await response.text()).includes('private provider detail'))
active=false
assert.equal((await routes.GET(request('GET'))).status,403,'Disabled suite account must be denied even with an existing session')
console.log('PASS: user management suite-admin boundary, ordinary-account creation, duplicate privacy, guarded role mutation, and disabled sessions.')
