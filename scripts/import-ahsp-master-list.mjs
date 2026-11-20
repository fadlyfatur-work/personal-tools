import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { textKey, codeKey, unitKey } from './reconcile-ahsp-master.mjs'

const supported=['SE 47/2026','SE 182/2025','PERMEN 08/2023','SPTJM']
const fields=['Bina Marga','Sumber Daya Air','Cipta Karya / Perumahan','Umum','SMKK']
const regulations=row=>[...new Set(String(row.regulasi_se??'').split(',').map(s=>s.trim().replace(/^PERMEN\s+0?8\/2023$/i,'PERMEN 08/2023')).filter(s=>supported.includes(s)))]
const idKey=i=>JSON.stringify([i.field,i.regulation,codeKey(i.code),textKey(i.name)])
const codeIdentity=i=>JSON.stringify([i.field,i.regulation,codeKey(i.code)||`name:${textKey(i.name)}`])
const nameIdentity=i=>JSON.stringify([i.field,i.regulation,textKey(i.name),unitKey(i.unit)])
const fullIdentity=i=>JSON.stringify([idKey(i),unitKey(i.unit),i.ahsp_type])
const index=(items,key)=>{const result=new Map();for(const item of items){const k=key(item);if(!result.has(k))result.set(k,[]);result.get(k).push(item)}return result}
const uuid=identity=>{const chars=createHash('sha256').update(`ahsp-master-list:${identity}`).digest('hex').slice(0,32).split('');chars[12]='8';chars[16]=(8|(parseInt(chars[16],16)&3)).toString(16);const h=chars.join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}

export function prepareMasterList(rows,catalog,{sha256,sourceName}){
  if(!/^[a-f0-9]{64}$/.test(sha256)||!Array.isArray(rows)||!rows.length)throw new Error('Sumber tidak valid')
  const expanded=[],excluded=[]
  for(const row of rows){
    if(!fields.includes(row.bidang))throw new Error(`Bidang tidak valid pada baris ${row.row}`)
    if(!textKey(row.name))throw new Error(`Nama pekerjaan kosong pada baris ${row.row}`)
    if(!['normative','informative'].includes(row.job_type))throw new Error(`Jenis pekerjaan tidak valid pada baris ${row.row}`)
    const regs=regulations(row)
    if(!regs.length){excluded.push(row);continue}
    for(const regulation of regs)expanded.push({code:String(row.code??'').trim(),name:row.name.trim(),unit:String(row.unit??'').trim(),field:row.bidang,regulation,ahsp_type:row.job_type==='normative'?'Normatif':'Informatif',row:row.row,overhead:row.overheat_and_profit_percentage})
  }
  const exact=index(catalog,fullIdentity),byCode=index(catalog,codeIdentity),byName=index(catalog,nameIdentity)
  const additions=[],review=[],existing=[]
  for(const [identity,group] of index(expanded,idKey)){
    const item=group[0]
    const variants=new Set(group.map(i=>JSON.stringify([unitKey(i.unit),i.ahsp_type,i.overhead])))
    const sourceRows=[...new Set(group.map(i=>i.row))].sort((a,b)=>a-b)
    if(variants.size>1){review.push({...item,reason:'Varian metadata sumber berbeda; perlu pemilihan manual',source_rows:sourceRows});continue}
    const matches=exact.get(fullIdentity(item))??[]
    if(matches.length){existing.push({...item,ids:matches.map(i=>i.id)});continue}
    const candidates=byCode.get(codeIdentity(item))??byName.get(nameIdentity(item))??[]
    if(candidates.length){review.push({...item,reason:'Kode atau nama yang sama sudah ada dengan metadata berbeda',catalog_ids:candidates.map(i=>i.id),source_rows:sourceRows});continue}
    const notes=['Master pekerjaan dari ekspor SIPASTI; rincian komponen, koefisien, dan rumus belum tersedia.']
    if(!item.unit)notes.push('Satuan pekerjaan kosong pada sumber terbaru; perlu pemeriksaan.')
    if(group.length>1)notes.push('Duplikat metadata sumber dikelompokkan; rincian masing-masing baris belum dapat dibandingkan.')
    additions.push({id:uuid(identity),code:item.code,name:item.name,unit:item.unit,field:item.field,regulation:item.regulation,ahsp_type:item.ahsp_type,
      regulation_status:item.regulation==='SE 182/2025'?'Digantikan oleh SE 47/2026':'',division:'',
      components:[],analysis_status:'unavailable',analysis_origin:'sipasti',analysis_target_id:null,analysis_reference:null,
      source_id:null,page_from:null,page_to:null,printed_page:'',source_text:'',output_quantity:1,overhead_min:null,overhead_max:null,
      verification_status:'needs_review',verification_notes:notes,reconciliation_status:'perlu_ditinjau',reconciliation_notes:notes,
      sipasti_origin:true,sipasti_status:'sipasti_only',sipasti_sha256:sha256,sipasti_rows:sourceRows,master_rows:[],
      master_provenance:{source_name:sourceName,source_sha256:sha256,source_rows:sourceRows,source_overhead_percentage:item.overhead,master_only:true,matched:false,imported_by:'import-ahsp-master-list',source_duplicate_rows:group.length-1}})
  }
  return {additions,existing,review,excluded,summary:{source_rows:rows.length,source_edition_rows:expanded.length,additions:additions.length,additions_by_regulation:additions.reduce((o,i)=>(o[i.regulation]=(o[i.regulation]??0)+1,o),{}),already_present_groups:existing.length,review_groups:review.length,excluded_regulation_rows:excluded.length}}
}

