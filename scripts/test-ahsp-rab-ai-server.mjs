import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import https from 'node:https'
import net from 'node:net'
import { z } from 'zod'
assert.ok(fs.existsSync('lib/ahspRabAiServer.ts'), 'AI server boundary must exist')
const load = (file, imports) => { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(name in imports)return imports[name];throw new Error(name)},Buffer,process,Response,Request,URL,TextEncoder,TextDecoder,AbortSignal,setTimeout,clearTimeout,console});return exports }
const ai=load('lib/ahspRabAi.ts',{'zod':{z}})
const server=load('lib/ahspRabAiServer.ts',{'node:crypto':crypto,'node:dns/promises':dns,'node:https':https,'node:net':net,'./ahspRabAi':ai,'./rateLimit':{clientKey:()=> 'test',rateLimit:()=>({ok:true})}})
const encryption=crypto.randomBytes(32).toString('base64'),secret='upstream-super-secret-123456789',access='manager-access-12345678901234567890'
const sealed=server.sealAiKey(secret,encryption)
assert.ok(!sealed.includes(secret));assert.equal(server.openAiKey(sealed,encryption),secret)
assert.throws(()=>server.openAiKey(sealed.slice(0,-4)+'abcd',encryption))
assert.throws(()=>server.sealAiKey(secret,'short'),/enkripsi/)
const env={AHSP_AI_ADMIN_TOKEN:access,AHSP_AI_ENCRYPTION_KEY:encryption}
assert.equal(server.checkAiAccess(new Request('https://example.com'),env).status,401)
assert.equal(server.checkAiAccess(new Request('https://example.com',{headers:{'x-ahsp-ai-access':access}}),env),null)
assert.equal(server.checkAiAccess(new Request('https://example.com'),{}).status,503)
for(const address of ['127.0.0.1','10.1.2.3','169.254.169.254','192.168.1.1','100.64.0.1','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(server.isPublicAiAddress(address),false,address)
for(const address of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(server.isPublicAiAddress(address),true,address)
for(const url of ['http://api.example.com','https://localhost/api','https://user:pass@example.com','https://example.com:444/api','https://127.0.0.1/api'])assert.throws(()=>server.validateAiUrl(url))
assert.equal(server.validateAiUrl('https://example.com/api').hostname,'example.com')
await assert.rejects(server.readAiJson(new Request('https://example.com',{method:'POST',body:'{"large":"'+'x'.repeat(100)+'"}'}),30),/ukuran/)
const profile={...ai.aiPreset('chat'),name:'Test',model:'test'}
let calls=0
const result=await server.callAiModel(profile,secret,{stage:'structure',text:'HALAMAN 1\nGalian',pages:[1]},async()=>{calls++;return {status:200,body:JSON.stringify({choices:[{message:{content:JSON.stringify({items:[{name:'Galian',unit:'m3',source_page:1,volume:1,price:2,total:2}]})}}],usage:{total_tokens:20}})}})
assert.equal(calls,1);assert.equal(result.trace.ok,true);assert.equal(result.items[0].name,'Galian')
assert.ok(!JSON.stringify(result.trace).includes(secret));assert.equal(result.trace.usage.total_tokens,20)
const failure=await server.callAiModel(profile,secret,{stage:'structure',text:'test',pages:[1]},async()=>({status:401,body:JSON.stringify({error:{message:'Invalid '+secret}})}))
assert.equal(failure.trace.ok,false);assert.ok(!JSON.stringify(failure).includes(secret));assert.equal(failure.trace.status,401)
const truncated=await server.callAiModel(profile,secret,{stage:'structure',text:'test',pages:[1]},async()=>({status:200,body:JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"items":[]}'}}]})}))
assert.equal(truncated.trace.ok,false);assert.match(truncated.trace.error,/terpotong/)
const invalid=await server.callAiModel({...profile,structure:{...profile.structure,body:{bad:'{{missing}}'}}},secret,{stage:'structure',text:'test',pages:[1]},async()=>{throw new Error('must not call')})
assert.equal(invalid.trace.ok,false);assert.match(invalid.trace.error,/Variabel/)
console.log('PASS: encrypted secrets, manager guard, private-address/URL policy, request limits, bounded AI call contract, failure redaction and truncated output.')
