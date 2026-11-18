import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {getToolsContext,toolsRoute,toolsJson,ToolsError,readToolsJson} from '@/lib/tools/server'
export const dynamic='force-dynamic'
export function GET(request:Request){return toolsRoute(request,async()=>toolsJson((await getToolsContext(request)).workspaces))}
export function POST(request:Request){return toolsRoute(request,async()=>{
  const ctx=await getToolsContext(request)
  const parsed=z.object({name:z.string().trim().min(1).max(100)}).safeParse(await readToolsJson(request))
  if(!parsed.success) throw new ToolsError(400,'Nama ruang kerja wajib diisi (maksimal 100 karakter).')
  const {data,error}=await supabaseAdmin.rpc('tools_create_workspace',{p_actor:ctx.userId,p_name:parsed.data.name})
  if(error) throw new ToolsError(503,'Ruang kerja belum dapat dibuat.')
  return toolsJson({id:data},201)
})}
