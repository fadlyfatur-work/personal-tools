import { createHash,randomBytes } from 'node:crypto'
import {z} from 'zod'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {getToolsContext,toolsRoute,toolsJson,ToolsError,readToolsJson} from '@/lib/tools/server'
import {canManageWorkspace} from '@/lib/tools/policy'
export const dynamic='force-dynamic'
type Params={params:Promise<{id:string}>}
async function manager(request:Request,context:Params){
  const{id}=await context.params
  const url=new URL(request.url);url.searchParams.set('workspace',id)
  const forwarded=new Request(url,{headers:new Headers(request.headers)})
  forwarded.headers.set('x-tools-workspace',id)
  const ctx=await getToolsContext(forwarded)
  if(!canManageWorkspace(ctx.role))throw new ToolsError(403,'Hanya pengelola ruang kerja yang dapat mengatur anggota.')
  return ctx
}
export function GET(request:Request,context:Params){return toolsRoute(request,async()=>{
  const ctx=await manager(request,context)
  const{data:members,error}=await supabaseAdmin.from('tools_workspace_members').select('user_id,role').eq('workspace_id',ctx.workspaceId)
  if(error)throw new ToolsError(503,'Anggota belum dapat dimuat.')
  const ids=(members||[]).map(row=>row.user_id)
  const{data:profiles}=await supabaseAdmin.from('tools_profiles').select('user_id,name,email').in('user_id',ids)
  const{data:invites}=await supabaseAdmin.from('tools_workspace_invites').select('id,email,role,expires_at,accepted_at,revoked_at').eq('workspace_id',ctx.workspaceId).order('created_at',{ascending:false}).limit(100)
  return toolsJson({members:(members||[]).map(row=>({...row,...profiles?.find(person=>person.user_id===row.user_id)})),invites:invites||[]})
})}
export function POST(request:Request,context:Params){return toolsRoute(request,async()=>{
  const ctx=await manager(request,context)
  const body=z.object({email:z.string().trim().email().max(254),role:z.enum(['admin','member','viewer']).default('member')}).safeParse(await readToolsJson(request))
  if(!body.success)throw new ToolsError(400,'Email atau peran undangan tidak valid.')
  if(ctx.role!=='owner'&&body.data.role==='admin')throw new ToolsError(403,'Hanya pemilik yang dapat mengundang admin.')
  const token=randomBytes(32).toString('base64url')
  const{error}=await supabaseAdmin.from('tools_workspace_invites').insert({workspace_id:ctx.workspaceId,email:body.data.email.toLowerCase(),role:body.data.role,invited_by:ctx.userId,token_hash:createHash('sha256').update(token).digest('hex'),expires_at:new Date(Date.now()+7*86400000).toISOString()})
  if(error)throw new ToolsError(503,'Undangan belum dapat dibuat.')
  return toolsJson({url:`${new URL(request.url).origin}/tools/invitation?token=${token}`},201)
})}
export function PATCH(request:Request,context:Params){return toolsRoute(request,async()=>{
  const ctx=await manager(request,context)
  const parsed=z.object({user_id:z.string().uuid(),role:z.enum(['owner','admin','member','viewer']),remove:z.boolean().default(false)}).safeParse(await readToolsJson(request))
  if(!parsed.success)throw new ToolsError(400,'Anggota atau peran tidak valid.')
  const{error}=await supabaseAdmin.rpc('tools_manage_member',{p_actor:ctx.userId,p_workspace:ctx.workspaceId,p_user:parsed.data.user_id,p_role:parsed.data.role,p_remove:parsed.data.remove})
  if(error)throw new ToolsError(409,'Perubahan anggota tidak diizinkan. Pemilik harus dipindahkan sebelum dikeluarkan.')
  return toolsJson({success:true})
})}
