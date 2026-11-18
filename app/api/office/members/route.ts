import { getToolsContext, toolsJson, toolsRoute } from '@/lib/tools/server'
import { officeMembers } from '@/lib/office/server'
export const dynamic = 'force-dynamic'
export function GET(request: Request) { return toolsRoute(request, async () => {
 const c = await getToolsContext(request)
 return toolsJson(await officeMembers(c))
}) }
