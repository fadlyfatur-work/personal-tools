import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const databaseCheck = supabaseAdmin.from('fintrack_users').select('id').limit(1)
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 8000))
    const result = await Promise.race([databaseCheck, timeout])
    if (result.error) throw result.error
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store, max-age=0' } })
  }
}
