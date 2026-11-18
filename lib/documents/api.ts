import {cookies} from 'next/headers'
import {randomUUID} from 'node:crypto'
import {z} from 'zod'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {getToolsContext,ToolsError,toolsJson} from '@/lib/tools/server'
import {sharedRateLimit,trustedSource} from '@/lib/tools/limits'
import {DOCUMENTS_COOKIE,DOCUMENTS_GRANT_SECONDS,createDocumentGrant,hashPin,normalizePin,pinDigest,verifyPin} from './pin'
import {inspectDocx,validateTemplateFields} from './policy'
import {docxResponse,documentPayload,renderDocument} from './render'
import {documentDbError,documentSecret,getDocumentAccess,getAuthorizedTemplate,TAG_COLUMNS,TEMPLATE_COLUMNS,readJson,readTemplateUpload,storeTemplateUpload,readDocumentFile,documentRenderLimit} from './server'
import type{DocumentVersion}from './types'

const text=z.string().trim().max(160)
const metadataSchema=z.object({code:z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/),name:text.min(1),kind:text.default(''),organization:text.default(''),division:text.default(''),description:z.string().max(2000).default(''),access_tag_id:z.string().uuid()})
const tagSchema=z.object({name:z.string().trim().min(1).max(100),kind:z.string().trim().min(1).max(60),organization:text.default(''),division:text.default(''),pin:z.string().optional(),active:z.boolean().optional(),revision:z.number().int().positive().optional(),revoke:z.boolean().optional()})
let activePinChecks=0
function parse<T>(schema:z.ZodType<T>,value:unknown):T{const result=schema.safeParse(value);if(!result.success)throw new ToolsError(400,'Isian tidak lengkap atau tidak valid. Periksa nama, kelompok, dan variabel.','VALIDATION_FAILED');return result.data}
const summary=(row:Record<string,unknown>)=>({...row,version_id:row.active_version_id})
async function adminTemplate(id:string){const{data,error}=await supabaseAdmin.from('documents_templates').select(TEMPLATE_COLUMNS).eq('id',id).maybeSingle();documentDbError(error);if(!data)throw new ToolsError(404,'Template tidak ditemukan.');return data}
function safeTag(tag:Record<string,unknown>){const{id,name,kind,organization,division,active,revision,access_version}=tag;return{id,name,kind,organization,division,active,revision,access_version,pin_configured:Boolean(tag.pin_hash)}}

