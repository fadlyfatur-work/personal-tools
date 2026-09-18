import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAccountAccess, requireFintrackIdentity } from '@/lib/fintrackUser'

const updateSchema = z.object({ name: z.string().trim().min(1).max(60) })

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const { id } = await params
  const access = await getAccountAccess(auth.identity.id, id)
  if (!access?.canManage) return NextResponse.json({ error: 'Tidak punya izin mengubah dompet' }, { status: 403 })
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('fintrack_accounts').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: 'Gagal mengubah dompet' }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const { id } = await params
  const access = await getAccountAccess(auth.identity.id, id)
  if (access?.role !== 'owner') return NextResponse.json({ error: 'Hanya owner yang dapat mengarsipkan dompet' }, { status: 403 })

  const { error } = await supabaseAdmin.from('fintrack_accounts').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Gagal mengarsipkan dompet' }, { status: 500 })
  return NextResponse.json({ success: true })
}
