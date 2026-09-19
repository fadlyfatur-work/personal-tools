import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(['income', 'expense']).optional(),
  archived: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan')

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const planId = await getOwnedPlanId(auth.identity.id)
  if (!planId) return NextResponse.json({ error: 'Tidak punya izin mengubah kategori' }, { status: 403 })
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { id } = await params
  const { archived, ...values } = parsed.data
  const update = { ...values, ...(archived === undefined ? {} : { archived_at: archived ? new Date().toISOString() : null }), updated_at: new Date().toISOString() }
  const { data, error } = await supabaseAdmin.from('fintrack_categories').update(update).eq('id', id).eq('plan_id', planId).select().maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Kategori gagal diperbarui' }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const planId = await getOwnedPlanId(auth.identity.id)
  if (!planId) return NextResponse.json({ error: 'Tidak punya izin mengarsipkan kategori' }, { status: 403 })
  const { id } = await params
  const { data, error } = await supabaseAdmin.from('fintrack_categories').update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('plan_id', planId).select().maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Kategori gagal diarsipkan' }, { status: 400 })
  return NextResponse.json({ data })
}
