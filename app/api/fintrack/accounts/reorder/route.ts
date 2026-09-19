import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import type { Account } from '@/types/fintrack'

const schema = z.object({ ordered_ids: z.array(z.string().uuid()).min(1) })

export async function POST(request: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Urutan dompet tidak valid' }, { status: 400 })

  const { data, error } = await supabaseAdmin.rpc('fintrack_reorder_accounts', {
    p_actor_id: auth.identity.id,
    p_account_ids: parsed.data.ordered_ids,
  })
  if (error) return NextResponse.json({ error: error.message || 'Urutan dompet gagal disimpan' }, { status: 400 })
  return NextResponse.json({ data: (data || []).map((account: Account) => ({ ...account, access_role: 'owner', can_manage: true })) })
}
