import { getToolsAuth } from './auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { canWriteWorkspace, isSameOriginMutation } from './policy'
import type { ToolsContext, ToolsWorkspace } from './types'

export class ToolsError extends Error {
  constructor(public status: number, message: string, public code = 'REQUEST_FAILED', public retryAfter?: number) { super(message) }
}
export function toolsJson(data: unknown, status = 200) {
  return Response.json({ data }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}
export async function readToolsJson(request:Request,maxBytes=16384){
  if(Number(request.headers.get('content-length')||0)>maxBytes)throw new ToolsError(413,'Isian terlalu besar.')
  const reader=request.body?.getReader();if(!reader)throw new ToolsError(400,'Isian tidak tersedia.')
  const chunks:Uint8Array[]=[];let size=0
  try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>maxBytes){await reader.cancel();throw new ToolsError(413,'Isian terlalu besar.')}chunks.push(chunk.value)}}finally{reader.releaseLock()}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new ToolsError(400,'Isian tidak valid.')}
}
export async function toolsRoute(request: Request, action: () => Promise<Response>) {
  try {
    if (!isSameOriginMutation(request)) throw new ToolsError(403, 'Permintaan harus berasal dari aplikasi ini.', 'ORIGIN_INVALID')
    const result = await action()
    result.headers.set('Cache-Control', 'private, no-store')
    return result
  } catch (error) {
    if (!(error instanceof ToolsError)) console.error('[tools]', error instanceof Error ? error.message : 'Unknown failure')
    const status=error instanceof ToolsError?error.status:503
    return Response.json({ error: error instanceof ToolsError ? error.message : 'Layanan belum dapat memproses permintaan. Coba kembali.', code: error instanceof ToolsError ? error.code : 'SERVICE_UNAVAILABLE', request_id: crypto.randomUUID() }, { status, headers: { 'Cache-Control': 'private, no-store',...(status===429?{'Retry-After':String(error instanceof ToolsError&&error.retryAfter||60)}:{}) } })
  }
}
export async function getToolsContext(request?: Request, options: { write?: boolean; templateAdmin?: boolean; suiteAdmin?: boolean } = {}): Promise<ToolsContext> {
  const auth = await getToolsAuth()
  const { data: { user }, error } = await auth.auth.getUser()
  if (error || !user?.email) throw new ToolsError(401, 'Silakan masuk untuk melanjutkan.', 'AUTH_REQUIRED')
  const { data, error: dbError } = await supabaseAdmin.rpc('tools_bootstrap', { p_actor: user.id, p_name: user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0] })
  if(dbError?.message?.includes('TOOLS_ACCOUNT_DISABLED')||data?.is_active===false)throw new ToolsError(403,'Akses akun ini dinonaktifkan. Hubungi admin.','ACCOUNT_DISABLED')
  if (dbError || !data) throw new ToolsError(503, 'Ruang kerja belum tersedia. Hubungi pengelola untuk memeriksa penyiapan aplikasi.', 'SETUP_REQUIRED')
  const workspaces = data.workspaces as ToolsWorkspace[]
  const wanted = request ? new URL(request.url).searchParams.get('workspace') || request.headers.get('x-tools-workspace') : null
  const workspace = wanted ? workspaces.find(item => item.id === wanted) : workspaces[0]
  if (!workspace) throw new ToolsError(403, 'Anda tidak mempunyai akses ke ruang kerja ini.', 'WORKSPACE_DENIED')
  if (options.write && !canWriteWorkspace(workspace.role)) throw new ToolsError(403, 'Peran Anda hanya dapat membaca ruang kerja ini.', 'WRITE_DENIED')
  if (options.templateAdmin && !data.is_template_admin) throw new ToolsError(403, 'Akun ini tidak memiliki akses admin template.', 'ADMIN_REQUIRED')
  if (options.suiteAdmin && !data.is_suite_admin) throw new ToolsError(403,'Hanya admin aplikasi yang dapat mengelola pengguna.','SUITE_ADMIN_REQUIRED')
  return { userId: user.id, email: user.email, name: data.name, workspaceId: workspace.id, role: workspace.role, isTemplateAdmin: data.is_template_admin === true, isSuiteAdmin:data.is_suite_admin===true, workspaces }
}
