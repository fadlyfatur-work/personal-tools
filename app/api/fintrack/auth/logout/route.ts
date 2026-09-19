import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { clearPinSession } from '@/lib/fintrackSession'

export async function POST() {
  const supabase = await getSupabaseServer()
  await supabase.auth.signOut()
  await clearPinSession()
  return NextResponse.json({ success: true })
}
