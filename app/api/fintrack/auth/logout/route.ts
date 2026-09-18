import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function POST() {
  const supabase = await getSupabaseServer()
  await supabase.auth.signOut()
  return NextResponse.json({ success: true })
}
