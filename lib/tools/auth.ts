import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { TOOLS_AUTH_COOKIE } from './policy'

export async function getToolsAuth() {
  const jar = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Layanan akun belum dikonfigurasi.')
  return createServerClient(url, key, {
    cookieOptions: { name: TOOLS_AUTH_COOKIE, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) { for (const item of items) jar.set(item.name, item.value, item.options) },
    },
  })
}
