import { getToolsContext, toolsJson, toolsRoute } from '@/lib/tools/server'
export const dynamic = 'force-dynamic'
export function GET(request: Request) { return toolsRoute(request, async () => toolsJson(await getToolsContext(request))) }
