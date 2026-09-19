import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

const accountSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['cash', 'bank', 'ewallet', 'emergency_fund', 'investment', 'debt', 'receivable']),
  initial_balance: z.number().finite().default(0),
})

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response

  const planId = await getOwnedPlanId(auth.identity.id)
  const ownedQuery = planId
    ? supabaseAdmin.from('fintrack_accounts').select('*').eq('plan_id', planId).eq('archived', false).order('sort_order').order('created_at')
    : Promise.resolve({ data: [], error: null })
  const sharedQuery = supabaseAdmin
    .from('fintrack_account_collaborators')
    .select('role, can_manage, fintrack_accounts!inner(*)')
    .eq('user_id', auth.identity.id)
    .is('revoked_at', null)

  const [owned, shared] = await Promise.all([ownedQuery, sharedQuery])
  if (owned.error || shared.error) {
    return NextResponse.json({ error: 'Gagal mengambil daftar dompet' }, { status: 500 })
  }

  const ownAccounts = (owned.data || []).map((account) => ({ ...account, access_role: 'owner', can_manage: true }))
  const sharedAccounts = (shared.data || []).map((row) => ({
    ...(row.fintrack_accounts as unknown as Record<string, unknown>),
    access_role: row.role,
    can_manage: row.can_manage,
  }))
  return NextResponse.json({ data: [...ownAccounts, ...sharedAccounts], personal_plan_id: planId || null })
}

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = accountSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const planId = await getOwnedPlanId(auth.identity.id)
  if (!planId) return NextResponse.json({ error: 'Rencana pribadi belum tersedia' }, { status: 409 })
  const classification = parsed.data.kind === 'debt' ? 'liability' : 'asset'
  const { data: lastAccount } = await supabaseAdmin.from('fintrack_accounts').select('sort_order').eq('plan_id', planId).eq('archived', false).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await supabaseAdmin.from('fintrack_accounts').insert({
    plan_id: planId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    classification,
    initial_balance: parsed.data.initial_balance,
    current_balance: parsed.data.initial_balance,
    include_in_net_worth: true,
    sort_order: Number(lastAccount?.sort_order ?? -1) + 1,
    created_by: auth.identity.id,
  }).select().single()

  if (error) return NextResponse.json({ error: 'Gagal membuat dompet' }, { status: 500 })
  return NextResponse.json({ data: { ...data, access_role: 'owner', can_manage: true } }, { status: 201 })
}
