import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { createPinSession } from '@/lib/fintrackSession'

const schema = z.object({ pin: z.string().regex(/^\d{6}$/, 'PIN harus tepat 6 digit angka') })

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  if (!process.env.FINTRACK_SESSION_SECRET || process.env.FINTRACK_SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: 'Konfigurasi sesi PIN belum lengkap' }, { status: 500 })
  }
  const pinHash = await bcrypt.hash(parsed.data.pin, 10)
  const { data: current } = await supabaseAdmin
    .from('fintrack_users')
    .select('pin_version')
    .eq('id', auth.identity.id)
    .maybeSingle()
  const nextPinVersion = Number(current?.pin_version || 0) + 1
  const { error } = await supabaseAdmin.from('fintrack_users').update({
    pin_hash: pinHash,
    pin_version: nextPinVersion,
    pin_failed_attempts: 0,
    pin_locked_until: null,
    updated_at: new Date().toISOString(),
  }).eq('id', auth.identity.id)
  if (error) return NextResponse.json({ error: 'PIN tidak dapat disimpan' }, { status: 500 })
  await createPinSession(auth.identity.id, nextPinVersion)
  return NextResponse.json({ success: true })
}
