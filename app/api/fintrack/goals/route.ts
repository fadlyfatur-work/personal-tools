import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

export const dynamic = 'force-dynamic'
const goalSchema = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().trim().min(1).max(16).default('🎯'),
  kind: z.enum(['purchase', 'investment']).default('purchase'),
  target_amount: z.number().finite().positive().max(999999999999),
  target_date: z.iso.date().nullable().default(null),
})

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const planId = await getOwnedPlanId(auth.identity.id)
  if (!planId) return NextResponse.json({ data: [] })
  const { data: goals, error } = await supabaseAdmin.from('fintrack_goal_totals').select('*').eq('plan_id', planId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Goals belum dapat dimuat. Pastikan migrasi Goals sudah diterapkan.' }, { status: 503 })
  const ids = (goals || []).map(goal => goal.id)
  const items = ids.length ? await supabaseAdmin.from('fintrack_goal_item_totals').select('*').in('goal_id', ids).order('created_at') : { data: [], error: null }
  if (items.error) return NextResponse.json({ error: 'Rincian tujuan gagal dimuat' }, { status: 500 })
  return NextResponse.json({ data: (goals || []).map(goal => ({ ...goal, status: goal.account_archived ? 'archived' : goal.status, items: (items.data || []).filter(item => item.goal_id === goal.id) })) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = goalSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Isi nama dan target dana yang valid.' }, { status: 400 })
  const goal = parsed.data
  const { data, error } = await supabaseAdmin.rpc('fintrack_create_goal', { p_actor_id: auth.identity.id, p_name: goal.name, p_emoji: goal.emoji, p_kind: goal.kind, p_target_amount: goal.target_amount, p_target_date: goal.target_date })
  if (error) return NextResponse.json({ error: 'Tujuan gagal dibuat. Pastikan migrasi Goals sudah diterapkan.' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
