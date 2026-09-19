import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response

  const userId = auth.identity.id
  const planId = await getOwnedPlanId(userId)
  const month = new Date().toISOString().slice(0, 7)
  const monthStart = `${month}-01`
  const nextMonthDate = new Date(`${monthStart}T00:00:00Z`)
  nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1)
  const monthEnd = new Date(nextMonthDate.getTime() - 86400000).toISOString().slice(0, 10)

  const [ownedResult, membershipsResult, securityResult] = await Promise.all([
    planId
      ? supabaseAdmin.from('fintrack_accounts').select('*').eq('plan_id', planId).eq('archived', false).order('created_at')
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('fintrack_account_collaborators').select('account_id, role, can_manage, accepted_at, fintrack_accounts!inner(*)').eq('user_id', userId).is('revoked_at', null),
    supabaseAdmin.from('fintrack_users').select('pin_hash').eq('id', userId).maybeSingle(),
  ])

  if (ownedResult.error || membershipsResult.error) {
    return NextResponse.json({ error: 'Gagal memuat dompet FinTrack' }, { status: 500 })
  }

  const ownedAccounts = (ownedResult.data || []).map((account) => ({ ...account, access_role: 'owner', can_manage: true }))
  const sharedAccounts = (membershipsResult.data || []).map((row) => ({
    ...(row.fintrack_accounts as unknown as Record<string, unknown>),
    access_role: row.role,
    can_manage: row.can_manage,
  })) as unknown as Array<Record<string, unknown> & { id: string; plan_id: string }>
  const accounts = [...ownedAccounts, ...sharedAccounts]
  const sharedIds = sharedAccounts.map((account) => String(account.id))
  const planIds = [...new Set(accounts.map((account) => String(account.plan_id)))]

  const [categoriesResult, ownedLatestResult, ownedMonthResult, sharedEntriesResult] = await Promise.all([
    planIds.length
      ? supabaseAdmin.from('fintrack_categories').select('*').in('plan_id', planIds).is('archived_at', null).order('name')
      : Promise.resolve({ data: [], error: null }),
    planId
      ? supabaseAdmin.from('fintrack_transactions').select('*').eq('plan_id', planId).eq('status', 'posted').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(60)
      : Promise.resolve({ data: [], error: null }),
    planId
      ? supabaseAdmin.from('fintrack_transactions').select('*').eq('plan_id', planId).eq('status', 'posted').gte('transaction_date', monthStart).lte('transaction_date', monthEnd)
      : Promise.resolve({ data: [], error: null }),
    sharedIds.length
      ? supabaseAdmin.from('fintrack_transaction_entries').select('transaction_id').in('account_id', sharedIds).order('created_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
  ])

  const sharedTransactionIds = [...new Set((sharedEntriesResult.data || []).map((entry) => entry.transaction_id))]
  const sharedTransactionsResult = sharedTransactionIds.length
    ? await supabaseAdmin.from('fintrack_transactions').select('*').in('id', sharedTransactionIds).eq('status', 'posted')
    : { data: [], error: null }

  if (categoriesResult.error || ownedLatestResult.error || ownedMonthResult.error || sharedTransactionsResult.error) {
    return NextResponse.json({ error: 'Gagal memuat data keuangan' }, { status: 500 })
  }

  const sharedTransactions = sharedTransactionsResult.data || []
  const transactions = [...(ownedLatestResult.data || []), ...sharedTransactions]
    .filter((value, index, array) => array.findIndex((item) => item.id === value.id) === index)
    .sort((a, b) => `${b.transaction_date}${b.created_at}`.localeCompare(`${a.transaction_date}${a.created_at}`))
    .slice(0, 60)
  const monthlyTransactions = [...(ownedMonthResult.data || []), ...sharedTransactions.filter((item) => item.transaction_date >= monthStart && item.transaction_date <= monthEnd)]
    .filter((value, index, array) => array.findIndex((item) => item.id === value.id) === index)

  const includedOwned = ownedAccounts.filter((account) => account.include_in_net_worth !== false)
  const assets = includedOwned.filter((account) => account.classification === 'asset').reduce((sum, account) => sum + Number(account.current_balance), 0)
  const liabilities = includedOwned.filter((account) => account.classification === 'liability').reduce((sum, account) => sum + Number(account.current_balance), 0)
  const income = monthlyTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0)
  const expense = monthlyTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
  const categoryMap = new Map((categoriesResult.data || []).map((category) => [category.id, category.name]))
  const reportFor = (type: 'income' | 'expense') => {
    const grouped = new Map<string, { category_id: string | null; name: string; amount: number }>()
    monthlyTransactions.filter((item) => item.type === type).forEach((item) => {
      const key = item.category_id || 'uncategorized'
      const current = grouped.get(key) || { category_id: item.category_id, name: categoryMap.get(item.category_id) || 'Tanpa kategori', amount: 0 }
      current.amount += Number(item.amount)
      grouped.set(key, current)
    })
    return [...grouped.values()].sort((a, b) => b.amount - a.amount)
  }

  const ownedAccountIds = ownedAccounts.map((account) => account.id)
  const [requestsResult, ownedCollaborationsResult] = await Promise.all([
    ownedAccountIds.length
      ? supabaseAdmin.from('fintrack_account_join_requests').select('id, account_id, requester_id, status, requested_at').in('account_id', ownedAccountIds).eq('status', 'pending').order('requested_at')
      : Promise.resolve({ data: [], error: null }),
    ownedAccountIds.length
      ? supabaseAdmin.from('fintrack_account_collaborators').select('account_id, user_id, role, can_manage, accepted_at').in('account_id', ownedAccountIds).is('revoked_at', null)
      : Promise.resolve({ data: [], error: null }),
  ])
  const personIds = [...new Set([...(requestsResult.data || []).map((item) => item.requester_id), ...(ownedCollaborationsResult.data || []).map((item) => item.user_id)])]
  const peopleResult = personIds.length ? await supabaseAdmin.from('fintrack_users').select('id, name, email').in('id', personIds) : { data: [] }
  const peopleMap = new Map((peopleResult.data || []).map((person) => [person.id, person]))
  const accountMap = new Map(ownedAccounts.map((account) => [account.id, account]))

  return NextResponse.json({
    user: { id: userId, name: auth.identity.name, email: auth.identity.email },
    has_pin: Boolean(securityResult.data?.pin_hash),
    personal_plan_id: planId || null,
    accounts,
    categories: categoriesResult.data || [],
    transactions,
    summary: { assets, liabilities, net_worth: assets - liabilities, income, expense },
    report: { month, income: reportFor('income'), expense: reportFor('expense') },
    collaboration: {
      owned_accounts: ownedAccounts,
      pending_requests: (requestsResult.data || []).map((request) => ({ ...request, requester: peopleMap.get(request.requester_id) || null, account: accountMap.get(request.account_id) || null })),
      shared_with_me: membershipsResult.data || [],
      collaborators: (ownedCollaborationsResult.data || []).map((item) => ({ ...item, user: peopleMap.get(item.user_id) || null, account: accountMap.get(item.account_id) || null })),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
