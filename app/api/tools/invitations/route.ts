import {createHash} from 'node:crypto'
import {z} from 'zod'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {getToolsContext,toolsRoute,toolsJson,ToolsError,readToolsJson} from '@/lib/tools/server'
export const dynamic='force-dynamic'
export function POST(request:Request){return toolsRoute(request,async()=>{
  const ctx=await getToolsContext(request)
  const body=z.object({token:z.string().min(40).max(100)}).safeParse(await readToolsJson(request))
  if(!body.success)throw new ToolsError(400,'Undangan tidak valid.')
  const{data,error}=await supabaseAdmin.rpc('tools_accept_invite',{p_actor:ctx.userId,p_hash:createHash('sha256').update(body.data.token).digest('hex')})
  if(error)throw new ToolsError(409,'Undangan tidak berlaku, sudah dicabut, atau ditujukan ke email lain.')
  return toolsJson({workspaceId:data})
})}
