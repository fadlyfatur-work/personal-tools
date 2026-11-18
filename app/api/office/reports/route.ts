import { toolsJson, toolsRoute } from '@/lib/tools/server'
import { officeReport } from '@/lib/office/server'
export const dynamic='force-dynamic'
export function GET(request:Request){return toolsRoute(request,async()=>toolsJson(await officeReport(request)))}
