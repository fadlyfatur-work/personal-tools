import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

export async function requireSensitivePin(req: NextRequest, userId: string) {
  const { data: user } = await supabaseAdmin.from('fintrack_users').select('pin_hash').eq('id', userId).maybeSingle()
  if (!user?.pin_hash) return null
  const pin = req.headers.get('x-fintrack-pin') || ''
  if (!/^\d{6}$/.test(pin) || !(await bcrypt.compare(pin, user.pin_hash))) {
    return NextResponse.json({ error: 'PIN konfirmasi salah atau belum diisi', pin_required: true }, { status: 403 })
  }
  return null
}
