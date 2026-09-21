import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId, requireFintrackIdentity } from '@/lib/fintrackUser'
import { buildFintrackReport, currentReportMonth, moveReportMonth, reportRange } from '@/lib/fintrackReport'
import type { Transaction } from '@/types/fintrack'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response

  const userId = auth.identity.id
  const [planId, membershipsResult, securityResult] = await Promise.all([
    getOwnedPlanId(userId),
    supabaseAdmin.from('fintrack_account_collaborators').select('account_id, role, can_manage, accepted_at, fintrack_accounts!inner(*)').eq('user_id', userId).is('revoked_at', null),
    supabaseAdmin.from('fintrack_users').select('pin_hash, month_cutoff_day, sort_accounts_by_balance').eq('id', userId).maybeSingle(),
  ])

  if (membershipsResult.error || securityResult.error) {
    return NextResponse.json({ error: 'Gagal memuat profil FinTrack' }, { status: 500 })
  }

  const ownedResult = planId
    ? await supabaseAdmin.from('fintrack_accounts').select('*').eq('plan_id', planId).eq('archived', false).order('sort_order').order('created_at')
    : { data: [], error: null }

  const cutoffDay = Number(securityResult.data?.month_cutoff_day || 1)
  const month = currentReportMonth(cutoffDay)
  const monthRange = reportRange(month, cutoffDay)
  const monthEnd = monthRange.end
  const trendRange = reportRange(moveReportMonth(month, -5), cutoffDay)

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
  const accessibleAccountIds = accounts.map((account) => String(account.id))
  const planIds = [...new Set(accounts.map((account) => String(account.plan_id)))]

  const ownedAccountIds = ownedAccounts.map((account) => account.id)
  const [categoriesResult, ownedLatestResult, ownedReportResult, sharedEntriesResult, requestsResult, ownedCollaborationsResult] = await Promise.all([
    planIds.length
      ? supabaseAdmin.from('fintrack_categories').select('*').in('plan_id', planIds).is('archived_at', null).order('name')
      : Promise.resolve({ data: [], error: null }),
    planId
      ? supabaseAdmin.from('fintrack_transactions').select('*').eq('plan_id', planId).eq('status', 'posted').order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(60)
      : Promise.resolve({ data: [], error: null }),
    planId
      ? supabaseAdmin.from('fintrack_transactions').select('*').eq('plan_id', planId).eq('status', 'posted').gte('transaction_date', trendRange.start).lte('transaction_date', monthEnd)
      : Promise.resolve({ data: [], error: null }),
    accessibleAccountIds.length
      ? supabaseAdmin.from('fintrack_transaction_entries').select('transaction_id').in('account_id', accessibleAccountIds).order('created_at', { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    ownedAccountIds.length
      ? supabaseAdmin.from('fintrack_account_join_requests').select('id, account_id, requester_id, status, requested_at').in('account_id', ownedAccountIds).eq('status', 'pending').order('requested_at')
      : Promise.resolve({ data: [], error: null }),
    ownedAccountIds.length
      ? supabaseAdmin.from('fintrack_account_collaborators').select('account_id, user_id, role, can_manage, accepted_at').in('account_id', ownedAccountIds).is('revoked_at', null)
      : Promise.resolve({ data: [], error: null }),
  ])

  const sharedTransactionIds = [...new Set((sharedEntriesResult.data || []).map((entry) => entry.transaction_id))]
  const personIds = [...new Set([...(requestsResult.data || []).map((item) => item.requester_id), ...(ownedCollaborationsResult.data || []).map((item) => item.user_id)])]
  const [sharedTransactionsResult, peopleResult] = await Promise.all([
    sharedTransactionIds.length
      ? supabaseAdmin.from('fintrack_transactions').select('*').in('id', sharedTransactionIds).eq('status', 'posted')
      : Promise.resolve({ data: [], error: null }),
    personIds.length
      ? supabaseAdmin.from('fintrack_users').select('id, name, email').in('id', personIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (categoriesResult.error || ownedLatestResult.error || ownedReportResult.error || sharedEntriesResult.error || requestsResult.error || ownedCollaborationsResult.error || sharedTransactionsResult.error || peopleResult.error) {
    return NextResponse.json({ error: 'Gagal memuat data keuangan' }, { status: 500 })
  }
  const categories = [...new Map((categoriesResult.data || []).map((category) => [category.id, category])).values()]

  const sharedTransactions = sharedTransactionsResult.data || []
  const transactions = [...(ownedLatestResult.data || []), ...sharedTransactions]
    .filter((value, index, array) => array.findIndex((item) => item.id === value.id) === index)
    .sort((a, b) => `${b.transaction_date}${b.created_at}`.localeCompare(`${a.transaction_date}${a.created_at}`))
    .slice(0, 60)
  const report = buildFintrackReport(month, cutoffDay, [...(ownedReportResult.data || []), ...sharedTransactions] as Transaction[], categories)
  const monthlyTransactions = report.transactions

  const includedOwned = ownedAccounts.filter((account) => account.include_in_net_worth !== false)
  const assets = includedOwned.filter((account) => account.classification === 'asset').reduce((sum, account) => sum + Number(account.current_balance), 0)
  const liabilities = includedOwned.filter((account) => account.classification === 'liability').reduce((sum, account) => sum + Number(account.current_balance), 0)
  const income = monthlyTransactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0)
  const expense = monthlyTransactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0)
  const peopleMap = new Map((peopleResult.data || []).map((person) => [person.id, person]))
  const accountMap = new Map(ownedAccounts.map((account) => [account.id, account]))

  return NextResponse.json({
    user: { id: userId, name: auth.identity.name, email: auth.identity.email },
    has_pin: Boolean(securityResult.data?.pin_hash),
    month_cutoff_day: cutoffDay,
    sort_accounts_by_balance: Boolean(securityResult.data?.sort_accounts_by_balance),
    personal_plan_id: planId || null,
    accounts,
    categories,
    transactions,
    summary: { assets, liabilities, net_worth: assets - liabilities, income, expense },
    report: { ...report, transactions: report.transactions.slice(0, 10), transaction_page: 1, transaction_page_size: 10, daily: [], weekly: [], trend_detail_loaded: false },
    collaboration: {
      owned_accounts: ownedAccounts,
      pending_requests: (requestsResult.data || []).map((request) => ({ ...request, requester: peopleMap.get(request.requester_id) || null, account: accountMap.get(request.account_id) || null })),
      shared_with_me: membershipsResult.data || [],
      collaborators: (ownedCollaborationsResult.data || []).map((item) => ({ ...item, user: peopleMap.get(item.user_id) || null, account: accountMap.get(item.account_id) || null })),
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
