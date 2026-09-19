import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createPinSession } from '@/lib/fintrackSession'
import { bootstrapFintrackUser } from '@/lib/fintrackUser'

const schema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  email: z.email('Email tidak valid').transform((value) => value.trim().toLowerCase()),
  pin: z.string().regex(/^\d{6}$/, 'PIN harus tepat 6 digit angka'),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  if (!process.env.FINTRACK_SESSION_SECRET || process.env.FINTRACK_SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: 'Konfigurasi sesi PIN belum lengkap.' }, { status: 503 })
  }

  const { data: existing } = await supabaseAdmin.from('fintrack_users').select('id').ilike('email', parsed.data.email).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Email sudah terdaftar. Silakan masuk.' }, { status: 409 })

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: parsed.data.email,
    password: randomBytes(36).toString('base64url'),
    email_confirm: true,
    user_metadata: { full_name: parsed.data.name, fintrack_manual: true },
  })
  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes('already')
    return NextResponse.json({ error: duplicate ? 'Email sudah terdaftar. Silakan masuk.' : 'Akun tidak dapat dibuat.' }, { status: duplicate ? 409 : 500 })
  }

  try {
    await bootstrapFintrackUser(created.user.id, parsed.data.email, parsed.data.name)
    const pinHash = await bcrypt.hash(parsed.data.pin, 10)
    const { error: profileError } = await supabaseAdmin.from('fintrack_users').update({ pin_hash: pinHash, pin_version: 1, updated_at: new Date().toISOString() }).eq('id', created.user.id)
    if (profileError) throw profileError
    await createPinSession(created.user.id, 1)
    return NextResponse.json({ user: { id: created.user.id, name: parsed.data.name, email: parsed.data.email } }, { status: 201 })
  } catch (error) {
    console.error(error)
    await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => undefined)
    return NextResponse.json({ error: 'Profil FinTrack tidak dapat disiapkan.' }, { status: 500 })
  }
}
