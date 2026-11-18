import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
const state=[];let cursor=0;const effects=[];const visibilityHandlers=[];let handler
const react={...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}]},useEffect(fn){if(!handler)effects.push(fn)},useCallback:fn=>fn,useRef(initial){const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i]}}
const context={AbortController,exports:{},require(name){if(name==='react')return react;if(name==='react/jsx-runtime')return jsxRuntime;if(name==='next/link')return{default:'a'};if(name.endsWith('.module.css'))return{default:{}};if(name==='@/lib/tools/client')return{toolsRequest:(...args)=>handler(...args),ToolsRequestError:class extends Error{}};throw Error(name)},document:{addEventListener(_event,fn){visibilityHandlers.push(fn)},removeEventListener(){},visibilityState:'visible'}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/documents/document-access.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context)
const flatten=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(flatten):[node,...flatten(node.props?.children)]
const render=()=>{cursor=0;return flatten(context.exports.DocumentAccess({children:access=>jsxRuntime.jsx('article',{children:access.tag?.name||'admin'})}))}
render();handler=async()=>({tag:null,admin:false});for(const fn of effects)fn();await new Promise(setImmediate)
let nodes=render();assert.ok(nodes.find(n=>n.props?.id==='documents-pin'));assert.ok(!nodes.find(n=>n.type==='article'))
nodes.find(n=>n.props?.id==='documents-pin').props.onChange({target:{value:'12345'}})
handler=async()=>{throw Error('PIN tidak valid')};render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate);assert.ok(!render().find(n=>n.type==='article'))
handler=async()=>({tag:{id:'tag-a',name:'Koleksi A',kind:'instansi'},admin:false,userId:null});render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)
assert.ok(render().find(n=>n.type==='article'&&n.props.children==='Koleksi A'))
const originalScope=render()[0].key
render().find(n=>n.type==='button'&&n.props.children==='Ganti PIN kelompok').props.onClick()
assert.ok(render().find(n=>n.type==='article'&&n.props.children==='Koleksi A'),'opening the change-PIN form must preserve the active collection')
assert.equal(render()[0].key,originalScope,'opening the change-PIN form must preserve unsaved child state')
render().find(n=>n.props?.id==='documents-pin').props.onChange({target:{value:'54321'}})
const showPin=()=>render().find(n=>n.type==='button'&&n.props.children==='Tampilkan PIN')
showPin().props.onClick();assert.equal(render().find(n=>n.props?.id==='documents-pin').props.type,'text')
render().find(n=>n.type==='button'&&n.props.children==='Sembunyikan PIN').props.onClick();assert.equal(render().find(n=>n.props?.id==='documents-pin').props.type,'password')
handler=async()=>{throw Error('PIN baru tidak valid')}
render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)
assert.equal(render()[0].key,originalScope);assert.ok(render().find(n=>n.type==='article'&&n.props.children==='Koleksi A'),'failed new PIN must keep the current collection mounted')
assert.ok(render().find(n=>n.props?.role==='alert'))
render().find(n=>n.type==='button'&&n.props.children==='Batal ganti PIN').props.onClick()
assert.ok(!render().find(n=>n.type==='form'));assert.equal(render()[0].key,originalScope)
render().find(n=>n.type==='button'&&n.props.children==='Ganti PIN kelompok').props.onClick()
assert.equal(render().find(n=>n.props?.id==='documents-pin').props.value,'');assert.equal(render().find(n=>n.props?.id==='documents-pin').props.type,'password')
handler=async()=>({tag:{id:'tag-b',name:'Koleksi B',kind:'divisi'},admin:false,userId:null})
render().find(n=>n.props?.id==='documents-pin').props.onChange({target:{value:'98765'}})
render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)
assert.notEqual(render()[0].key,originalScope);assert.ok(render().find(n=>n.type==='article'&&n.props.children==='Koleksi B'));assert.ok(!render().find(n=>n.type==='form'))
render().find(n=>n.type==='button'&&n.props.children==='Ganti PIN kelompok').props.onClick()
render().find(n=>n.props?.id==='documents-pin').props.onChange({target:{value:'33333'}});showPin().props.onClick()
handler=async()=>({tag:{id:'tag-b',name:'Koleksi B',kind:'divisi'},admin:false,userId:'another-account'})
visibilityHandlers[0]();await new Promise(setImmediate)
assert.ok(!render().find(n=>n.type==='form'),'account change must close the PIN form')
render().find(n=>n.type==='button'&&n.props.children==='Ganti PIN kelompok').props.onClick()
assert.equal(render().find(n=>n.props?.id==='documents-pin').props.value,'');assert.equal(render().find(n=>n.props?.id==='documents-pin').props.type,'password')
const lock=render().find(n=>n.type==='button'&&n.props.children==='Kunci dokumen');assert.ok(lock);lock.props.onClick();assert.ok(!render().find(n=>n.type==='article'))
console.log('Documents PIN gate: failed/cancelled PIN switch preserves collection and child scope; successful switch, visibility toggle, account clearing, and immediate lock verified.')


