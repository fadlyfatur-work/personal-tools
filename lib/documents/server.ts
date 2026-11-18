import {cookies} from 'next/headers'
import {createHash,randomUUID} from 'node:crypto'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {getToolsContext,ToolsError} from '@/lib/tools/server'
import {sharedRateLimit} from '@/lib/tools/limits'
import {DOCUMENTS_COOKIE,readDocumentGrant,grantMatchesTag} from './pin'
import {inspectDocx,validateTemplateFields,validatePlaceholderCoverage} from './policy'
import type{AccessTag,DocumentTemplate,DocumentVersion}from './types'

export const DOCUMENTS_BUCKET='documents-private'
export const TEMPLATE_COLUMNS='id,code,name,kind,organization,division,description,access_tag_id,status,revision,active_version_id'
export const TAG_COLUMNS='id,name,kind,organization,division,active,revision,access_version'
export function documentSecret(name:'DOCUMENTS_PIN_LOOKUP_SECRET'|'DOCUMENTS_SESSION_SECRET'){
  const value=process.env[name];if(!value||value.length<32)throw new ToolsError(503,'Akses dokumen belum dikonfigurasi. Hubungi pengelola.','SETUP_REQUIRED');return value
}
export function documentDbError(error:{message?:string;code?:string}|null){
  if(!error)return
  const message=error.message||''
  if(message.includes('ADMIN_REQUIRED'))throw new ToolsError(403,'Hak admin template diperlukan.','ADMIN_REQUIRED')
  if(error.code==='23505'||/PIN_ALREADY_USED/.test(message))throw new ToolsError(409,'Nama, kode, atau PIN tersebut sudah digunakan.','ALREADY_EXISTS')
  if(/REVISION_CONFLICT/.test(message))throw new ToolsError(409,'Data sudah berubah. Muat versi terbaru sebelum menyimpan.','REVISION_CONFLICT')
  if(/TAG_NOT_EMPTY/.test(message))throw new ToolsError(409,'Tag masih memiliki template. Pindahkan atau hapus template terlebih dahulu.','TAG_NOT_EMPTY')
  if(/VALIDATION_REQUIRED|REVIEW_REQUIRED/.test(message))throw new ToolsError(409,'Uji dan periksa hasil Word sebelum menerbitkan.','REVIEW_REQUIRED')
  if(/TAG_INVALID|PUBLISH_REQUIRED|INVALID_TRANSITION|PIN_REQUIRED/.test(message))throw new ToolsError(409,'Status atau kelompok akses belum siap untuk perubahan ini.','INVALID_TRANSITION')
  if(/NOT_FOUND|VERSION_INVALID/.test(message))throw new ToolsError(404,'Template tidak tersedia.','NOT_FOUND')
  throw new ToolsError(503,'Penyimpanan dokumen belum tersedia. Periksa penyiapan atau coba kembali.','SERVICE_UNAVAILABLE')
}
export async function getDocumentAccess(request?:Request){
  let userId:string|undefined,admin=false
  try{const context=await getToolsContext(request);userId=context.userId;admin=context.isTemplateAdmin}catch(error){if(!(error instanceof ToolsError)||![401,403].includes(error.status))throw error}
  const token=(await cookies()).get(DOCUMENTS_COOKIE)?.value
  const grant=token?await readDocumentGrant(token,documentSecret('DOCUMENTS_SESSION_SECRET')):null
  let tag:AccessTag|null=null
  if(grant){const{data,error}=await supabaseAdmin.from('documents_access_tags').select(`${TAG_COLUMNS},pin_hash`).eq('id',grant.tagId).maybeSingle();documentDbError(error);if(data?.pin_hash&&grantMatchesTag(grant,data))tag=data as AccessTag}
  return{admin,userId,tag,grant:tag?grant:null}
}
export async function getAuthorizedTemplate(request:Request,code:string){
  const access=await getDocumentAccess(request)
  if(!access.admin&&!access.tag)throw new ToolsError(401,'Masukkan PIN kelompok dokumen untuk melanjutkan.','DOCUMENT_ACCESS_REQUIRED')
  let query=supabaseAdmin.from('documents_templates').select(TEMPLATE_COLUMNS).eq('code',code)
  if(!access.admin)query=query.eq('access_tag_id',access.tag!.id).eq('status','published')
  const{data,error}=await query.maybeSingle();documentDbError(error)
  if(!data||data.status==='deleted'||!data.active_version_id)throw new ToolsError(404,'Template tidak tersedia.','NOT_FOUND')
  const{data:version,error:versionError}=await supabaseAdmin.from('documents_template_versions').select('*').eq('template_id',data.id).eq('id',data.active_version_id).maybeSingle();documentDbError(versionError)
  if(!version)throw new ToolsError(404,'Versi template tidak tersedia.')
  return{access,template:data as DocumentTemplate,version:version as DocumentVersion}
}
export async function readDocumentFile(version:DocumentVersion){
  const{data,error}=await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).download(version.file_key)
  if(error||!data)throw new ToolsError(503,'File template belum dapat dimuat. Coba kembali.','FILE_UNAVAILABLE')
  const buffer=Buffer.from(await data.arrayBuffer())
  if(createHash('sha256').update(buffer).digest('hex')!==version.checksum)throw new ToolsError(503,'File template perlu diperiksa oleh admin.','FILE_INVALID')
  return buffer
}
export async function readDocumentBody(request:Request,maxBytes:number){
  if(Number(request.headers.get('content-length')||0)>maxBytes)throw new ToolsError(413,'Data terlalu besar.')
  const reader=request.body?.getReader()
  if(!reader)return Buffer.alloc(0)
  const chunks:Uint8Array[]=[];let length=0
  try{for(;;){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;if(length>maxBytes){await reader.cancel();throw new ToolsError(413,'Data terlalu besar.')}chunks.push(chunk.value)}}finally{reader.releaseLock()}
  return Buffer.concat(chunks)
}
export async function readJson(request:Request,maxBytes=2*1024*1024){
  const buffer=await readDocumentBody(request,maxBytes)
  try{return JSON.parse(buffer.toString('utf8'))}catch{throw new ToolsError(400,'Data permintaan tidak valid.')}
}
export async function readTemplateUpload(request:Request,actor:string){
  if(Number(request.headers.get('content-length')||0)>11*1024*1024)throw new ToolsError(413,'File maksimal 10 MiB.')
  const bounded=await readDocumentBody(request,11*1024*1024)
  const form=await new Response(new Uint8Array(bounded),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData().catch(()=>null)
  const file=form?.get('file')
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.docx')||file.size>10*1024*1024)throw new ToolsError(400,'Pilih file DOCX maksimal 10 MiB.')
  let metadata:Record<string,unknown>
  try{metadata=JSON.parse(String(form?.get('metadata')||'{}'))}catch{throw new ToolsError(400,'Isian template tidak valid.')}
  const buffer=Buffer.from(await file.arrayBuffer())
  let inspected,fields
  try{inspected=inspectDocx(buffer);fields=validateTemplateFields(metadata.fields||inspected.fields);validatePlaceholderCoverage(inspected.placeholders,fields)}catch(error){throw new ToolsError(400,error instanceof Error?error.message:'File template tidak valid.')}
  const id=typeof metadata.operation_id==='string'&&/^[0-9a-f-]{36}$/i.test(metadata.operation_id)?metadata.operation_id:randomUUID()
  return{metadata,buffer,version:{id,fields,file_key:`${actor}/${id}.docx`,file_name:file.name.slice(0,180),checksum:createHash('sha256').update(buffer).digest('hex')}}
}
export async function storeTemplateUpload(upload:Awaited<ReturnType<typeof readTemplateUpload>>){
  const{error}=await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).upload(upload.version.file_key,upload.buffer,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:false})
  if(error){
    const{data}=await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).download(upload.version.file_key)
    if(!data||createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex')!==upload.version.checksum)throw new ToolsError(503,'File belum dapat disimpan. Versi aktif tetap tersedia.','UPLOAD_FAILED')
  }
}
export async function documentRenderLimit(key:string,tagId?:string){
  const result=await sharedRateLimit(`documents:render:${key}`,20,60)
  const tag=tagId?await sharedRateLimit(`documents:tag-render:${tagId}`,100,60):null
  if(!result.allowed||tag&&!tag.allowed)throw new ToolsError(429,'Batas unduh tercapai. Tunggu sebentar lalu coba lagi.','RATE_LIMITED')
}
