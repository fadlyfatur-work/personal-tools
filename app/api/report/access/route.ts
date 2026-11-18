import {toolsRoute} from '@/lib/tools/server'
import {getAccess,updateAccess} from '@/lib/report/server'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export function GET(request:Request){return toolsRoute(request,()=>getAccess(request))}
export function PUT(request:Request){return toolsRoute(request,()=>updateAccess(request))}
