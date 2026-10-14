import { validProvider, walletProviders } from '@/lib/fintrackProviders'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAccountAccess, requireFintrackIdentity } from '@/lib/fintrackUser'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  provider_code: z.string().refine(value => walletProviders.some(item => item.code === value), 'Penyedia tidak valid').nullable().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  include_in_net_worth: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan')

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const { id } = await params
  const access = await getAccountAccess(auth.identity.id, id)
  if (!access?.canManage) return NextResponse.json({ error: 'Tidak punya izin mengubah dompet' }, { status: 403 })
  const parsed = updateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  if (parsed.data.include_in_net_worth !== undefined && access.role !== 'owner') {
    return NextResponse.json({ error: 'Hanya owner yang dapat mengubah perhitungan kekayaan' }, { status: 403 })
  }
  if (parsed.data.provider_code !== undefined) {
    const { data: account } = await supabaseAdmin.from('fintrack_accounts').select('kind').eq('id', id).single()
    if (!account || !validProvider(parsed.data.provider_code, account.kind)) return NextResponse.json({ error: 'Penyedia tidak sesuai jenis dompet' }, { status: 400 })
  }
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
