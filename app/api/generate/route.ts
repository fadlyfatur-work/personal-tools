import{toolsRoute,ToolsError}from '@/lib/tools/server'
import{getAuthorizedTemplate,readDocumentFile,readJson,documentRenderLimit}from '@/lib/documents/server'
import{documentPayload,renderDocument,docxResponse}from '@/lib/documents/render'
import{validateTemplateFields}from '@/lib/documents/policy'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=60
export function POST(request:Request){return toolsRoute(request,async()=>{
  const parsed=documentPayload.safeParse(await readJson(request))
  if(!parsed.success)throw new ToolsError(400,'Data surat tidak valid.')
  const input=parsed.data
  const{access,template,version}=await getAuthorizedTemplate(request,input.code)
  if(input.version_id!==version.id)throw new ToolsError(409,'Template sudah diperbarui. Muat versi terbaru sebelum mengunduh.','TEMPLATE_UPDATED')
  await documentRenderLimit(access.admin?access.userId!:access.grant!.id,access.tag?.id)
  let result
  try{result=renderDocument(await readDocumentFile(version),validateTemplateFields(version.fields),input)}catch(error){if(error instanceof ToolsError)throw error;throw new ToolsError(400,error instanceof Error?error.message:'Isian surat belum sesuai.')}
  const activity=input.single.kegiatan_perjadin||input.single.nama_acara
  const number=input.single.nomor_spt||input.single.nomor_surat
  const stamp=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()).replaceAll('/','')
  return docxResponse(result.buffer,`${stamp}_${typeof activity==='string'&&activity?activity:template.name}_${typeof number==='string'&&number?number:'tanpa-nomor'}.docx`,result.warnings)
})}
