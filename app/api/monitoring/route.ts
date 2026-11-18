import { toolsRoute } from '@/lib/tools/server'
import { monitoringRead, monitoringWrite } from '@/lib/operations/api'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export function GET(request: Request) { return toolsRoute(request, () => monitoringRead(request)) }
export function POST(request: Request) { return toolsRoute(request, () => monitoringWrite(request)) }
