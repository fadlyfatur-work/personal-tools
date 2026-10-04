import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { getOwnedGoal } from '@/lib/fintrackGoalServer'

export const dynamic = 'force-dynamic'
const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().trim().min(1).max(16).optional(),
  target_amount: z.number().finite().positive().max(999999999999).optional(),
  target_date: z.iso.date().nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
}).refine(value => Object.keys(value).length > 0)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Tujuan tidak valid' }, { status: 400 })
  const goal = await getOwnedGoal(auth.identity.id, id)
  if (!goal) return NextResponse.json({ error: 'Tujuan tidak ditemukan' }, { status: 404 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Perubahan tujuan tidak valid' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('fintrack_goals').update(parsed.data).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: 'Tujuan gagal diperbarui' }, { status: 500 })
  return NextResponse.json({ data })
}
