import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOwnedPlanId } from '@/lib/fintrackUser'
import type { FintrackReport, Transaction } from '@/types/fintrack'

export function reportRange(month: string, cutoffDay: number) {
  const endMonth = new Date(`${month}-01T00:00:00Z`)
  const startDate = new Date(endMonth)
  if (cutoffDay === 1) {
    const nextDate = new Date(endMonth); nextDate.setUTCMonth(nextDate.getUTCMonth() + 1)
    return { start: month + '-01', end: new Date(nextDate.getTime() - 86400000).toISOString().slice(0, 10) }
  }
  startDate.setUTCMonth(startDate.getUTCMonth() - 1)
  startDate.setUTCDate(cutoffDay)
  const endDate = new Date(endMonth)
  endDate.setUTCDate(cutoffDay - 1)
  return { start: startDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) }
}

export function currentReportMonth(cutoffDay: number, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
  const date = new Date(Date.UTC(parts.year, parts.month - 1, 1))
  if (cutoffDay > 1 && parts.day >= cutoffDay) date.setUTCMonth(date.getUTCMonth() + 1)
  return date.toISOString().slice(0, 7)
}

export function previousReportMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString().slice(0, 7)
}

export function moveReportMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + delta)
  return date.toISOString().slice(0, 7)
}

