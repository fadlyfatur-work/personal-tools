import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function compile(path,imports={}) {
 const exports={}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:name=>Object.hasOwn(imports,name)?imports[name]:require(name),Buffer,URL,Date,Request,Response,console})
 return exports
}
class ToolsError extends Error { constructor(status,message,code){super(message);this.status=status;this.code=code} }
const domain=compile('lib/office/domain.ts')
const actor={userId:'00000000-0000-4000-8000-000000000001',workspaceId:'00000000-0000-4000-8000-000000000002',role:'member'}
const calls=[];let failure=null;let authenticated=true;let templateAllowed=true
const server=compile('lib/office/server.ts',{
 'server-only':{},'./domain':domain,
 '@/lib/tools/server':{ToolsError,getToolsContext:async()=>{if(!authenticated)throw new ToolsError(401,'Masuk');return actor}},
 '@/lib/supabaseAdmin':{supabaseAdmin:{rpc:async(name,args)=>{calls.push({name,args});return {data:{id:'saved'},error:failure}}}},
 '@/lib/documents/server':{getAuthorizedTemplate:async()=>{if(!templateAllowed)throw new ToolsError(401,'PIN diperlukan')}},
})
const request=body=>new Request('http://localhost/api/office/tasks',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)})
await server.officeWrite(request({data:{title:'Task',visibility:'private',assignee_id:actor.userId}}),'tasks')
assert.equal(calls.at(-1).args.p_actor,actor.userId)
assert.equal(calls.at(-1).args.p_workspace,actor.workspaceId)
assert.equal(calls.at(-1).args.p_data.status,'todo')
const before=calls.length
await assert.rejects(server.officeWrite(request({data:{title:'Task',owner_id:'spoof'}}),'tasks'),e=>e.status===400)
assert.equal(calls.length,before,'spoofed ownership never reaches persistence')
await assert.rejects(server.officeWrite(request('{broken'),'tasks'),e=>e.status===400)
await assert.rejects(server.officeWrite(request({action:'restore',data:{version:0}}),'knowledge',actor.userId),e=>e.status===400)
await assert.rejects(server.officeWrite(request({action:'convert',data:{action_item_id:'malformed'}}),'meetings',actor.userId),e=>e.status===404)
await server.officeWrite(request({action:'convert',data:{action_item_id:actor.userId}}),'meetings',actor.workspaceId)
assert.equal(calls.at(-1).args.p_id,actor.workspaceId)
assert.equal(calls.at(-1).args.p_data.action_item_id,actor.userId)
failure={message:'OFFICE_FOLLOWUPS_OPEN'}
await assert.rejects(server.officeWrite(request({data:{title:'Task',status:'done'}}),'tasks',actor.userId),e=>e.status===409&&e.code==='OFFICE_FOLLOWUPS_OPEN')
failure={message:'database details must not leak'}
await assert.rejects(server.officeRead(new Request('http://localhost/api/office/tasks'),'tasks'),e=>e.status===503&&!e.message.includes('database details'))
failure=null;authenticated=false
await assert.rejects(server.officeWrite(request('not even json'),'tasks'),e=>e.status===401)
authenticated=true;templateAllowed=false
await assert.rejects(server.officeWrite(request({data:{title:'Artikel',links:[{kind:'template',code:'restricted'}]}}),'knowledge'),e=>e.status===401)
await assert.rejects(server.officeRead(new Request('http://localhost/api/office/tasks?from=2026-02-30'),'tasks'),e=>e.status===400)
await assert.rejects(server.readOfficeBody(request('x'.repeat(200)),50),e=>e.status===413)
await assert.rejects(server.officeWrite(request('x'.repeat(262145)),'tasks'),e=>e.status===413)
await server.officeRead(new Request('http://localhost/api/office/tasks?offset=2.5&q=proposal'),'tasks')
assert.equal(calls.at(-1).args.p_offset,2)
assert.equal(calls.at(-1).args.p_search,'proposal')
console.log('Office API: actor/workspace authority, schemas, template grants, safe failures, bounded input, and query checks passed')
failure={code:'PGRST202',message:'RPC is absent from schema cache'}
await assert.rejects(server.officeRead(new Request('http://localhost/api/office/tasks'),'tasks'),e=>e.status===503&&e.code==='OFFICE_SETUP_REQUIRED'&&e.message.includes('belum disiapkan'))
failure=null

const {officeDocx}=compile('lib/office/docx.ts')
const PizZip=require('pizzip')
const zip=new PizZip(officeDocx('Rapat & keputusan',['<script>alert(1)</script>','Baris satu\nBaris dua','Hasil selesai']))
assert.ok(zip.file('[Content_Types].xml'))
assert.ok(zip.file('_rels/.rels').asText().includes('word/document.xml'))
const xml=zip.file('word/document.xml').asText()
assert.ok(xml.includes('Rapat &amp; keputusan'))
assert.ok(xml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
assert.ok(!xml.includes('<script>'))
assert.equal((xml.match(/<w:p>/g)||[]).length,5)
console.log('Office DOCX: package relationships, escaping, multiline output and content checks passed')