// Exercise the existing letter form with protected metadata and generation errors.
const formState=[];let formCursor=0;let effect;let resetCount=0;let requestedBody
const config={single:[{key:'nama',label:'Nama'}],groups:[]}
class RequestError extends Error{constructor(message,status){super(message);this.status=status}}
const formReact={...React,useState(initial){const i=formCursor++;if(!(i in formState))formState[i]=typeof initial==='function'?initial():initial;return[formState[i],v=>{formState[i]=typeof v==='function'?v(formState[i]):v}]},useEffect(fn){effect=fn},useMemo:fn=>fn()}
const DocumentAccess=()=>null
const formContext={exports:{},AbortController,console,setTimeout,require(name){if(name==='react')return formReact;if(name==='react/jsx-runtime')return jsxRuntime;if(name==='next/link')return{default:'a'};if(name==='next/dynamic')return{default:()=>()=>null};if(name==='next/navigation')return{useParams:()=>({code:'surat_tugas'})};if(name==='@/app/tools/components/suite-frame')return{SuiteFrame:'main'};if(name==='@/lib/tools/client')return{toolsRequest:async()=>({name:'Surat Uji',version_id:'version-42',fields:config}),ToolsRequestError:RequestError};if(name==='../document-access')return{DocumentAccess};if(name==='@phosphor-icons/react')return new Proxy({},{get:(_,key)=>key});if(name==='@/lib/dateHelper')return{};if(name.endsWith('.module.css'))return{default:{}};throw Error(name)},fetch:async(_url,init)=>{requestedBody=JSON.parse(init.body);return{ok:false,status:409,json:async()=>({error:'Versi berubah'})}}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/documents/[code]/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,formContext)
const pageNodes=flatten(formContext.exports.default());const formComponent=pageNodes.find(node=>node.type===DocumentAccess).props.children({},()=>resetCount++)
const renderForm=()=>{formCursor=0;return flatten(formComponent.type(formComponent.props))}
renderForm();effect();await new Promise(setImmediate)
assert.ok(renderForm().find(node=>node.props?.children==='Surat Uji'))
renderForm().find(node=>node.props?.id==='single-nama').props.onChange({target:{value:'Contoh'}})
renderForm().find(node=>node.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)
assert.equal(requestedBody.version_id,'version-42');assert.equal(requestedBody.single.nama,'Contoh')
assert.ok(renderForm().find(node=>node.type==='button'&&node.props.children==='Muat versi terbaru'))
formContext.fetch=async()=>({ok:false,status:401,json:async()=>({error:'Akses berakhir'})})
renderForm().find(node=>node.type==='form').props.onSubmit({preventDefault(){}});await new Promise(setImmediate)
assert.equal(resetCount,1);assert.ok(!renderForm().find(node=>node.props?.children==='Surat Uji'));assert.ok(!renderForm().find(node=>node.props?.id==='single-nama'))
console.log('Documents letter form: protected version sent, changed-version reload, and expired-session metadata clearing verified.')

