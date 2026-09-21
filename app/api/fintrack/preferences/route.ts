import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'

const schema = z.object({
  month_cutoff_day: z.number().int().min(1).max(28).optional(),
  sort_accounts_by_balance: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan')

export async function PATCH(request: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Pengaturan tidak valid' }, { status: 400 })
  const { error } = await supabaseAdmin.from('fintrack_users').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', auth.identity.id)
  if (error) return NextResponse.json({ error: 'Pengaturan gagal disimpan' }, { status: 500 })
  return NextResponse.json({ data: parsed.data })
}
