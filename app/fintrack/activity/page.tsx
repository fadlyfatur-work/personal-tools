'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowsLeftRight, CaretLeft, CaretRight, ChartDonut, CircleNotch, Receipt } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'
import { readFintrackReportCache, writeFintrackReportCache } from '@/lib/fintrackReportCache'
import type { Category, FintrackReport, ReportSlice, Transaction } from '@/types/fintrack'

const reportColors = ['var(--ft-report-1)', 'var(--ft-report-2)', 'var(--ft-report-3)', 'var(--ft-report-4)', 'var(--ft-report-5)', 'var(--ft-report-6)']
type TrendMode = 'daily' | 'weekly' | 'monthly'
type TrendPoint = { key: string; label: string; income: number; expense: number }
const labelMonth = (month: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))
function moveMonth(month: string, delta: number) { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); return date.toISOString().slice(0, 7) }

function InlineSpinner({ active, label, className = '' }: { active: boolean; label: string; className?: string }) {
  return <span className={`ft-inline-spinner ${className}`} data-active={active} role="status" aria-live="polite"><CircleNotch size={14} weight="bold" aria-hidden="true" /><span className="ft-sr-only">{active ? label : ''}</span></span>
}

function trendPoints(report: FintrackReport, mode: TrendMode): TrendPoint[] {
  if (mode === 'monthly') return report.monthly
  if (mode === 'weekly') return report.weekly
  return report.daily.map((point) => ({ key: point.day, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${point.day}T00:00:00Z`)), income: point.income, expense: point.expense }))
}

function ReportChart({ title, items, tone, onSelect }: { title: string; items: ReportSlice[]; tone: 'income' | 'expense'; onSelect: (category: string) => void }) {
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  let cursor = 0
  const gradient = items.length ? items.map((item, index) => { const start = cursor; cursor += total ? Number(item.amount) / total * 100 : 0; return `${reportColors[index % reportColors.length]} ${start}% ${cursor}%` }).join(', ') : 'var(--ft-surface-soft) 0 100%'
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>{title}</h2><p>Transfer antar-dompet tidak dihitung.</p></div><strong className={tone === 'income' ? 'ft-positive' : 'ft-negative'}>{formatRupiah(total)}</strong></div>{items.length === 0 ? <div className="ft-empty ft-report-empty"><div><ChartDonut size={32} /><p>Belum ada data pada periode ini.</p></div></div> : <div className="ft-report-content"><div className="ft-donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`${title} berdasarkan kategori`}><div><strong>{items.length}</strong><span>kategori</span></div></div><div className="ft-report-ranking">{items.map((item, index) => { const percentage = total ? Math.round(Number(item.amount) / total * 100) : 0; const value = item.category_id || '__none__'; return <button type="button" className="ft-rank ft-rank-button" key={value} onClick={() => onSelect(value)}><span><i style={{ background: reportColors[index % reportColors.length] }} /><span>{item.emoji ? `${item.emoji} ` : ''}{item.name}</span><strong>{percentage}%</strong></span><small>{formatRupiah(item.amount)}</small><span className="ft-rank-track"><i style={{ width: `${percentage}%`, background: reportColors[index % reportColors.length] }} /></span></button> })}</div></div>}</article>
}

function ComparisonChart({ report }: { report: FintrackReport }) {
  const currentIncome = report.income.reduce((sum, item) => sum + item.amount, 0), currentExpense = report.expense.reduce((sum, item) => sum + item.amount, 0)
  const max = Math.max(currentIncome, currentExpense, report.previous.income, report.previous.expense, 1)
  const rows = [{ label: 'Pemasukan', current: currentIncome, previous: report.previous.income, tone: 'income' }, { label: 'Pengeluaran', current: currentExpense, previous: report.previous.expense, tone: 'expense' }]
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>Bulan ini vs sebelumnya</h2><p>{labelMonth(report.previous.month)} sebagai pembanding.</p></div></div><div className="ft-comparison-chart">{rows.map((row) => <div className="ft-comparison-row" key={row.label}><strong>{row.label}</strong><div><span>Saat ini</span><i><b className={row.tone} style={{ width: `${row.current / max * 100}%` }} /></i><small>{formatRupiah(row.current)}</small></div><div><span>Sebelumnya</span><i><b className="previous" style={{ width: `${row.previous / max * 100}%` }} /></i><small>{formatRupiah(row.previous)}</small></div></div>)}</div></article>
}

function TrendChart({ report, mode, pendingMode, loading, onModeChange }: { report: FintrackReport; mode: TrendMode; pendingMode: TrendMode; loading: boolean; onModeChange: (mode: TrendMode) => void }) {
  const points = trendPoints(report, mode), max = Math.max(...points.flatMap((point) => [point.income, point.expense]), 1)
  const pending = pendingMode !== mode
  const rangeLabel = mode === 'monthly' ? '6 bulan terakhir' : mode === 'weekly' ? '12 minggu terakhir' : '30 hari terakhir'
  const columnWidth = mode === 'daily' ? 36 : mode === 'weekly' ? 48 : 44
  const shouldScroll = points.length * columnWidth > 330
  const gridStyle = { gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(${columnWidth - 8}px, 1fr))`, minWidth: shouldScroll ? `${points.length * columnWidth}px` : '100%' }
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>Tren {mode === 'monthly' ? 'bulanan' : mode === 'weekly' ? 'mingguan' : 'harian'}</h2><p>{rangeLabel}</p></div><InlineSpinner active={pending || loading} label={loading ? 'Memuat detail tren' : 'Menerapkan pilihan tren'} /></div><div className="ft-trend-tabs" role="tablist" aria-label="Rentang tren">{([['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={pendingMode === value} data-active={pendingMode === value} data-pending={pending && pendingMode === value} onClick={() => onModeChange(value)}>{label}</button>)}</div><div data-updating={loading}>{points.length === 0 ? <div className="ft-empty ft-report-empty"><div><p>Belum ada transaksi pada rentang ini.</p></div></div> : <><div className="ft-line-legend"><span><i className="income" />Pemasukan</span><span><i className="expense" />Pengeluaran</span></div><div className="ft-trend-scroll" data-scrollable={shouldScroll}><div className="ft-trend-bars" data-density={mode} style={gridStyle} role="img" aria-label={`Grafik batang tren ${mode} pemasukan dan pengeluaran`}>{points.map((point) => <div className="ft-trend-bar-group" key={point.key}><div><span className="income" tabIndex={0} data-tooltip={`Pemasukan ${formatRupiah(point.income)}`} style={{ height: `${Math.max(3, point.income / max * 100)}%` }} /><span className="expense" tabIndex={0} data-tooltip={`Pengeluaran ${formatRupiah(point.expense)}`} style={{ height: `${Math.max(3, point.expense / max * 100)}%` }} /></div><small>{point.label}</small></div>)}</div></div></>}</div></article>
}

function TransactionRows({ transactions, accountMap, categoryMap, emptyLabel, onEdit }: { transactions: Transaction[]; accountMap: Map<string, string>; categoryMap: Map<string, Category>; emptyLabel: string; onEdit: (transaction: Transaction) => void }) {
  return <div className="ft-transaction-list">{transactions.length === 0 ? <div className="ft-empty"><div><Receipt size={34} /><p>{emptyLabel}</p></div></div> : transactions.map((transaction) => {
    const Icon = transaction.type === 'income' ? ArrowDown : transaction.type === 'expense' ? ArrowUp : ArrowsLeftRight
    const accountId = transaction.type === 'income' ? transaction.to_account_id : transaction.from_account_id, category = transaction.category_id ? categoryMap.get(transaction.category_id) : null
    const meta = [accountId ? accountMap.get(accountId) : null, new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${transaction.transaction_date}T00:00:00`))].filter(Boolean).join(' • ')
    return <button type="button" className="ft-transaction-row ft-transaction-button" key={transaction.id} onClick={() => onEdit(transaction)}><span className={`ft-transaction-icon ${transaction.type}`}>{category?.emoji || <Icon size={17} weight="bold" />}</span><span className="ft-transaction-copy"><span className="ft-transaction-category">{category?.name || (transaction.type === 'transfer' ? 'Transfer' : 'Tanpa kategori')}</span><strong>{transaction.note || (transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'expense' ? 'Pengeluaran' : 'Transfer antar-dompet')}</strong><span>{meta}</span></span><span className={`ft-transaction-amount ${transaction.type === 'income' ? 'ft-positive' : transaction.type === 'expense' ? 'ft-negative' : ''}`}>{transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}{formatRupiah(transaction.amount)}</span></button>
  })}</div>
}

function Pagination({ page, totalPages, total, busy, onPage }: { page: number; totalPages: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  if (total <= 10) return null
  return <nav className="ft-pagination" aria-label="Halaman transaksi"><button type="button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya"><CaretLeft size={16} /></button><span>Halaman <strong>{page}</strong> dari {totalPages}</span><button type="button" disabled={busy || page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya"><CaretRight size={16} /></button></nav>
}

export default function ActivityPage() {
  const { data, user, accounts, categories, loading, beginTask, endTask, isBusy, openComposer } = useFintrack()
  const [view, setView] = useState<'transactions' | 'report'>('transactions'), [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [report, setReport] = useState<FintrackReport | null>(null), [selectedCategory, setSelectedCategory] = useState('__all__'), [pendingCategory, setPendingCategory] = useState('__all__')
  const [selectedAccount, setSelectedAccount] = useState('__all__'), [pendingAccount, setPendingAccount] = useState('__all__')
  const [trendMode, setTrendMode] = useState<TrendMode>('monthly'), [pendingTrendMode, setPendingTrendMode] = useState<TrendMode>('monthly')
  const [pendingMonth, setPendingMonth] = useState<string | null>(null)
  const touchStart = useRef<number | null>(null)
  const debounceTimers = useRef<{ month: number | null; account: number | null; category: number | null; trend: number | null }>({ month: null, account: null, category: null, trend: null })
  useEffect(() => () => { Object.values(debounceTimers.current).forEach((timer) => { if (timer) window.clearTimeout(timer) }) }, [])
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]), categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 150 }} /><div className="ft-skeleton-line" style={{ height: 310, marginTop: 28 }} /></div>
  if (!user || !data) return null
  const currentReport = data.report, activeReport = report || currentReport, displayedMonth = pendingMonth || activeReport.month
  const visibleTransactions = (filter === 'all' ? activeReport.transactions : activeReport.transactions.filter((transaction) => transaction.type === filter)).filter((transaction) => transaction.type !== 'transfer' || filter === 'all')
  const emptyLabel = filter === 'income' ? 'Belum ada pemasukan pada periode ini.' : filter === 'expense' ? 'Belum ada pengeluaran pada periode ini.' : 'Belum ada transaksi pada periode ini.'
  const reportCategories = [...activeReport.expense, ...activeReport.income].filter((item, index, array) => array.findIndex((other) => (other.category_id || '__none__') === (item.category_id || '__none__')) === index)
  const selectedSlice = reportCategories.find((item) => (item.category_id || '__none__') === selectedCategory)
  const reportTransactions = activeReport.transactions.filter((transaction) => transaction.type !== 'transfer' && (selectedCategory === '__all__' || (selectedCategory === '__none__' ? !transaction.category_id : Boolean(transaction.category_id && selectedSlice?.category_ids.includes(transaction.category_id)))))
  const totalPages = Math.max(1, Math.ceil(activeReport.transaction_total / activeReport.transaction_page_size))

  const cacheKey = (month: string, account: string, details: boolean) => `${month}:${account}:${details ? 'full' : 'summary'}`
  async function fetchReport(month: string, account: string, details: boolean) {
    if (month === currentReport.month && account === '__all__' && !details) return currentReport
    const key = cacheKey(month, account, details), cached = readFintrackReportCache(key)
    if (cached) return cached
    const params = new URLSearchParams({ month, details: details ? '1' : '0' })
    if (account !== '__all__') params.set('account_id', account)
    const response = await fintrackRequest(`/api/fintrack/reports?${params}`, undefined, null), body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Laporan gagal dimuat')
    writeFintrackReportCache(key, body.data)
    return body.data as FintrackReport
  }
  async function fetchTransactionPage(page: number, category = '__all__', type: 'all' | 'income' | 'expense' = 'all', includeTransfers = true) {
    const params = new URLSearchParams({ month: activeReport.month, details: '0', page: String(page), include_transfers: includeTransfers ? '1' : '0' })
    if (selectedAccount !== '__all__') params.set('account_id', selectedAccount)
    if (category !== '__all__') params.set('category_id', category)
    if (type !== 'all') params.set('transaction_type', type)
    const key = `transactions:${params.toString()}`, cached = readFintrackReportCache(key)
    if (cached) return cached
    const response = await fintrackRequest(`/api/fintrack/reports?${params}`, undefined, null), body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Transaksi gagal dimuat')
    writeFintrackReportCache(key, body.data)
    return body.data as FintrackReport
  }
  async function applyTransactionPage(page: number, category = selectedCategory, type = filter, includeTransfers = view === 'transactions') {
    beginTask('transaction-page', 'Memuat transaksi')
    try {
      const paged = await fetchTransactionPage(page, category, type, includeTransfers)
      setReport((current) => current?.month === paged.month && current.trend_detail_loaded ? { ...paged, daily: current.daily, weekly: current.weekly, monthly: current.monthly, trend_detail_loaded: true } : paged)
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Transaksi gagal dimuat') } finally { endTask('transaction-page') }
  }
  function resetReportFilters() { setSelectedCategory('__all__'); setPendingCategory('__all__'); setTrendMode('monthly'); setPendingTrendMode('monthly') }
  async function applyMonth(nextMonth: string) {
    beginTask('report-month', 'Memuat periode')
    try { setReport(await fetchReport(nextMonth, selectedAccount, false)); resetReportFilters() } catch (error) { window.alert(error instanceof Error ? error.message : 'Periode gagal dimuat') } finally { setPendingMonth(null); endTask('report-month') }
  }
  function selectMonth(nextMonth: string) {
    if (nextMonth > currentReport.month) return
    setPendingMonth(nextMonth); if (debounceTimers.current.month) window.clearTimeout(debounceTimers.current.month)
    debounceTimers.current.month = window.setTimeout(() => { void applyMonth(nextMonth) }, 2000)
  }
  async function applyAccount(nextAccount: string) {
    beginTask('report-account', 'Memfilter dompet')
    try { setReport(await fetchReport(activeReport.month, nextAccount, false)); setSelectedAccount(nextAccount); resetReportFilters() } catch (error) { setPendingAccount(selectedAccount); window.alert(error instanceof Error ? error.message : 'Filter dompet gagal diterapkan') } finally { endTask('report-account') }
  }
  function selectAccount(nextAccount: string) {
    setPendingAccount(nextAccount); if (debounceTimers.current.account) window.clearTimeout(debounceTimers.current.account)
    debounceTimers.current.account = window.setTimeout(() => { void applyAccount(nextAccount) }, 2000)
  }
  function selectCategory(value: string) {
    setPendingCategory(value); if (debounceTimers.current.category) window.clearTimeout(debounceTimers.current.category)
    debounceTimers.current.category = window.setTimeout(async () => { setSelectedCategory(value); await applyTransactionPage(1, value, 'all', false); window.setTimeout(() => document.getElementById('report-transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }, 2000)
  }
  async function applyTrendMode(nextMode: TrendMode) {
    if (nextMode === 'monthly' || activeReport.trend_detail_loaded) return setTrendMode(nextMode)
    beginTask('trend-detail', 'Memuat detail tren')
    try { const detailed = await fetchReport(activeReport.month, selectedAccount, true); setReport((current) => current ? { ...current, daily: detailed.daily, weekly: detailed.weekly, monthly: detailed.monthly, trend_detail_loaded: true } : detailed); setTrendMode(nextMode) } catch (error) { setPendingTrendMode(trendMode); window.alert(error instanceof Error ? error.message : 'Detail tren gagal dimuat') } finally { endTask('trend-detail') }
  }
  function selectTrendMode(nextMode: TrendMode) { setPendingTrendMode(nextMode); if (debounceTimers.current.trend) window.clearTimeout(debounceTimers.current.trend); debounceTimers.current.trend = window.setTimeout(() => { void applyTrendMode(nextMode) }, 2000) }
  function selectTransactionFilter(nextFilter: 'all' | 'income' | 'expense') { setFilter(nextFilter); void applyTransactionPage(1, '__all__', nextFilter, true) }
  function selectView(nextView: 'transactions' | 'report') { setView(nextView); setSelectedCategory('__all__'); setPendingCategory('__all__'); void applyTransactionPage(1, '__all__', 'all', nextView === 'transactions') }
  const periodPending = Boolean(pendingMonth) || isBusy('report-month'), accountPending = pendingAccount !== selectedAccount || isBusy('report-account')

  return <main className="ft-container"><Header user={user} eyebrow={labelMonth(data.report.month)} title="Aktivitas" />
    <div className="ft-page-tabs" role="tablist" aria-label="Tampilan aktivitas"><button role="tab" aria-selected={view === 'transactions'} data-active={view === 'transactions'} onClick={() => selectView('transactions')}>Transaksi</button><button role="tab" aria-selected={view === 'report'} data-active={view === 'report'} onClick={() => selectView('report')}>Laporan<InlineSpinner active={periodPending} label="Menerapkan periode laporan" className="ft-tab-spinner" /></button></div>
    <div className="ft-activity-filters">
      <div className="ft-month-switcher" data-pending={Boolean(pendingMonth)} onTouchStart={(event) => { if (!isBusy('report-month')) touchStart.current = event.touches[0].clientX }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) selectMonth(moveMonth(displayedMonth, delta > 0 ? -1 : 1)); touchStart.current = null }}><button type="button" disabled={isBusy('report-month')} onClick={() => selectMonth(moveMonth(displayedMonth, -1))} aria-label="Bulan sebelumnya"><CaretLeft size={18} /></button><div><span>Periode</span><strong>{labelMonth(displayedMonth)}</strong><small>{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${activeReport.period_start}T00:00:00`))}-{new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${activeReport.period_end}T00:00:00`))}</small></div><button type="button" disabled={isBusy('report-month') || displayedMonth >= data.report.month} onClick={() => selectMonth(moveMonth(displayedMonth, 1))} aria-label="Bulan berikutnya"><CaretRight size={18} /></button></div>
      <div className="ft-report-filter" data-pending={accountPending}><div className="ft-report-filter-heading"><label htmlFor="report-account">Filter dompet</label><InlineSpinner active={accountPending} label="Menerapkan filter dompet" /></div><select id="report-account" className="ft-input" value={pendingAccount} onChange={(event) => selectAccount(event.target.value)}><option value="__all__">Semua dompet</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.access_role !== 'owner' ? ' (dibagikan)' : ''}</option>)}</select></div>
    </div>
    {view === 'transactions' ? <section className="ft-tab-panel"><div className="ft-sub-tabs" role="tablist" aria-label="Filter transaksi"><button role="tab" aria-selected={filter === 'all'} data-active={filter === 'all'} onClick={() => selectTransactionFilter('all')}>Semua</button><button role="tab" aria-selected={filter === 'income'} data-active={filter === 'income'} onClick={() => selectTransactionFilter('income')}>Pemasukan</button><button role="tab" aria-selected={filter === 'expense'} data-active={filter === 'expense'} onClick={() => selectTransactionFilter('expense')}>Pengeluaran</button></div><div className="ft-card ft-transactions" data-updating={isBusy('report-month') || isBusy('report-account') || isBusy('transaction-page')}><TransactionRows transactions={visibleTransactions} accountMap={accountMap} categoryMap={categoryMap} emptyLabel={emptyLabel} onEdit={openComposer} /></div><Pagination page={activeReport.transaction_page} totalPages={totalPages} total={activeReport.transaction_total} busy={isBusy('transaction-page')} onPage={(page) => void applyTransactionPage(page, '__all__', filter, true)} /></section> : <section className="ft-tab-panel ft-report-list">
      <ComparisonChart report={activeReport} />
      <TrendChart report={activeReport} mode={trendMode} pendingMode={pendingTrendMode} loading={isBusy('trend-detail')} onModeChange={selectTrendMode} />
      <div className="ft-report-filter" data-pending={pendingCategory !== selectedCategory}><div className="ft-report-filter-heading"><label htmlFor="report-category">Filter kategori</label><InlineSpinner active={pendingCategory !== selectedCategory} label="Menerapkan filter kategori" /></div><select id="report-category" className="ft-input" value={pendingCategory} onChange={(event) => selectCategory(event.target.value)}><option value="__all__">Semua kategori</option>{reportCategories.map((category) => <option key={category.category_id || '__none__'} value={category.category_id || '__none__'}>{category.emoji ? `${category.emoji} ` : ''}{category.name}</option>)}</select></div>
      <ReportChart title="Pengeluaran" items={activeReport.expense} tone="expense" onSelect={selectCategory} /><ReportChart title="Pemasukan" items={activeReport.income} tone="income" onSelect={selectCategory} />
      <article className="ft-report-card" id="report-transactions"><div className="ft-report-heading"><div><h2>Transaksi periode ini</h2><p>{selectedCategory === '__all__' ? 'Pemasukan dan pengeluaran, tanpa transfer.' : `Kategori: ${selectedCategory === '__none__' ? 'Tanpa kategori' : categoryMap.get(selectedCategory)?.name || 'Kategori'}`}</p></div><strong>{activeReport.transaction_total}</strong></div><div className="ft-transactions ft-report-transactions" data-updating={isBusy('transaction-page')}><TransactionRows transactions={reportTransactions} accountMap={accountMap} categoryMap={categoryMap} emptyLabel="Belum ada transaksi untuk filter ini." onEdit={openComposer} /></div><Pagination page={activeReport.transaction_page} totalPages={totalPages} total={activeReport.transaction_total} busy={isBusy('transaction-page')} onPage={(page) => void applyTransactionPage(page, selectedCategory, 'all', false)} /></article>
    </section>}<BottomNav /></main>
}