// Admin publication requires a successful test and an explicit review of that version.
const adminState=[];let adminCursor=0;let adminEffect;const adminCalls=[]
const adminIdentity={userId:'admin-a',workspaceId:'workspace-a',isTemplateAdmin:true}
const adminTag={id:'tag-a',name:'Koleksi A',active:true,pin_configured:true,revision:2,kind:'instansi',organization:'Lembaga',division:''}
const adminTemplate={id:'template-a',name:'Surat Uji',code:'surat_uji',kind:'Surat',organization:'Lembaga',division:'',description:'',access_tag_id:'tag-a',revision:3,status:'draft',active_version_id:null}
let adminVersion={id:'version-a',file_name:'surat.docx',created_at:'2026-10-25T00:00:00Z',fields:config,status:'draft'}
const TestDocument=()=>null
const adminContext={exports:{},AbortController,console,setTimeout,crypto:{randomUUID:()=> 'operation-a'},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},document:{createElement:()=>({click(){}})},window:{confirm:()=>true},require(name){
 if(name==='react')return{...React,useState(initial){const i=adminCursor++;if(!(i in adminState))adminState[i]=typeof initial==='function'?initial():initial;return[adminState[i],v=>{adminState[i]=typeof v==='function'?v(adminState[i]):v}]},useEffect(fn){adminEffect=fn}}
 if(name==='react/jsx-runtime')return jsxRuntime
 if(name==='next/link')return{default:'a'}
 if(name==='@/lib/tools/client')return{useTools:()=>({context:adminIdentity}),ToolsRequestError:RequestError,toolsRequest:async(url,init)=>{adminCalls.push([url,init]);if(url.endsWith('/tags'))return[adminTag];if(url.endsWith('/templates'))return[adminTemplate];if(url.endsWith('/publish'))return adminTemplate;return{...adminTemplate,versions:[adminVersion,{...adminVersion,id:'version-b',status:'history'}]}}}
 if(name==='@/app/tools/components/tools-shell')return{ToolsShell:'shell'}
 if(name==='./field-config')return{FieldConfig:()=>null}
 if(name==='./test-document')return{TestDocument}
 if(name.endsWith('.module.css'))return{default:{}}
 throw Error(name)
},fetch:async()=>{adminVersion={...adminVersion,status:adminVersion.status==='history'?'history':'validated'};return{ok:true,blob:async()=>({}),headers:{get:()=>null}}}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/documents/admin/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,adminContext)
let adminNode=flatten(adminContext.exports.default()).find(node=>typeof node.type==='function');assert.equal(adminNode.key,'admin-a:workspace-a')
adminIdentity.userId='admin-b';assert.equal(flatten(adminContext.exports.default()).find(node=>typeof node.type==='function').key,'admin-b:workspace-a')
adminIdentity.isTemplateAdmin=false;assert.ok(!flatten(adminContext.exports.default()).find(node=>typeof node.type==='function'));adminIdentity.isTemplateAdmin=true
const renderAdmin=()=>{adminCursor=0;return flatten(adminNode.type())}
renderAdmin();adminEffect();await new Promise(setImmediate)
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):text(node?.props?.children||'')
renderAdmin().find(node=>node.type==='button'&&text(node)==='Surat UjiDraf').props.onClick();await new Promise(setImmediate)
assert.equal(renderAdmin().find(node=>node.type==='button'&&node.props.children==='Terbitkan versi').props.disabled,true)
assert.equal(renderAdmin().find(node=>node.type==='input'&&node.props.type==='checkbox').props.disabled,true)
await renderAdmin().find(node=>node.type===TestDocument).props.run({nama:'Contoh'},{});await new Promise(setImmediate)
const review=renderAdmin().find(node=>node.type==='input'&&node.props.type==='checkbox');assert.equal(review.props.disabled,false)
review.props.onChange({target:{checked:true}})
const publish=renderAdmin().find(node=>node.type==='button'&&node.props.children==='Terbitkan versi');assert.equal(publish.props.disabled,false)
publish.props.onClick();await new Promise(setImmediate)
const publishCall=adminCalls.find(([url])=>url.endsWith('/publish'));assert.deepEqual(JSON.parse(publishCall[1].body),{revision:3,version_id:'version-a',reviewed:true})
console.log('Documents admin: role boundary, identity-scoped state, test-before-review, and reviewed version publication verified.')

// A retired version must be tested in this selection before it can be reviewed.
adminVersion={...adminVersion,status:'history'}
renderAdmin().find(node=>node.type==='button'&&text(node)==='Surat UjiDraf').props.onClick();await new Promise(setImmediate)
const reviewBox=()=>renderAdmin().find(node=>node.type==='input'&&node.props.type==='checkbox')
assert.equal(reviewBox().props.disabled,true)
const successfulTest=adminContext.fetch
adminContext.fetch=async()=>({ok:false,status:400,json:async()=>({error:'Isian uji belum lengkap'})})
await renderAdmin().find(node=>node.type===TestDocument).props.run({},{});await new Promise(setImmediate)
assert.equal(reviewBox().props.disabled,true)
adminContext.fetch=successfulTest
await renderAdmin().find(node=>node.type===TestDocument).props.run({nama:'Contoh lama'},{});await new Promise(setImmediate)
assert.equal(adminVersion.status,'history')
assert.equal(reviewBox().props.disabled,false,'a successfully tested historical version must be reviewable')
reviewBox().props.onChange({target:{checked:true}})
assert.equal(renderAdmin().find(node=>node.type==='button'&&node.props.children==='Terbitkan versi').props.disabled,false)
const versionSelect=()=>renderAdmin().find(node=>node.type==='select'&&node.props.value==='version-a')
versionSelect().props.onChange({target:{value:'version-b'}})
assert.equal(reviewBox().props.disabled,true,'the prior successful test must not authorize a different historical version')
assert.equal(reviewBox().props.checked,false)
assert.equal(renderAdmin().find(node=>node.type==='button'&&node.props.children==='Terbitkan versi').props.disabled,true)
renderAdmin().find(node=>node.type==='select'&&node.props.value==='version-b').props.onChange({target:{value:'version-a'}})
assert.equal(reviewBox().props.disabled,true,'changing selection requires a fresh test for a historical version')
await renderAdmin().find(node=>node.type===TestDocument).props.run({nama:'Contoh lama'},{});await new Promise(setImmediate)
reviewBox().props.onChange({target:{checked:true}})
renderAdmin().find(node=>node.type==='button'&&node.props.children==='Terbitkan versi').props.onClick();await new Promise(setImmediate)
assert.deepEqual(JSON.parse(adminCalls.filter(([url])=>url.endsWith('/publish')).at(-1)[1].body),{revision:3,version_id:'version-a',reviewed:true})
console.log('Documents historical version: successful selected-version test enables review/publication; failed test and version changes stay locked.')
