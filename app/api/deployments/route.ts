import { toolsRoute } from '@/lib/tools/server'
import { deploymentRead, deploymentWrite } from '@/lib/operations/api'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export function GET(request: Request) { return toolsRoute(request, () => deploymentRead(request)) }
export function POST(request: Request) { return toolsRoute(request, () => deploymentWrite(request)) }
