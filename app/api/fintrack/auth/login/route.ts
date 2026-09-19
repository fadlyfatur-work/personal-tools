import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createPinSession } from '@/lib/fintrackSession'
import { getSupabaseServer } from '@/lib/supabaseServer'

const schema = z.object({
  email: z.email('Email tidak valid').transform((value) => value.trim().toLowerCase()),
  pin: z.string().regex(/^\d{6}$/, 'PIN harus tepat 6 digit angka'),
})

const DUMMY_PIN_HASH = '$2b$10$rmyCchHo31teNRXeVwu1AebzZ/M6ELSLKgJxFYi8vN/9hh5yqUjSK'

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  if (!process.env.FINTRACK_SESSION_SECRET || process.env.FINTRACK_SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: 'Konfigurasi sesi PIN belum lengkap.' }, { status: 503 })
  }

  const { data: user } = await supabaseAdmin
    .from('fintrack_users')
    .select('id, email, name, pin_hash, pin_version, pin_locked_until')
    .eq('email', parsed.data.email)
    .maybeSingle()

  if (!user?.pin_hash) {
    await bcrypt.compare(parsed.data.pin, DUMMY_PIN_HASH)
    return NextResponse.json({ error: 'Email atau PIN tidak sesuai.' }, { status: 401 })
  }

  const lockedUntil = user.pin_locked_until ? new Date(user.pin_locked_until) : null
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Coba kembali beberapa menit lagi.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const valid = await bcrypt.compare(parsed.data.pin, user.pin_hash)
  if (!valid) {
    const { error: rateLimitError } = await supabaseAdmin.rpc('fintrack_record_pin_failure', { p_user_id: user.id })
    if (rateLimitError) {
      console.error(rateLimitError)
      return NextResponse.json({ error: 'Login PIN belum siap. Jalankan migration PIN terlebih dahulu.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Email atau PIN tidak sesuai.' }, { status: 401 })
  }

  await supabaseAdmin.from('fintrack_users').update({
    pin_failed_attempts: 0,
    pin_locked_until: null,
    pin_last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)

  try {
    const supabase = await getSupabaseServer()
    await supabase.auth.signOut()
    await createPinSession(user.id, Number(user.pin_version || 0))
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Konfigurasi sesi PIN belum lengkap.' }, { status: 500 })
  }

  return NextResponse.json({ user: { name: user.name, email: user.email } })
}