export function buildFintrackReport(month: string, cutoffDay: number, transactions: Transaction[], categories: Array<{ id: string; name: string; emoji?: string | null }>): FintrackReport {
  const previous = previousReportMonth(month)
  const currentRange = reportRange(month, cutoffDay)
  const previousRange = reportRange(previous, cutoffDay)
  const all = transactions.filter((value, index, array) => array.findIndex((item) => item.id === value.id) === index)
  const current = all
    .filter((item) => item.transaction_date >= currentRange.start && item.transaction_date <= currentRange.end)
    .sort((a, b) => `${b.transaction_date}${b.created_at || ''}`.localeCompare(`${a.transaction_date}${a.created_at || ''}`))
  const before = all.filter((item) => item.transaction_date >= previousRange.start && item.transaction_date <= previousRange.end)
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const reportFor = (type: 'income' | 'expense') => {
    const grouped = new Map<string, { category_id: string | null; category_ids: string[]; name: string; emoji?: string | null; amount: number }>()
    current.filter((item) => item.type === type).forEach((item) => {
      const category = item.category_id ? categoryMap.get(item.category_id) : null
      const name = category?.name || 'Tanpa kategori'
      const key = `${type}:${name.trim().toLocaleLowerCase('id-ID')}`
      const entry = grouped.get(key) || { category_id: item.category_id || null, category_ids: [], name, emoji: category?.emoji || null, amount: 0 }
      if (item.category_id && !entry.category_ids.includes(item.category_id)) entry.category_ids.push(item.category_id)
      entry.amount += Number(item.amount)
      grouped.set(key, entry)
    })
    return [...grouped.values()].sort((a, b) => b.amount - a.amount)
  }
  const dailyMap = new Map<string, { day: string; income: number; expense: number }>()
  for (const transaction of all) {
    if (transaction.type === 'transfer') continue
    const point = dailyMap.get(transaction.transaction_date) || { day: transaction.transaction_date, income: 0, expense: 0 }
    point[transaction.type] += Number(transaction.amount)
    dailyMap.set(transaction.transaction_date, point)
  }
  const trendEnd = new Date(`${currentRange.end}T00:00:00Z`)
  const dailyStart = new Date(trendEnd); dailyStart.setUTCDate(dailyStart.getUTCDate() - 29)
  const daily = [...dailyMap.values()]
    .filter((point) => point.day >= dailyStart.toISOString().slice(0, 10) && point.day <= currentRange.end && (point.income > 0 || point.expense > 0))
    .sort((a, b) => a.day.localeCompare(b.day))
  const weeklyStart = new Date(trendEnd); weeklyStart.setUTCDate(weeklyStart.getUTCDate() - 83)
  const weekly = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(weeklyStart); start.setUTCDate(start.getUTCDate() + index * 7)
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6)
    const startKey = start.toISOString().slice(0, 10), endKey = end.toISOString().slice(0, 10)
    const values = all.filter((item) => item.type !== 'transfer' && item.transaction_date >= startKey && item.transaction_date <= endKey)
    return { key: startKey, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(start), income: values.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0), expense: values.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0) }
  })
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const key = moveReportMonth(month, index - 5), range = reportRange(key, cutoffDay)
    const values = all.filter((item) => item.type !== 'transfer' && item.transaction_date >= range.start && item.transaction_date <= range.end)
    return { key, label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${key}-01T00:00:00Z`)), income: values.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0), expense: values.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0) }
  })
  return {
    month,
    period_start: currentRange.start,
    period_end: currentRange.end,
    income: reportFor('income'),
    expense: reportFor('expense'),
    transactions: current,
    transaction_total: current.length,
    transaction_page: 1,
    transaction_page_size: current.length,
    previous: {
      month: previous,
      income: before.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount), 0),
      expense: before.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount), 0),
    },
    daily,
    weekly,
    monthly,
    trend_detail_loaded: true,
  }
}

export async function getFintrackReport(userId: string, month: string, requestedCutoffDay?: number, accountId?: string | null): Promise<FintrackReport> {
  const planId = await getOwnedPlanId(userId)
  const profile = requestedCutoffDay ? null : await supabaseAdmin.from('fintrack_users').select('month_cutoff_day').eq('id', userId).single()
  const cutoffDay = requestedCutoffDay || Number(profile?.data?.month_cutoff_day || 1)
  const oldestTrendMonth = moveReportMonth(month, -5)
  const currentRange = reportRange(month, cutoffDay)
  const trendRange = reportRange(oldestTrendMonth, cutoffDay)

  const memberships = await supabaseAdmin
    .from('fintrack_account_collaborators')
    .select('account_id, fintrack_accounts!inner(plan_id)')
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (memberships.error) throw memberships.error

  const sharedAccountIds = (memberships.data || []).map((row) => row.account_id)
  const ownedAccounts = planId ? await supabaseAdmin.from('fintrack_accounts').select('id').eq('plan_id', planId).eq('archived', false) : { data: [], error: null }
  if (ownedAccounts.error) throw ownedAccounts.error
  const accessibleAccountIds = [...new Set([...(ownedAccounts.data || []).map((account) => account.id), ...sharedAccountIds])]
  if (accountId && !accessibleAccountIds.includes(accountId)) throw new Error('Tidak punya akses ke dompet')
  const planIds = [...new Set([
    ...(planId ? [planId] : []),
    ...(memberships.data || []).map((row) => (row.fintrack_accounts as unknown as { plan_id: string }).plan_id),
  ])]

  const [ownedTransactions, sharedEntries, categoriesResult] = await Promise.all([
    planId
      ? supabaseAdmin.from('fintrack_transactions').select('*').eq('plan_id', planId).eq('status', 'posted').gte('transaction_date', trendRange.start).lte('transaction_date', currentRange.end)
      : Promise.resolve({ data: [], error: null }),
    accessibleAccountIds.length
      ? supabaseAdmin.from('fintrack_transaction_entries').select('transaction_id').in('account_id', accessibleAccountIds)
      : Promise.resolve({ data: [], error: null }),
    planIds.length
      ? supabaseAdmin.from('fintrack_categories').select('id, name, emoji').in('plan_id', planIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (ownedTransactions.error || sharedEntries.error || categoriesResult.error) throw ownedTransactions.error || sharedEntries.error || categoriesResult.error

  const sharedTransactionIds = [...new Set((sharedEntries.data || []).map((entry) => entry.transaction_id))]
  const sharedTransactions = sharedTransactionIds.length
    ? await supabaseAdmin.from('fintrack_transactions').select('*').in('id', sharedTransactionIds).eq('status', 'posted').gte('transaction_date', trendRange.start).lte('transaction_date', currentRange.end)
    : { data: [], error: null }
  if (sharedTransactions.error) throw sharedTransactions.error

  const all = ([...(ownedTransactions.data || []), ...(sharedTransactions.data || [])] as Transaction[])
    .filter((transaction) => !accountId || transaction.from_account_id === accountId || transaction.to_account_id === accountId)
  return buildFintrackReport(month, cutoffDay, all, categoriesResult.data || [])
}