export async function handleDocumentsRequest(request:Request){
  const url=new URL(request.url)
  let parts:string[]
  try{parts=url.pathname.replace(/^\/api\/documents\/?/,'').split('/').filter(Boolean).map(decodeURIComponent)}catch{throw new ToolsError(400,'Alamat tidak valid.')}
  const method=request.method
  if(parts[0]==='access'){
    if(method==='GET'){const access=await getDocumentAccess(request);return toolsJson({tag:access.tag?{id:access.tag.id,name:access.tag.name,kind:access.tag.kind}:null,admin:access.admin,userId:access.userId||null,expiresAt:access.grant?.expiresAt})}
    const jar=await cookies()
    if(method==='DELETE'){jar.set(DOCUMENTS_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});return toolsJson({success:true})}
    if(method==='POST'){
      const raw=await readJson(request,2048)
      let pin:string
      try{pin=normalizePin(raw?.pin)}catch{throw new ToolsError(400,'PIN harus berisi 5–12 digit angka.','PIN_FORMAT')}
      const digest=pinDigest(pin,documentSecret('DOCUMENTS_PIN_LOOKUP_SECRET'))
      let browser=jar.get('documents_attempt')?.value
      if(!browser||!/^[0-9a-f-]{36}$/i.test(browser)){browser=randomUUID();jar.set('documents_attempt',browser,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:86400})}
      const limits=await Promise.all([sharedRateLimit(`documents:attempt:${browser}`,10,900),sharedRateLimit(`documents:network:${trustedSource(request)}`,100,900),sharedRateLimit(`documents:pin:${digest}`,30,900)])
      const blocked=limits.filter(item=>!item.allowed)
      if(blocked.length)return Response.json({error:'Terlalu banyak percobaan. Tunggu sebelum mencoba lagi.',code:'RATE_LIMITED'},{status:429,headers:{'Retry-After':String(Math.max(...blocked.map(item=>item.retry_after)))}})
      const{data:tag,error}=await supabaseAdmin.from('documents_access_tags').select(`${TAG_COLUMNS},pin_hash`).eq('pin_digest',digest).eq('active',true).maybeSingle();documentDbError(error)
      if(activePinChecks>=4)throw new ToolsError(429,'Pemeriksaan PIN sedang penuh. Tunggu sebentar lalu coba lagi.','RATE_LIMITED',5)
      activePinChecks++
      let valid:boolean
      try{valid=await verifyPin(pin,tag?.pin_hash||'$2b$12$7chF6UNhz5uJvJXud3tGV.OgSVS8aaij11kWZol9GnmUSx0QwiXfK')}finally{activePinChecks--}
      if(!tag||!tag.pin_hash||!valid)throw new ToolsError(401,'PIN tidak valid atau tidak tersedia.','PIN_INVALID')
      const token=await createDocumentGrant({tagId:tag.id,version:tag.access_version},documentSecret('DOCUMENTS_SESSION_SECRET'))
      jar.set(DOCUMENTS_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:DOCUMENTS_GRANT_SECONDS})
      const access=await getDocumentAccess(request)
      return toolsJson({tag:{id:tag.id,name:tag.name,kind:tag.kind},admin:access.admin,userId:access.userId||null,expiresAt:access.grant?.expiresAt})
    }
  }
  if(parts[0]==='templates'&&method==='GET'){
    if(parts[1]){const{template,version}=await getAuthorizedTemplate(request,parts[1]);return toolsJson({...summary(template),fields:version.fields})}
    const access=await getDocumentAccess(request)
    if(!access.admin&&!access.tag)throw new ToolsError(401,'Masukkan PIN kelompok dokumen untuk melanjutkan.','DOCUMENT_ACCESS_REQUIRED')
    let query=supabaseAdmin.from('documents_templates').select(TEMPLATE_COLUMNS).eq('status','published').order('name').order('id')
    if(!access.admin)query=query.eq('access_tag_id',access.tag!.id)
    const search=url.searchParams.get('q')?.trim().slice(0,100)
    if(search)query=query.ilike('name',`%${search.replace(/[%_\\]/g,'')}%`)
    const kind=url.searchParams.get('kind');if(kind)query=query.eq('kind',kind.slice(0,160))
    const offset=Math.min(10000,Math.max(0,Number(url.searchParams.get('offset'))||0));query=query.range(offset,offset+99)
    const{data,error}=await query;documentDbError(error);return toolsJson((data||[]).map(summary))
  }
  if(parts[0]!=='admin')throw new ToolsError(404,'Halaman tidak ditemukan.')
  const context=await getToolsContext(request,{templateAdmin:true})
  if(parts[1]==='tags'){
    const id=parts[2]
    if(method==='GET'){const{data,error}=await supabaseAdmin.from('documents_access_tags').select(`${TAG_COLUMNS},pin_hash`).order('name').limit(500);documentDbError(error);return toolsJson((data||[]).map(safeTag))}
    if(method==='POST'||method==='PATCH'){
      const raw=await readJson(request,4096)
      const body=parse(method==='POST'?tagSchema:tagSchema.partial(),raw)
      if(method==='POST'&&!body.pin)throw new ToolsError(400,'Tetapkan PIN untuk kelompok dokumen ini.')
      if(method==='PATCH'&&(!id||!body.revision))throw new ToolsError(400,'Versi data tag diperlukan.')
      let hash:string|null=null,digest:string|null=null
      if(body.pin){let normalized;try{normalized=normalizePin(body.pin)}catch{throw new ToolsError(400,'PIN harus berisi 5–12 digit angka.')};digest=pinDigest(normalized,documentSecret('DOCUMENTS_PIN_LOOKUP_SECRET'));hash=await hashPin(normalized)}
      const{pin:ignoredPin,revision,revoke,...data}=body;void ignoredPin
      const{data:result,error}=await supabaseAdmin.rpc('documents_save_tag',{p_actor:context.userId,p_id:id||null,p_revision:revision||null,p_data:data,p_hash:hash,p_digest:digest,p_revoke:revoke||false});documentDbError(error);return toolsJson(result,method==='POST'?201:200)
    }
    if(method==='DELETE'&&id){const revision=Number(url.searchParams.get('revision'));if(!Number.isSafeInteger(revision)||revision<1)throw new ToolsError(400,'Versi tag diperlukan.');const{error}=await supabaseAdmin.rpc('documents_archive_tag',{p_actor:context.userId,p_id:id,p_revision:revision});documentDbError(error);return toolsJson({success:true})}
  }
  if(parts[1]==='inspect'&&method==='POST'){const upload=await readTemplateUpload(request,context.userId);return toolsJson(inspectDocx(upload.buffer))}
  if(parts[1]==='templates'){
    const id=parts[2],action=parts[3]
    if(method==='GET'){
      if(id){const template=await adminTemplate(id);const{data,error}=await supabaseAdmin.from('documents_template_versions').select('id,template_id,fields,file_name,status,created_at').eq('template_id',id).order('created_at',{ascending:false}).limit(100);documentDbError(error);return toolsJson({...summary(template),versions:data||[]})}
      const{data,error}=await supabaseAdmin.from('documents_templates').select(TEMPLATE_COLUMNS).order('updated_at',{ascending:false}).limit(500);documentDbError(error);return toolsJson((data||[]).map(summary))
    }
    if(method==='POST'&&(!id||action==='versions')){
      const limit=await sharedRateLimit(`documents:upload:${context.userId}`,10,60);if(!limit.allowed)throw new ToolsError(429,'Terlalu banyak unggahan. Tunggu sebentar.')
      const upload=await readTemplateUpload(request,context.userId)
      const meta=id?{}:parse(metadataSchema,upload.metadata)
      if(id)await adminTemplate(id)
      const revision=id?Number(upload.metadata.revision):null
      if(id&&(!Number.isSafeInteger(revision)||Number(revision)<1))throw new ToolsError(400,'Versi template diperlukan.')
      await storeTemplateUpload(upload)
      const{data,error}=await supabaseAdmin.rpc('documents_save_template',{p_actor:context.userId,p_id:id||null,p_revision:revision,p_data:meta,p_version:upload.version});documentDbError(error);return toolsJson(summary(data),201)
    }
    if(!id)throw new ToolsError(404,'Template tidak ditemukan.')
    if(method==='PATCH'||method==='DELETE'){
      const raw=method==='DELETE'?{revision:Number(url.searchParams.get('revision')),status:'deleted'}:await readJson(request)
      const body=parse(metadataSchema.omit({code:true}).partial().extend({revision:z.number().int().positive(),status:z.enum(['draft','published','inactive','deleted']).optional()}),raw)
      const{revision,...data}=body
      const{data:result,error}=await supabaseAdmin.rpc('documents_save_template',{p_actor:context.userId,p_id:id,p_revision:revision,p_data:data,p_version:null});documentDbError(error);return toolsJson(summary(result))
    }
    if(method==='POST'&&action==='publish'){
      const body=parse(z.object({revision:z.number().int().positive(),version_id:z.string().uuid(),reviewed:z.literal(true)}),await readJson(request))
      const{data,error}=await supabaseAdmin.rpc('documents_publish_template',{p_actor:context.userId,p_template:id,p_version:body.version_id,p_revision:body.revision,p_reviewed:body.reviewed});documentDbError(error);return toolsJson(summary(data))
    }
    if(method==='POST'&&action==='test'){
      const template=await adminTemplate(id),raw=await readJson(request)
      const body=parse(documentPayload.extend({version_id:z.string().uuid()}),{...raw,code:template.code})
      const{data:version,error}=await supabaseAdmin.from('documents_template_versions').select('*').eq('template_id',id).eq('id',body.version_id).maybeSingle();documentDbError(error)
      if(!version)throw new ToolsError(404,'Versi tidak ditemukan.')
      await documentRenderLimit(context.userId)
      let result;try{result=renderDocument(await readDocumentFile(version as DocumentVersion),validateTemplateFields(version.fields),body)}catch(error){if(error instanceof ToolsError)throw error;throw new ToolsError(400,error instanceof Error?error.message:'Isian uji tidak valid.')}
      const{error:validationError}=await supabaseAdmin.rpc('documents_validate_version',{p_actor:context.userId,p_template:id,p_version:version.id});documentDbError(validationError);return docxResponse(result.buffer,`uji-${template.code}.docx`,result.warnings)
    }
  }
  throw new ToolsError(404,'Tindakan tidak ditemukan.')
}