async function main(){
  const [sourceFile,output,...flags]=process.argv.slice(2)
  if(!sourceFile||!output||flags.some(f=>f!=='--apply'))throw new Error('Gunakan: node --env-file=.env.local scripts/import-ahsp-master-list.mjs <master-fields.json> <folder> [--apply]')
  const apply=flags.includes('--apply'),source=JSON.parse(readFileSync(sourceFile,'utf8'))
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const folder=resolve(output);mkdirSync(folder,{recursive:true})
  const catalog=[]
  for(let offset=0;;offset+=300){const r=await db.from('ahsp_items').select('*').order('id').range(offset,offset+299);if(r.error)throw new Error(`Snapshot gagal: ${r.error.code??''} ${r.error.message}`);catalog.push(...r.data);if(r.data.length<300)break}
  const plan=prepareMasterList(source.rows,catalog,{sha256:source.sha256,sourceName:source.source_name})
  const stem=join(folder,new Date().toISOString().replaceAll(':','-'))
  writeFileSync(`${stem}-catalog-before.json`,JSON.stringify({captured_at:new Date().toISOString(),items:catalog}))
  writeFileSync(`${stem}-plan.json`,JSON.stringify(plan))
  console.log(JSON.stringify({...plan.summary,apply},null,2))
  if(!apply)return
  // A single insert request makes all new catalog rows transactional; the raw source may safely precede it.
  if(plan.additions.length>500)throw new Error('Lebih dari 500 tambahan; periksa rencana sebelum menambah ukuran transaksi')
  const occupied=new Map(catalog.map(i=>[i.id,i]))
  for(const item of plan.additions)assert.ok(!occupied.has(item.id),'ID katalog sudah dipakai untuk identitas berbeda')
  const archive=await db.from('ahsp_sipasti_imports').upsert({sha256:source.sha256,source_name:source.source_name,source_rows:source.rows},{onConflict:'sha256',ignoreDuplicates:true})
  if(archive.error)throw new Error(`Arsip sumber gagal: ${archive.error.message}`)
  if(plan.additions.length){const r=await db.from('ahsp_items').insert(plan.additions);if(r.error)throw new Error(`Penambahan dibatalkan: ${r.error.code} ${r.error.message}`)}
  const after=[]
  for(let offset=0;;offset+=300){const r=await db.from('ahsp_items').select('*').order('id').range(offset,offset+299);if(r.error)throw new Error(`Verifikasi gagal: ${r.error.message}`);after.push(...r.data);if(r.data.length<300)break}
  const byId=new Map(after.map(i=>[i.id,i]))
  for(const item of catalog)assert.deepEqual(byId.get(item.id),item,`Item lama berubah: ${item.code}`)
  for(const item of plan.additions){const stored=byId.get(item.id);assert.ok(stored);for(const [key,value] of Object.entries(item))assert.deepEqual(stored[key],value,`Hasil berbeda: ${item.code} ${key}`)}
  assert.equal(after.length,catalog.length+plan.additions.length)
  const rerun=prepareMasterList(source.rows,after,{sha256:source.sha256,sourceName:source.source_name})
  assert.equal(rerun.additions.length,0,'Impor ulang masih menemukan tambahan')
  const report={source:source.source_name,source_sha256:source.sha256,verified_at:new Date().toISOString(),before:catalog.length,after:after.length,...plan.summary,old_rows_unchanged:true,reimport_additions:rerun.additions.length}
  writeFileSync(join(folder,'applied.json'),JSON.stringify(report,null,2))
  writeFileSync(`${stem}-catalog-after.json`,JSON.stringify({captured_at:new Date().toISOString(),items:after}))
  console.log(JSON.stringify(report,null,2))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main()
