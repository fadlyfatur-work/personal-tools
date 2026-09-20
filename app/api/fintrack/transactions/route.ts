import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAccountAccess, getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().positive().finite(),
  from_account_id: z.string().uuid().nullable().optional(),
  to_account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(240).nullable().optional(),
  transaction_date: z.iso.date(),
  allow_negative: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const accountId = req.nextUrl.searchParams.get('account_id')
  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') || 60)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 60

  if (accountId) {
    const access = await getAccountAccess(auth.identity.id, accountId)
    if (!access) return NextResponse.json({ error: 'Tidak punya akses ke dompet' }, { status: 403 })
    const { data: entries } = await supabaseAdmin.from('fintrack_transaction_entries').select('transaction_id').eq('account_id', accountId).order('created_at', { ascending: false }).limit(limit)
    const ids = (entries || []).map((entry) => entry.transaction_id)
    if (!ids.length) return NextResponse.json({ data: [] })
    const { data, error } = await supabaseAdmin.from('fintrack_transactions').select('*').in('id', ids).eq('status', 'posted').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
    if (error) return NextResponse.json({ error: 'Gagal mengambil transaksi' }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  }

  const planId = await getOwnedPlanId(auth.identity.id)
  const { data: owned } = planId
    ? await supabaseAdmin.from('fintrack_transactions').select('*').eq('plan_id', planId).eq('status', 'posted').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
    : { data: [] }
  const { data: collaborations } = await supabaseAdmin.from('fintrack_account_collaborators').select('account_id').eq('user_id', auth.identity.id).is('revoked_at', null)
  const { data: ownAccounts } = planId ? await supabaseAdmin.from('fintrack_accounts').select('id').eq('plan_id', planId).eq('archived', false) : { data: [] }
  const accessibleIds = [...new Set([...(ownAccounts || []).map((row) => row.id), ...(collaborations || []).map((row) => row.account_id)])]
  let sharedTransactions: Record<string, unknown>[] = []
  if (accessibleIds.length) {
    const { data: entries } = await supabaseAdmin.from('fintrack_transaction_entries').select('transaction_id').in('account_id', accessibleIds).order('created_at', { ascending: false }).limit(limit)
    const transactionIds = [...new Set((entries || []).map((entry) => entry.transaction_id))]
    if (transactionIds.length) {
      const { data } = await supabaseAdmin.from('fintrack_transactions').select('*').in('id', transactionIds).eq('status', 'posted').limit(limit)
      sharedTransactions = data || []
    }
  }

  const merged = [...(owned || []), ...sharedTransactions]
    .filter((value, index, array) => array.findIndex((item) => item.id === value.id) === index)
    .sort((a, b) => `${b.transaction_date}${b.created_at}`.localeCompare(`${a.transaction_date}${a.created_at}`))
    .slice(0, limit)
  return NextResponse.json({ data: merged })
}

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = transactionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { data, error } = await supabaseAdmin.rpc('fintrack_create_transaction', {
    p_actor_id: auth.identity.id,
    p_type: parsed.data.type,
    p_amount: parsed.data.amount,
    p_from_account_id: parsed.data.from_account_id || null,
    p_to_account_id: parsed.data.to_account_id || null,
    p_category_id: parsed.data.category_id || null,
    p_note: parsed.data.note || null,
    p_transaction_date: parsed.data.transaction_date,
    p_allow_negative: parsed.data.allow_negative,
  })
  if (error?.message.includes('FINTRACK_NEGATIVE_BALANCE')) {
    return NextResponse.json({ error: 'Saldo dompet akan menjadi negatif.', code: 'NEGATIVE_BALANCE' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
