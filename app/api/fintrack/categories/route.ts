import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const planId = await getOwnedPlanId(auth.identity.id)
  const { data: shared } = await supabaseAdmin
    .from('fintrack_account_collaborators')
    .select('fintrack_accounts!inner(plan_id)')
    .eq('user_id', auth.identity.id)
    .is('revoked_at', null)
  const planIds = [...new Set([
    ...(planId ? [planId] : []),
    ...(shared || []).map((row) => (row.fintrack_accounts as unknown as { plan_id: string }).plan_id),
  ])]
  if (!planIds.length) return NextResponse.json({ data: [] })
  const { data, error } = await supabaseAdmin.from('fintrack_categories').select('*').in('plan_id', planIds).is('archived_at', null).order('name')
  if (error) return NextResponse.json({ error: 'Gagal mengambil kategori' }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['income', 'expense']),
})

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = categorySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const planId = await getOwnedPlanId(auth.identity.id)
  if (!planId) return NextResponse.json({ error: 'Rencana pribadi belum tersedia' }, { status: 409 })
  const { data, error } = await supabaseAdmin.from('fintrack_categories').insert({ plan_id: planId, ...parsed.data }).select().single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'Kategori sudah tersedia' : 'Kategori gagal dibuat' }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
