import {toolsJson,toolsRoute} from '@/lib/tools/server'
import {getReportIdentity,loginReport,logoutReport} from '@/lib/report/server'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export function GET(request:Request){return toolsRoute(request,async()=>toolsJson(await getReportIdentity()))}
export function POST(request:Request){return toolsRoute(request,()=>loginReport(request))}
export function DELETE(request:Request){return toolsRoute(request,logoutReport)}
