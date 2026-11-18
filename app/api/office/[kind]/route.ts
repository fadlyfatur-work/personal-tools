import { toolsJson, toolsRoute } from '@/lib/tools/server'
import { officeRead, officeWrite, parseKind } from '@/lib/office/server'
export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ kind: string }> }
export function GET(request: Request, context: Context) { return toolsRoute(request, async () => toolsJson(await officeRead(request, parseKind((await context.params).kind)))) }
export function POST(request: Request, context: Context) { return toolsRoute(request, async () => toolsJson(await officeWrite(request, parseKind((await context.params).kind)), 201)) }
