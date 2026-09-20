'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowsLeftRight, CaretLeft, CaretRight, ChartDonut, CircleNotch, Receipt } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'
import type { FintrackReport, ReportSlice, Transaction } from '@/types/fintrack'

const reportColors = ['var(--ft-report-1)', 'var(--ft-report-2)', 'var(--ft-report-3)', 'var(--ft-report-4)', 'var(--ft-report-5)', 'var(--ft-report-6)']
type TrendMode = 'daily' | 'weekly' | 'monthly'
type TrendPoint = { key: string; label: string; income: number; expense: number }
const labelMonth = (month: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))
function moveMonth(month: string, delta: number) { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); return date.toISOString().slice(0, 7) }

function InlineSpinner({ active, label, className = '' }: { active: boolean; label: string; className?: string }) {
  return <span className={`ft-inline-spinner ${className}`} data-active={active} role="status" aria-live="polite"><CircleNotch size={14} weight="bold" aria-hidden="true" /><span className="ft-sr-only">{active ? label : ''}</span></span>
}

function trendPoints(report: FintrackReport, mode: TrendMode): TrendPoint[] {
  const currentIncome = report.income.reduce((sum, item) => sum + Number(item.amount), 0)
  const currentExpense = report.expense.reduce((sum, item) => sum + Number(item.amount), 0)
  if (mode === 'monthly') return [
    { key: report.previous.month, label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${report.previous.month}-01T00:00:00`)), income: report.previous.income, expense: report.previous.expense },
    { key: report.month, label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(`${report.month}-01T00:00:00`)), income: currentIncome, expense: currentExpense },
  ]
  const dailyMap = new Map(report.daily.map((point) => [point.day, point]))
  const days: TrendPoint[] = []
  const cursor = new Date(`${report.period_start}T00:00:00Z`)
  const end = new Date(`${report.period_end}T00:00:00Z`)
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10)
    const value = dailyMap.get(day)
    days.push({ key: day, label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(cursor), income: value?.income || 0, expense: value?.expense || 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  if (mode === 'daily') return days
  const weeks = new Map<number, TrendPoint>()
  days.forEach((point, index) => {
    const week = Math.floor(index / 7)
    const current = weeks.get(week) || { key: `week-${week + 1}`, label: `Minggu ${week + 1}`, income: 0, expense: 0 }
    current.income += point.income
    current.expense += point.expense
    weeks.set(week, current)
  })
  return [...weeks.values()]
}

function ReportChart({ title, items, tone, onSelect }: { title: string; items: ReportSlice[]; tone: 'income' | 'expense'; onSelect: (category: string) => void }) {
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  let cursor = 0
  const gradient = items.length ? items.map((item, index) => { const start = cursor; cursor += total ? Number(item.amount) / total * 100 : 0; return `${reportColors[index % reportColors.length]} ${start}% ${cursor}%` }).join(', ') : 'var(--ft-surface-soft) 0 100%'
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>{title}</h2><p>Transfer antar-dompet tidak dihitung.</p></div><strong className={tone === 'income' ? 'ft-positive' : 'ft-negative'}>{formatRupiah(total)}</strong></div>{items.length === 0 ? <div className="ft-empty ft-report-empty"><div><ChartDonut size={32} /><p>Belum ada data pada periode ini.</p></div></div> : <div className="ft-report-content"><div className="ft-donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`${title} berdasarkan kategori`}><div><strong>{items.length}</strong><span>kategori</span></div></div><div className="ft-report-ranking">{items.map((item, index) => { const percentage = total ? Math.round(Number(item.amount) / total * 100) : 0; const value = item.category_id || '__none__'; return <button type="button" className="ft-rank ft-rank-button" key={value} onClick={() => onSelect(value)}><span><i style={{ background: reportColors[index % reportColors.length] }} /><span>{item.name}</span><strong>{percentage}%</strong></span><small>{formatRupiah(item.amount)}</small><span className="ft-rank-track"><i style={{ width: `${percentage}%`, background: reportColors[index % reportColors.length] }} /></span></button> })}</div></div>}</article>
}

function ComparisonChart({ report }: { report: FintrackReport }) {
  const currentIncome = report.income.reduce((sum, item) => sum + item.amount, 0), currentExpense = report.expense.reduce((sum, item) => sum + item.amount, 0)
  const max = Math.max(currentIncome, currentExpense, report.previous.income, report.previous.expense, 1)
  const rows = [{ label: 'Pemasukan', current: currentIncome, previous: report.previous.income, tone: 'income' }, { label: 'Pengeluaran', current: currentExpense, previous: report.previous.expense, tone: 'expense' }]
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>Bulan ini vs sebelumnya</h2><p>{labelMonth(report.previous.month)} sebagai pembanding.</p></div></div><div className="ft-comparison-chart">{rows.map((row) => <div className="ft-comparison-row" key={row.label}><strong>{row.label}</strong><div><span>Saat ini</span><i><b className={row.tone} style={{ width: `${row.current / max * 100}%` }} /></i><small>{formatRupiah(row.current)}</small></div><div><span>Sebelumnya</span><i><b className="previous" style={{ width: `${row.previous / max * 100}%` }} /></i><small>{formatRupiah(row.previous)}</small></div></div>)}</div></article>
}

function TrendChart({ report, mode, pendingMode, loading, onModeChange }: { report: FintrackReport; mode: TrendMode; pendingMode: TrendMode; loading: boolean; onModeChange: (mode: TrendMode) => void }) {
  const points = trendPoints(report, mode), max = Math.max(...points.flatMap((point) => [point.income, point.expense]), 1)
  const line = (key: 'income' | 'expense') => points.map((point, index) => `${points.length === 1 ? 50 : index / (points.length - 1) * 100},${94 - point[key] / max * 84}`).join(' ')
  const pending = pendingMode !== mode
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>Tren {mode === 'monthly' ? 'bulanan' : mode === 'weekly' ? 'mingguan' : 'harian'}</h2><p>Pergerakan pemasukan dan pengeluaran.</p></div><InlineSpinner active={pending || loading} label={loading ? 'Memuat detail tren' : 'Menerapkan pilihan tren'} /></div><div className="ft-trend-tabs" role="tablist" aria-label="Rentang tren">{([['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={pendingMode === value} data-active={pendingMode === value} data-pending={pending && pendingMode === value} onClick={() => onModeChange(value)}>{label}</button>)}</div>{points.length === 0 ? <div className="ft-empty ft-report-empty"><div><p>Belum ada tren pada periode ini.</p></div></div> : <div data-updating={loading}><div className="ft-line-legend"><span><i className="income" />Pemasukan</span><span><i className="expense" />Pengeluaran</span></div><svg className="ft-line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Grafik tren ${mode} pemasukan dan pengeluaran`}><line x1="0" y1="94" x2="100" y2="94" /><line x1="0" y1="52" x2="100" y2="52" /><line x1="0" y1="10" x2="100" y2="10" /><polyline className="income" points={line('income')} /><polyline className="expense" points={line('expense')} /></svg><div className="ft-line-axis"><span>{points[0].label}</span><span>{points.at(-1)!.label}</span></div></div>}</article>
}

