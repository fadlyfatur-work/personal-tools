import { reportTransactionType } from '@/lib/fintrackCategories'
import { NextRequest, NextResponse } from 'next/server'
import { currentReportMonth, getFintrackReport } from '@/lib/fintrackReport'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { searchTransactionNotes } from '@/lib/fintrackOrdering'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const requestedMonth = request.nextUrl.searchParams.get('month')
  const accountId = request.nextUrl.searchParams.get('account_id')
  const includeTrendDetails = request.nextUrl.searchParams.get('details') !== '0'
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1) || 1)
  const parentId = request.nextUrl.searchParams.get('parent_id')
  const categoryId = request.nextUrl.searchParams.get('category_id')
  const date = request.nextUrl.searchParams.get('date')
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return NextResponse.json({ error: 'Tanggal tidak valid' }, { status: 400 })
  const search = (request.nextUrl.searchParams.get('q') || '').trim()
  if (search.length > 100) return NextResponse.json({ error: 'Pencarian maksimal 100 karakter' }, { status: 400 })
  const transactionType = request.nextUrl.searchParams.get('transaction_type')
  const includeTransfers = request.nextUrl.searchParams.get('include_transfers') !== '0'
  const profile = requestedMonth ? null : await supabaseAdmin.from('fintrack_users').select('month_cutoff_day').eq('id', auth.identity.id).single()
  const month = requestedMonth || currentReportMonth(Number(profile?.data?.month_cutoff_day || 1))
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Periode laporan tidak valid' }, { status: 400 })
  if (accountId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) return NextResponse.json({ error: 'Dompet tidak valid' }, { status: 400 })
  if (transactionType && !['income', 'expense'].includes(transactionType)) return NextResponse.json({ error: 'Jenis transaksi tidak valid' }, { status: 400 })
  try {
    const report = await getFintrackReport(auth.identity.id, month, undefined, accountId, parentId)
    const selectedSlice = [...report.income, ...report.expense].find((item) => item.category_id === categoryId)
    const baseTransactions = report.transactions.filter((item) => (includeTransfers || reportTransactionType(item) !== 'transfer') && (!transactionType || reportTransactionType(item) === transactionType))
    const filteredTransactions = categoryId === '__none__' ? baseTransactions.filter((item) => !item.category_id) : categoryId ? baseTransactions.filter((item) => Boolean(item.category_id && (selectedSlice?.category_ids || [categoryId]).includes(item.category_id))) : baseTransactions
    if (categoryId) {
      const matches = (item: { category_id: string | null }) => categoryId === '__none__' ? !item.category_id : item.category_id === categoryId
      report.income = report.income.filter(matches)
      report.expense = report.expense.filter(matches)
    }
    const matchedTransactions = searchTransactionNotes(filteredTransactions, search)
    const dayMap = new Map<string, { day: string; income: boolean; expense: boolean }>()
    for (const transaction of matchedTransactions) {
      const day = dayMap.get(transaction.transaction_date) || { day: transaction.transaction_date, income: false, expense: false }
      if (reportTransactionType(transaction) !== 'transfer') day[reportTransactionType(transaction) as 'income' | 'expense'] = true
      dayMap.set(day.day, day)
    }
    const selectedTransactions = date ? matchedTransactions.filter(item => item.transaction_date === date) : matchedTransactions
    const pageSize = 10, offset = (page - 1) * pageSize
    const paged = { ...report, calendar_days: [...dayMap.values()], transactions: selectedTransactions.slice(offset, offset + pageSize), transaction_total: selectedTransactions.length, transaction_page: page, transaction_page_size: pageSize }
    const data = includeTrendDetails ? paged : { ...paged, daily: [], weekly: [], trend_detail_loaded: false }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Laporan gagal dimuat' }, { status: 500 })
  }
}
