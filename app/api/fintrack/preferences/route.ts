import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'

const schema = z.object({ month_cutoff_day: z.number().int().min(1).max(28) })

export async function PATCH(request: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Tanggal cutoff harus antara 1–28' }, { status: 400 })
  const { error } = await supabaseAdmin.from('fintrack_users').update({ month_cutoff_day: parsed.data.month_cutoff_day, updated_at: new Date().toISOString() }).eq('id', auth.identity.id)
  if (error) return NextResponse.json({ error: 'Tanggal cutoff gagal disimpan' }, { status: 500 })
  return NextResponse.json({ data: parsed.data })
}
