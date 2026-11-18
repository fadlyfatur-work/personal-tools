import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

const secret='test-only-documents-server-key-'.repeat(3)
process.env.DOCUMENTS_SESSION_SECRET=secret
process.env.DOCUMENTS_PIN_LOOKUP_SECRET=secret+'lookup'
const pins=loadSuiteModule('lib/documents/pin.ts')
const builtIn=loadSuiteModule('lib/documentTemplates.ts').documentTemplates.surat_tugas
const file=fs.readFileSync('storage/data/surat_tugas.docx')
const tagId='11111111-1111-4111-8111-111111111111',otherTag='22222222-2222-4222-8222-222222222222',versionId='33333333-3333-4333-8333-333333333333'
const tag={id:tagId,name:'Kelompok uji',kind:'instansi',active:true,revision:1,access_version:1,pin_hash:await pins.hashPin('00123'),pin_digest:pins.pinDigest('00123',process.env.DOCUMENTS_PIN_LOOKUP_SECRET)}
const tables={documents_access_tags:[tag],documents_templates:[{id:'44444444-4444-4444-8444-444444444444',code:'surat_tugas',name:'Surat Tugas',access_tag_id:tagId,status:'published',active_version_id:versionId,revision:1},{id:'55555555-5555-4555-8555-555555555555',code:'private_other',name:'Rahasia lain',access_tag_id:otherTag,status:'published',active_version_id:versionId,revision:1}],documents_template_versions:[{id:versionId,template_id:'44444444-4444-4444-8444-444444444444',fields:builtIn.fields,file_key:'private/file.docx',checksum:createHash('sha256').update(file).digest('hex')}]}
const jar=new Map();let user=null;let admin=false;let rateUnavailable=false;const reads=[]
class Query{
  constructor(table){this.table=table;this.filters=[];this.one=false;reads.push(table)}
  select(){return this}eq(key,val){this.filters.push(row=>row[key]===val);return this}order(){return this}limit(){return this}range(){return this}ilike(){return this}maybeSingle(){this.one=true;return this}
  then(resolve,reject){const rows=(tables[this.table]||[]).filter(row=>this.filters.every(predicate=>predicate(row)));return Promise.resolve({data:this.one?rows[0]||null:rows,error:null}).then(resolve,reject)}
}
const db={from:table=>new Query(table),rpc:async(name)=>name==='tools_bootstrap'?{data:{name:'Penguji',is_template_admin:admin,workspaces:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Uji',role:'owner'}]},error:null}:name==='tools_take_rate_limit'?{data:rateUnavailable?null:{allowed:true,retry_after:1},error:rateUnavailable?{message:'unavailable'}:null}:{data:null,error:{message:'unexpected mutation'}},storage:{from:()=>({download:async()=>({data:new Blob([file]),error:null})})}}
const stubs={'next/headers':{cookies:async()=>({get:key=>jar.has(key)?{value:jar.get(key)}:undefined,getAll:()=>[],set:(key,value)=>jar.set(key,value)})},'@/lib/supabaseAdmin':{supabaseAdmin:db},'@/lib/tools/auth':{getToolsAuth:async()=>({auth:{getUser:async()=>({data:{user},error:null})}})}}
// Resolve relative auth import used inside the real shared server boundary.
stubs['./auth']=stubs['@/lib/tools/auth']
const cache=new Map()
const route=loadSuiteModule('app/api/documents/[[...path]]/route.ts',stubs,cache)
const generate=loadSuiteModule('app/api/generate/route.ts',stubs,cache)
const get=path=>route.GET(new Request('https://app.test/api/documents/'+path))
const post=(path,body)=>route.POST(new Request('https://app.test/api/documents/'+path,{method:'POST',headers:{origin:'https://app.test','Content-Type':'application/json'},body:JSON.stringify(body)}))
assert.equal((await get('templates')).status,401)
assert.equal((await get('templates/surat_tugas')).status,401)
assert.equal((await post('admin/tags',{name:'intruder',pin:'00123'})).status,401)
assert.equal((await post('access',{pin:'00124'})).status,401)
assert.equal((await post('access',{pin:'00123'})).status,200)
const listed=await (await get('templates')).json()
assert.equal(listed.data.length,1)
assert.equal(listed.data[0].code,'surat_tugas')
assert.ok(!JSON.stringify(listed).includes(tag.pin_hash))
assert.equal((await get('templates/private_other')).status,404)
const detail=await(await get('templates/surat_tugas')).json()
assert.equal(detail.data.version_id,versionId)
assert.ok(!JSON.stringify(detail).includes('file_key'))
const single=Object.fromEntries(builtIn.fields.single.map(field=>[field.key,field.type==='dateRange'?{start:'2026-10-27',end:'2026-10-27'}:field.type==='date'?'2026-10-27':field.type==='select'?field.options[0]:'Uji DOCX']))
const payload={code:'surat_tugas',version_id:versionId,single,groups:{pegawai:[{nama_lengkap:'Pegawai Uji',golongan:'III',sub_golongan:'a',nip:'000000000000000000',jabatan:'Penguji'}]}}
const make=body=>generate.POST(new Request('https://app.test/api/generate',{method:'POST',headers:{origin:'https://app.test','Content-Type':'application/json'},body:JSON.stringify(body)}))
assert.equal((await make({...payload,version_id:undefined})).status,409)
const result=await make(payload)
assert.equal(result.status,200,await result.clone().text())
assert.equal(result.headers.get('cache-control'),'private, no-store')
const many=await make({...payload,groups:{pegawai:Array.from({length:20},(_,i)=>({...payload.groups.pegawai[0],nama_lengkap:`Pegawai ${i+1}`}))}})
assert.equal(many.status,200)
for(const patch of [{single:{...single,nomor_surat:''}},{single:{...single,jenis_transportasi:'Tidak valid'}},{groups:{pegawai:[]}},{groups:{pegawai:Array.from({length:21},()=>payload.groups.pegawai[0])}},{single:{...single,tanggal:'2026-02-30'}}])assert.equal((await make({...payload,...patch})).status,400)
for(const transport of ['Transportasi darat','Transportasi udara','Transportasi air'])assert.equal((await make({...payload,single:{...single,jenis_transportasi:transport}})).status,200)
tag.access_version=2
assert.equal((await get('templates')).status,401,'Rotation invalidates grant on next read')
assert.equal((await make(payload)).status,401,'Rotation protects legacy render too')
user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'test@example.invalid',user_metadata:{name:'Test'}}
assert.equal((await get('admin/tags')).status,403,'Account alone does not make admin')
assert.equal((await get('templates')).status,401,'Account alone does not unlock templates')
const accountUnlock=await(await post('access',{pin:'00123'})).json()
const accountAccess=await(await get('access')).json()
assert.equal(accountUnlock.data.userId,accountAccess.data.userId,'PIN unlock and background verification must identify the same account scope')
admin=true
assert.equal((await get('admin/tags')).status,200)
const burst=await Promise.all(Array.from({length:5},()=>post('access',{pin:'00123'})))
assert.ok(burst.some(response=>response.status===429),'Concurrent expensive PIN checks must be bounded')
assert.equal((await make({...payload,single:{...single,nama_acara:'x'.repeat(2*1024*1024)}})).status,413)
rateUnavailable=true
assert.equal((await post('access',{pin:'00123'})).status,503,'Limiter fails closed')
assert.equal((await route.POST(new Request('https://app.test/api/documents/access',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'}))).status,403)
assert.ok(reads.includes('documents_templates'))
console.log('PASS: real Documents API and generator guards, PIN lookup, tag-only catalog, no account escalation, version conflict, rotation, no-store, origin and limiter failure.')
