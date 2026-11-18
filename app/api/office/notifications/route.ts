import { toolsJson, toolsRoute } from '@/lib/tools/server'
import { officeRead, officeWrite, parseId } from '@/lib/office/server'
export const dynamic = 'force-dynamic'
export function GET(request: Request) { return toolsRoute(request, async () => toolsJson(await officeRead(request, 'notifications'))) }
export function PATCH(request: Request) { return toolsRoute(request, async () => toolsJson(await officeWrite(request, 'notifications', parseId(new URL(request.url).searchParams.get('id') ?? '')))) }
