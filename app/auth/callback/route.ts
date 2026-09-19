import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { bootstrapFintrackUser } from '@/lib/fintrackUser'
import { clearPinSession } from '@/lib/fintrackSession'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const requestedNext = req.nextUrl.searchParams.get('next') || '/fintrack'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/fintrack'

  if (!code) {
    return NextResponse.redirect(new URL('/fintrack/login?error=oauth', req.url))
  }

  const supabase = await getSupabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/fintrack/login?error=oauth', req.url))
  }

  await clearPinSession()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.redirect(new URL('/fintrack/login?error=identity', req.url))
  }

  try {
    const displayName = typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : user.email.split('@')[0]
    await bootstrapFintrackUser(user.id, user.email, displayName)
  } catch (bootstrapError) {
    console.error(bootstrapError)
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/fintrack/login?error=bootstrap', req.url))
  }

  return NextResponse.redirect(new URL(next, req.url))
}
