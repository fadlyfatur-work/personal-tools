import { NextRequest, NextResponse } from 'next/server'
import { getFintrackReport } from '@/lib/fintrackReport'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { currentReportMonth } from '@/lib/fintrackReport'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const requestedMonth = request.nextUrl.searchParams.get('month')
  const accountId = request.nextUrl.searchParams.get('account_id')
  const includeTrendDetails = request.nextUrl.searchParams.get('details') !== '0'
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1) || 1)
  const categoryId = request.nextUrl.searchParams.get('category_id')
  const transactionType = request.nextUrl.searchParams.get('transaction_type')
  const includeTransfers = request.nextUrl.searchParams.get('include_transfers') !== '0'
  const profile = requestedMonth ? null : await supabaseAdmin.from('fintrack_users').select('month_cutoff_day').eq('id', auth.identity.id).single()
  const month = requestedMonth || currentReportMonth(Number(profile?.data?.month_cutoff_day || 1))
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Periode laporan tidak valid' }, { status: 400 })
  if (accountId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accountId)) return NextResponse.json({ error: 'Dompet tidak valid' }, { status: 400 })
  if (transactionType && !['income', 'expense'].includes(transactionType)) return NextResponse.json({ error: 'Jenis transaksi tidak valid' }, { status: 400 })
  try {
    const report = await getFintrackReport(auth.identity.id, month, undefined, accountId)
    const selectedSlice = [...report.income, ...report.expense].find((item) => item.category_id === categoryId || item.category_ids.includes(categoryId || ''))
    const baseTransactions = report.transactions.filter((item) => (includeTransfers || item.type !== 'transfer') && (!transactionType || item.type === transactionType))
    const filteredTransactions = categoryId === '__none__' ? baseTransactions.filter((item) => !item.category_id) : categoryId ? baseTransactions.filter((item) => Boolean(item.category_id && (selectedSlice?.category_ids || [categoryId]).includes(item.category_id))) : baseTransactions
    const pageSize = 10, offset = (page - 1) * pageSize
    const paged = { ...report, transactions: filteredTransactions.slice(offset, offset + pageSize), transaction_total: filteredTransactions.length, transaction_page: page, transaction_page_size: pageSize }
    const data = includeTrendDetails ? paged : { ...paged, daily: [], weekly: [], trend_detail_loaded: false }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Laporan gagal dimuat' }, { status: 500 })
  }
}
