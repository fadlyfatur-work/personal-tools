import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

const created=[],signedIn=[]
let creationError=null,loginError=null,limited=false
const auth={auth:{
  signUp:async()=>{throw new Error('Registration must not send verification emails')},
  signInWithPassword:async credentials=>{signedIn.push(credentials);return{data:{session:loginError?null:{access_token:'private-token'}},error:loginError}},
}}
const {POST}=loadSuiteModule('app/api/tools/auth/[action]/route.ts',{
  'next/headers':{cookies:async()=>({set(){}})},
  '@/lib/tools/auth':{getToolsAuth:async()=>auth},
  '@/lib/supabaseAdmin':{supabaseAdmin:{auth:{admin:{createUser:async input=>{created.push(input);return{data:{user:creationError?null:{id:'new-user'}},error:creationError}}}}}},
  '@/lib/tools/limits':{trustedSource:()=> 'test',sharedRateLimit:async()=>({allowed:!limited,retry_after:60})},
})
const request=(action,body,origin='https://app.test')=>POST(new Request(`https://app.test/api/tools/auth/${action}`,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),{params:Promise.resolve({action})})
const credentials={email:'user@example.invalid',password:'password-for-test',next:'/tools/invitation?token=invite-test',is_template_admin:true,email_confirm:false}
let response=await request('register',credentials)
assert.equal(response.status,200,'Email/password registration must immediately establish a session without email delivery')
const result=await response.json()
assert.equal(result.data.authenticated,true)
assert.equal(result.data.next,credentials.next)
assert.equal(result.data.verified,undefined,'An unchecked mailbox must not be described as user-verified')
assert.equal(created[0].email_confirm,true)
assert.deepEqual(Object.keys(created[0]).sort(),['email','email_confirm','password','user_metadata'])
assert.equal(created[0].user_metadata.name,'user')
assert.equal(created[0].is_template_admin,undefined)
assert.equal(created[0].user_metadata.is_template_admin,undefined)
assert.deepEqual(Object.keys(signedIn[0]).sort(),['email','password'])
assert.ok(!JSON.stringify(result).includes('private-token'),'Session tokens belong in the existing cookie client, not JSON')

creationError={code:'email_exists',message:'internal-provider-detail'}
const signedBefore=signedIn.length
response=await request('register',credentials)
assert.equal(response.status,400)
assert.equal(signedIn.length,signedBefore,'Duplicate account errors must not silently sign in or overwrite the account')
assert.ok(!(await response.text()).includes('internal-provider-detail'))
creationError=null;loginError={message:'provider unavailable'}
response=await request('register',credentials)
assert.equal(response.status,503)
assert.match((await response.json()).error,/Akun.*dibuat.*masuk/i,'Creation followed by session failure must have a usable recovery message')
loginError=null
response=await request('login',credentials)
assert.equal(response.status,200)
loginError={message:'credentials invalid'}
response=await request('login',credentials)
assert.equal(response.status,401)
assert.ok(!(await response.text()).includes('diverifikasi'))

const count=created.length
response=await request('register',{...credentials,password:'short'})
assert.equal(response.status,400)
response=await request('register',credentials,'https://other.test')
assert.equal(response.status,403)
limited=true;response=await request('register',credentials)
assert.equal(response.status,429)
assert.equal(created.length,count,'Invalid, cross-origin, and rate-limited requests must not create accounts')
assert.equal(response.headers.get('Retry-After'),'60')

const {AuthForm}=loadSuiteModule('app/tools/components/auth-form.tsx',{
  'next/link':{default:({children,...props})=>React.createElement('a',props,children),__esModule:true},
  '@/lib/tools/client':{toolsRequest:async()=>({})},
  './tools-shell':{ToolsShell:({children})=>React.createElement('main',null,children)},'../tools.module.css':{},
})
const html=renderToStaticMarkup(React.createElement(AuthForm,{mode:'register'}))
assert.equal((html.match(/<input /g)||[]).length,2,'Registration must require only email and password')
assert.ok(!html.includes('autoComplete="name"'))
console.log('PASS: email/password-only registration, immediate cookie-client login, no verification sender, no role injection, duplicate/partial failure recovery, origin/limiter guards, and two-field form.')
