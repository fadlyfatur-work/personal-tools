import { toolsJson, toolsRoute } from '@/lib/tools/server'
import { officeRead, officeWrite, parseId, parseKind } from '@/lib/office/server'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ kind: string; id: string }> }
export function GET(request: Request, context: Context) { return toolsRoute(request, async () => { const { kind, id } = await context.params; return toolsJson(await officeRead(request, parseKind(kind), parseId(id))) }) }
export function PATCH(request: Request, context: Context) { return toolsRoute(request, async () => { const { kind, id } = await context.params; return toolsJson(await officeWrite(request, parseKind(kind), parseId(id))) }) }
