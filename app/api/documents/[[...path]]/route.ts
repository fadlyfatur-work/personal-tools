import{toolsRoute}from '@/lib/tools/server'
import{handleDocumentsRequest}from '@/lib/documents/api'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=60
export const GET=(request:Request)=>toolsRoute(request,()=>handleDocumentsRequest(request))
export const POST=(request:Request)=>toolsRoute(request,()=>handleDocumentsRequest(request))
export const PATCH=(request:Request)=>toolsRoute(request,()=>handleDocumentsRequest(request))
export const DELETE=(request:Request)=>toolsRoute(request,()=>handleDocumentsRequest(request))
