import {toolsRoute} from '@/lib/tools/server'
import {handleToolsUsers} from '@/lib/tools/users'
export const dynamic='force-dynamic'
const handle=(request:Request)=>toolsRoute(request,()=>handleToolsUsers(request))
export const GET=handle
export const POST=handle
export const PATCH=handle
