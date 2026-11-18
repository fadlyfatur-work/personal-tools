import {toolsRoute} from '@/lib/tools/server'
import {readReport,saveReport} from '@/lib/report/server'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export function GET(request:Request){return toolsRoute(request,()=>readReport(request))}
export function POST(request:Request){return toolsRoute(request,()=>saveReport(request))}