function TransactionRows({ transactions, accountMap, categoryMap, emptyLabel }: { transactions: Transaction[]; accountMap: Map<string, string>; categoryMap: Map<string, string>; emptyLabel: string }) {
  return <div className="ft-transaction-list">{transactions.length === 0 ? <div className="ft-empty"><div><Receipt size={34} /><p>{emptyLabel}</p></div></div> : transactions.map((transaction) => { const Icon = transaction.type === 'income' ? ArrowDown : transaction.type === 'expense' ? ArrowUp : ArrowsLeftRight; const accountId = transaction.type === 'income' ? transaction.to_account_id : transaction.from_account_id; const meta = [transaction.category_id ? categoryMap.get(transaction.category_id) : null, accountId ? accountMap.get(accountId) : null, new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${transaction.transaction_date}T00:00:00`))].filter(Boolean).join(', '); return <div className="ft-transaction-row" key={transaction.id}><span className={`ft-transaction-icon ${transaction.type}`}><Icon size={17} weight="bold" /></span><span className="ft-transaction-copy"><strong>{transaction.note || (transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'expense' ? 'Pengeluaran' : 'Transfer')}</strong><span>{meta}</span></span><span className={`ft-transaction-amount ${transaction.type === 'income' ? 'ft-positive' : transaction.type === 'expense' ? 'ft-negative' : ''}`}>{transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}{formatRupiah(transaction.amount)}</span></div> })}</div>
}

export default function ActivityPage() {
  const { data, user, accounts, categories, transactions, loading, beginTask, endTask, isBusy } = useFintrack()
  const [view, setView] = useState<'transactions' | 'report'>('transactions'), [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [report, setReport] = useState<FintrackReport | null>(null), [selectedCategory, setSelectedCategory] = useState('__all__')
  const [pendingCategory, setPendingCategory] = useState('__all__')
  const [trendMode, setTrendMode] = useState<TrendMode>('monthly'), [pendingTrendMode, setPendingTrendMode] = useState<TrendMode>('monthly')
  const [pendingMonth, setPendingMonth] = useState<string | null>(null)
  const reportCache = useRef(new Map<string, FintrackReport>()), touchStart = useRef<number | null>(null)
  const debounceTimers = useRef<{ month: number | null; category: number | null; trend: number | null }>({ month: null, category: null, trend: null })
  useEffect(() => () => { Object.values(debounceTimers.current).forEach((timer) => { if (timer) window.clearTimeout(timer) }) }, [])
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts]), categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 150 }} /><div className="ft-skeleton-line" style={{ height: 310, marginTop: 28 }} /></div>
  if (!user || !data) return null
  const currentReport = data.report
  const activeReport = report || currentReport
  const visibleTransactions = filter === 'all' ? transactions : transactions.filter((transaction) => transaction.type === filter)
  const emptyLabel = filter === 'income' ? 'Belum ada pemasukan.' : filter === 'expense' ? 'Belum ada pengeluaran.' : 'Belum ada transaksi.'
  const reportCategories = [...activeReport.expense, ...activeReport.income].filter((item, index, array) => array.findIndex((other) => (other.category_id || '__none__') === (item.category_id || '__none__')) === index)
  const selectedSlice = reportCategories.find((item) => (item.category_id || '__none__') === selectedCategory)
  const reportTransactions = activeReport.transactions.filter((transaction) => transaction.type !== 'transfer' && (selectedCategory === '__all__' || (selectedCategory === '__none__' ? !transaction.category_id : Boolean(transaction.category_id && selectedSlice?.category_ids.includes(transaction.category_id)))))
  const displayedMonth = pendingMonth || activeReport.month

  async function applyMonth(nextMonth: string) {
    beginTask('report-month', 'Memuat laporan')
    try {
      const cached = reportCache.current.get(nextMonth)
      if (cached) setReport(cached)
      else if (nextMonth === currentReport.month) setReport(currentReport)
      else {
        const response = await fintrackRequest(`/api/fintrack/reports?month=${nextMonth}&details=0`)
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Laporan gagal dimuat')
        reportCache.current.set(nextMonth, body.data)
        setReport(body.data)
      }
      setSelectedCategory('__all__')
      setPendingCategory('__all__')
      setTrendMode('monthly')
      setPendingTrendMode('monthly')
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Laporan gagal dimuat') } finally { setPendingMonth(null); endTask('report-month') }
  }
  function selectMonth(nextMonth: string) {
    if (nextMonth > currentReport.month) return
    setPendingMonth(nextMonth)
    setPendingCategory('__all__')
    setPendingTrendMode('monthly')
    if (debounceTimers.current.month) window.clearTimeout(debounceTimers.current.month)
    if (debounceTimers.current.category) window.clearTimeout(debounceTimers.current.category)
    if (debounceTimers.current.trend) window.clearTimeout(debounceTimers.current.trend)
    debounceTimers.current.month = window.setTimeout(() => { void applyMonth(nextMonth) }, 3000)
  }
  function selectCategory(value: string) {
    setPendingCategory(value)
    if (debounceTimers.current.category) window.clearTimeout(debounceTimers.current.category)
    debounceTimers.current.category = window.setTimeout(() => {
      setSelectedCategory(value)
      window.setTimeout(() => document.getElementById('report-transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    }, 3000)
  }
  async function applyTrendMode(nextMode: TrendMode) {
    if (nextMode === 'monthly' || activeReport.trend_detail_loaded) return setTrendMode(nextMode)
    beginTask('trend-detail', 'Memuat detail tren')
    try {
      const cached = reportCache.current.get(activeReport.month)
      let detailed = cached?.trend_detail_loaded ? cached : null
      if (!detailed) {
        const response = await fintrackRequest(`/api/fintrack/reports?month=${activeReport.month}&details=1`)
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Detail tren gagal dimuat')
        detailed = body.data as FintrackReport
        reportCache.current.set(activeReport.month, detailed)
      }
      setReport(detailed)
      setTrendMode(nextMode)
    } catch (error) {
      setPendingTrendMode(trendMode)
      window.alert(error instanceof Error ? error.message : 'Detail tren gagal dimuat')
    } finally { endTask('trend-detail') }
  }
  function selectTrendMode(nextMode: TrendMode) {
    setPendingTrendMode(nextMode)
    if (debounceTimers.current.trend) window.clearTimeout(debounceTimers.current.trend)
    debounceTimers.current.trend = window.setTimeout(() => { void applyTrendMode(nextMode) }, 3000)
  }

  const periodPending = Boolean(pendingMonth) || isBusy('report-month')

  return <main className="ft-container"><Header user={user} eyebrow={labelMonth(data.report.month)} title="Aktivitas" /><div className="ft-page-tabs" role="tablist" aria-label="Tampilan aktivitas"><button role="tab" aria-selected={view === 'transactions'} data-active={view === 'transactions'} onClick={() => setView('transactions')}>Transaksi</button><button role="tab" aria-selected={view === 'report'} data-active={view === 'report'} onClick={() => setView('report')}>Laporan<InlineSpinner active={periodPending} label="Menerapkan periode laporan" className="ft-tab-spinner" /></button></div>
    {view === 'transactions' ? <section className="ft-tab-panel"><div className="ft-sub-tabs" role="tablist" aria-label="Filter transaksi"><button role="tab" aria-selected={filter === 'all'} data-active={filter === 'all'} onClick={() => setFilter('all')}>Semua</button><button role="tab" aria-selected={filter === 'income'} data-active={filter === 'income'} onClick={() => setFilter('income')}>Pemasukan</button><button role="tab" aria-selected={filter === 'expense'} data-active={filter === 'expense'} onClick={() => setFilter('expense')}>Pengeluaran</button></div><div className="ft-card ft-transactions"><TransactionRows transactions={visibleTransactions} accountMap={accountMap} categoryMap={categoryMap} emptyLabel={emptyLabel} /></div></section> : <section className="ft-tab-panel ft-report-list">
      <div className="ft-month-switcher" data-pending={Boolean(pendingMonth)} onTouchStart={(event) => { if (!isBusy('report-month')) touchStart.current = event.touches[0].clientX }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 45) selectMonth(moveMonth(displayedMonth, delta > 0 ? -1 : 1)); touchStart.current = null }}><button type="button" disabled={isBusy('report-month')} onClick={() => selectMonth(moveMonth(displayedMonth, -1))} aria-label="Bulan sebelumnya"><CaretLeft size={18} /></button><div><span>Periode laporan</span><strong>{labelMonth(displayedMonth)}</strong><small>{`${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${activeReport.period_start}T00:00:00`))}-${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${activeReport.period_end}T00:00:00`))}`}</small></div><button type="button" disabled={isBusy('report-month') || displayedMonth >= data.report.month} onClick={() => selectMonth(moveMonth(displayedMonth, 1))} aria-label="Bulan berikutnya"><CaretRight size={18} /></button></div>
      <div className="ft-report-filter" data-pending={pendingCategory !== selectedCategory}><div className="ft-report-filter-heading"><label htmlFor="report-category">Filter kategori</label><InlineSpinner active={pendingCategory !== selectedCategory} label="Menerapkan filter kategori" /></div><select id="report-category" className="ft-input" value={pendingCategory} onChange={(event) => selectCategory(event.target.value)}><option value="__all__">Semua kategori</option>{reportCategories.map((category) => <option key={category.category_id || '__none__'} value={category.category_id || '__none__'}>{category.name}</option>)}</select></div>
      <ComparisonChart report={activeReport} /><TrendChart report={activeReport} mode={trendMode} pendingMode={pendingTrendMode} loading={isBusy('trend-detail')} onModeChange={selectTrendMode} /><ReportChart title="Pengeluaran" items={activeReport.expense} tone="expense" onSelect={selectCategory} /><ReportChart title="Pemasukan" items={activeReport.income} tone="income" onSelect={selectCategory} />
      <article className="ft-report-card" id="report-transactions"><div className="ft-report-heading"><div><h2>Transaksi periode ini</h2><p>{selectedCategory === '__all__' ? 'Pemasukan dan pengeluaran, tanpa transfer.' : `Kategori: ${selectedCategory === '__none__' ? 'Tanpa kategori' : categoryMap.get(selectedCategory) || 'Kategori'}`}</p></div><strong>{reportTransactions.length}</strong></div><div className="ft-transactions ft-report-transactions"><TransactionRows transactions={reportTransactions} accountMap={accountMap} categoryMap={categoryMap} emptyLabel="Belum ada transaksi untuk filter ini." /></div></article>
    </section>}<BottomNav /></main>
}
