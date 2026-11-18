import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ToolsError } from './server'

export async function sharedRateLimit(key: string, limit: number, seconds: number) {
  const {data,error}=await supabaseAdmin.rpc('tools_take_rate_limit',{p_key:createHash('sha256').update(key).digest('hex'),p_limit:limit,p_seconds:seconds})
  if(error||!data) throw new ToolsError(503,'Belum dapat memeriksa batas percobaan. Coba lagi nanti.','LIMIT_UNAVAILABLE')
  return data as {allowed:boolean;retry_after:number}
}
export function trustedSource(request:Request) {
  return process.env.VERCEL==='1' ? (request.headers.get('x-vercel-forwarded-for')||'unknown').split(',')[0].trim() : 'direct'
}
