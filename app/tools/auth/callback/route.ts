import { NextResponse } from 'next/server'
import { getToolsAuth } from '@/lib/tools/auth'
import { safeToolsReturn } from '@/lib/tools/policy'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const url = new URL(request.url)
  const auth = await getToolsAuth()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const result = code ? await auth.auth.exchangeCodeForSession(code) : tokenHash && ['signup','recovery','email'].includes(type || '') ? await auth.auth.verifyOtp({token_hash:tokenHash,type:type as 'signup'|'recovery'|'email'}) : null
  const next = url.searchParams.get('next') === '/tools/reset-password' ? `/tools/reset-password?next=${encodeURIComponent(safeToolsReturn(url.searchParams.get('return_to')))}` : safeToolsReturn(url.searchParams.get('next'))
  return NextResponse.redirect(new URL(result && !result.error ? next : '/tools/login?error=callback',url.origin))
}
