import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'

const schema = z.object({ pin: z.string().regex(/^\d{6}$/, 'PIN harus tepat 6 digit angka') })

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const pinHash = await bcrypt.hash(parsed.data.pin, 10)
  const { error } = await supabaseAdmin.from('fintrack_users').update({ pin_hash: pinHash, updated_at: new Date().toISOString() }).eq('id', auth.identity.id)
  if (error) return NextResponse.json({ error: 'PIN tidak dapat disimpan' }, { status: 500 })
  return NextResponse.json({ success: true })
}
