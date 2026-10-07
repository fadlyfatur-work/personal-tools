'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowsLeftRight, CaretLeft, CaretRight, ChartDonut, CircleNotch, Funnel, MagnifyingGlass, Receipt } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'
import { useQuery } from '@tanstack/react-query'
import type { Category, FintrackReport, ReportSlice, Transaction } from '@/types/fintrack'

const reportColors = ['var(--ft-report-1)', 'var(--ft-report-2)', 'var(--ft-report-3)', 'var(--ft-report-4)', 'var(--ft-report-5)', 'var(--ft-report-6)']
type TrendMode = 'weekly' | 'monthly'
type TrendPoint = { key: string; label: string; income: number; expense: number }
const labelMonth = (month: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))
function moveMonth(month: string, delta: number) { const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); return date.toISOString().slice(0, 7) }

function InlineSpinner({ active, label, className = '' }: { active: boolean; label: string; className?: string }) {
  return <span className={`ft-inline-spinner ${className}`} data-active={active} role="status" aria-live="polite"><CircleNotch size={14} weight="bold" aria-hidden="true" /><span className="ft-sr-only">{active ? label : ''}</span></span>
}

function trendPoints(report: FintrackReport, mode: TrendMode): TrendPoint[] {
  if (mode === 'monthly') return report.monthly
  return report.weekly
}

function ReportChart({ title, items, tone }: { title: string; items: ReportSlice[]; tone: 'income' | 'expense' }) {
  const [legendPage, setLegendPage] = useState(0)
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(legendPage, pageCount - 1)
  const visibleItems = items.slice(safePage * pageSize, safePage * pageSize + pageSize)
  let cursor = 0
  const gradient = items.length ? items.map((item, index) => { const start = cursor; cursor += total ? Number(item.amount) / total * 100 : 0; return `${reportColors[index % reportColors.length]} ${start}% ${cursor}%` }).join(', ') : 'var(--ft-surface-soft) 0 100%'
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>{title}</h2><p>Transfer antar-dompet tidak dihitung.</p></div><strong className={tone === 'income' ? 'ft-positive' : 'ft-negative'}>{formatRupiah(total)}</strong></div>{items.length === 0 ? <div className="ft-empty ft-report-empty"><div><ChartDonut size={32} /><p>Belum ada data pada periode ini. Pilih periode atau dompet lain, atau catat transaksi lewat tombol tambah.</p></div></div> : <div className="ft-report-content"><div className="ft-donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`${title} berdasarkan kategori`}><div><strong>{items.length}</strong><span>kategori</span></div></div><div className="ft-report-legend-column"><div className="ft-report-ranking">{visibleItems.map((item, index) => { const actualIndex = safePage * pageSize + index; const percentage = total ? Math.round(Number(item.amount) / total * 100) : 0; const value = item.category_id || '__none__'; return <div className="ft-rank" key={value}><span><i style={{ background: reportColors[actualIndex % reportColors.length] }} /><span>{item.emoji ? `${item.emoji} ` : ''}{item.name}</span><strong>{percentage}%</strong></span><small>{formatRupiah(item.amount)}</small><span className="ft-rank-track"><i style={{ width: `${percentage}%`, background: reportColors[actualIndex % reportColors.length] }} /></span></div> })}</div>{pageCount > 1 && <nav className="ft-legend-pagination" aria-label={`Kategori ${title.toLowerCase()}`}><button type="button" disabled={safePage === 0} onClick={() => setLegendPage((page) => Math.max(0, page - 1))} aria-label="Kategori sebelumnya"><CaretLeft size={15} /></button><span>{safePage + 1}/{pageCount}</span><button type="button" disabled={safePage === pageCount - 1} onClick={() => setLegendPage((page) => Math.min(pageCount - 1, page + 1))} aria-label="Kategori berikutnya"><CaretRight size={15} /></button></nav>}</div></div>}</article>
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
  const rangeLabel = mode === 'monthly' ? '5 bulan terakhir' : 'Minggu dalam periode berjalan'
  const columnWidth = mode === 'weekly' ? 68 : 52
  const shouldScroll = points.length * columnWidth > 330
  const gridStyle = { gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(${columnWidth - 8}px, 1fr))`, minWidth: shouldScroll ? `${points.length * columnWidth}px` : '100%' }
  const axis = [1, .75, .5, .25, 0].map((ratio) => ({ ratio, label: new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(max * ratio) }))
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>Tren {mode === 'monthly' ? 'bulanan' : 'mingguan'}</h2><p>{rangeLabel}</p></div><InlineSpinner active={pending || loading} label={loading ? 'Memuat detail tren' : 'Menerapkan pilihan tren'} /></div><div className="ft-trend-tabs" role="tablist" aria-label="Rentang tren">{([['weekly', 'Mingguan'], ['monthly', 'Bulanan']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={pendingMode === value} data-active={pendingMode === value} data-pending={pending && pendingMode === value} onClick={() => onModeChange(value)}>{label}</button>)}</div><div data-updating={loading}>{points.length === 0 ? <div className="ft-empty ft-report-empty"><div><p>Belum ada transaksi pada rentang ini. Pilih rentang lain, atau catat transaksi lewat tombol tambah.</p></div></div> : <><div className="ft-line-legend"><span><i className="income" />Pemasukan</span><span><i className="expense" />Pengeluaran</span></div><div className="ft-trend-visual"><div className="ft-trend-y-axis" aria-hidden="true">{axis.map((tick) => <span key={tick.ratio}>Rp{tick.label}</span>)}</div><div className="ft-trend-scroll" data-scrollable={shouldScroll}><div className="ft-trend-bars" data-density={mode} style={gridStyle} role="img" aria-label={`Grafik batang tren ${mode} pemasukan dan pengeluaran`}>{points.map((point) => <div className="ft-trend-bar-group" key={point.key}><div><span className="income" tabIndex={0} data-tooltip={`Pemasukan ${formatRupiah(point.income)}`} style={{ height: `${Math.max(3, point.income / max * 100)}%` }} /><span className="expense" tabIndex={0} data-tooltip={`Pengeluaran ${formatRupiah(point.expense)}`} style={{ height: `${Math.max(3, point.expense / max * 100)}%` }} /></div><small>{point.label}</small></div>)}</div></div></div></>}</div></article>
}

function TransactionRows({ transactions, accountMap, categoryMap, emptyLabel, onEdit }: { transactions: Transaction[]; accountMap: Map<string, string>; categoryMap: Map<string, Category>; emptyLabel: string; onEdit: (transaction: Transaction) => void }) {
  return <div className="ft-transaction-list">{transactions.length === 0 ? <div className="ft-empty"><div><Receipt size={34} /><p>{emptyLabel} Ubah periode atau filter di atas. Untuk catatan baru, gunakan tombol tambah transaksi.</p></div></div> : transactions.map((transaction) => {
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
  const { data, user, accounts, categories, loading, openComposer } = useFintrack()
  const [view, setView] = useState<'transactions' | 'report'>('transactions')
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [month, setMonth] = useState('')
  const [account, setAccount] = useState('__all__')
  const [subcategory, setSubcategory] = useState('__all__')
  const [category, setCategory] = useState('__all__')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [trendMode, setTrendMode] = useState<TrendMode>('monthly')
  const touchStart = useRef<number | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearchTerm(search.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const selectedMonth = month || data?.report.month || ''
  const params = new URLSearchParams({ month: selectedMonth, details: view === 'report' ? '1' : '0', page: String(page), include_transfers: view === 'transactions' ? '1' : '0' })
  if (account !== '__all__') params.set('account_id', account)
  if (category !== '__all__' && category !== '__none__') params.set('parent_id', category)
  if (subcategory !== '__all__') params.set('category_id', subcategory)
  if (category === '__none__') params.set('category_id', category)
  if (view === 'transactions') {
    if (filter !== 'all') params.set('transaction_type', filter)
    if (searchTerm) params.set('q', searchTerm)
  }
  const queryString = params.toString()
  const reportQuery = useQuery<FintrackReport>({
    queryKey: ['fintrack', 'activity', user?.id, queryString],
    enabled: Boolean(user && data),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fintrackRequest(`/api/fintrack/reports?${queryString}`)
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Aktivitas belum bisa dimuat. Coba lagi.')
      return body.data
    },
  })
  const accountMap = useMemo(() => new Map(accounts.map(item => [item.id, item.name])), [accounts])
  const categoryMap = useMemo(() => new Map(categories.map(item => [item.id, item])), [categories])
  if (loading || !data || !user) return <p role="status">Memuat aktivitas…</p>
  const report = reportQuery.data
  const busy = reportQuery.isPending || (view === 'transactions' && search.trim() !== searchTerm)
  const categoryOptions = categories.filter(item => account === '__all__' || item.plan_id === accounts.find(wallet => wallet.id === account)?.plan_id)
  const activeFilters = Number(account !== '__all__') + Number(category !== '__all__') + Number(subcategory !== '__all__')
  const emptyLabel = accounts.length === 0 ? 'Belum ada dompet. Tambahkan dompet melalui Kelola.' : searchTerm ? `Tidak ada keterangan yang cocok dengan “${searchTerm}”.` : activeFilters || filter !== 'all' ? 'Tidak ada transaksi yang cocok dengan filter ini.' : 'Belum ada transaksi pada periode ini.'
  function selectMonth(value: string) {
    if (value > data!.report.month) return
    setMonth(value); setPage(1)
  }

  return <main className="ft-container">
    <Header user={user} eyebrow={labelMonth(data.report.month)} title="Aktivitas" />
    <section className="ft-month-expense" aria-label="Pengeluaran bulan ini">
      <div><span>Pengeluaran bulan ini</span><small>{labelMonth(data.report.month)} · {data.report.period_start} hingga {data.report.period_end}</small></div>
      <strong>{formatRupiah(data.summary.expense)}</strong>
    </section>
    <div className="ft-page-tabs" role="tablist" aria-label="Tampilan aktivitas">
      <button role="tab" aria-selected={view === 'transactions'} data-active={view === 'transactions'} onClick={() => { setView('transactions'); setPage(1) }}>Transaksi</button>
      <button role="tab" aria-selected={view === 'report'} data-active={view === 'report'} onClick={() => { setView('report'); setPage(1) }}>Laporan</button>
    </div>
    <div className="ft-activity-filters">
      <div className="ft-month-switcher" onTouchStart={event => { touchStart.current = event.touches[0].clientX }} onTouchEnd={event => {
        if (touchStart.current === null) return
        const delta = event.changedTouches[0].clientX - touchStart.current
        if (Math.abs(delta) > 45) selectMonth(moveMonth(selectedMonth, delta > 0 ? -1 : 1))
        touchStart.current = null
      }}>
        <button type="button" onClick={() => selectMonth(moveMonth(selectedMonth, -1))} aria-label="Bulan sebelumnya"><CaretLeft size={18} /></button>
        <div><span>Periode</span><strong>{labelMonth(selectedMonth)}</strong>{report && <small>{report.period_start} hingga {report.period_end}</small>}</div>
        <button type="button" disabled={selectedMonth >= data.report.month} onClick={() => selectMonth(moveMonth(selectedMonth, 1))} aria-label="Bulan berikutnya"><CaretRight size={18} /></button>
      </div>
      {view === 'transactions' ? <>
        <div className="ft-activity-toolbar">
          <label className="ft-activity-search"><MagnifyingGlass size={18} aria-hidden="true" /><span className="ft-sr-only">Cari keterangan transaksi</span><input type="search" placeholder="Cari keterangan transaksi" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
          <button type="button" className="ft-icon-button ft-filter-toggle" aria-label={`Filter dompet dan kategori${activeFilters ? `, ${activeFilters} aktif` : ''}`} aria-expanded={filtersOpen} aria-controls="activity-filters" onClick={() => setFiltersOpen(!filtersOpen)}><Funnel size={20} aria-hidden="true" />{activeFilters > 0 && <span>{activeFilters}</span>}</button>
        </div>
        <div id="activity-filters" className="ft-transaction-filter-grid" hidden={!filtersOpen}>
          <div className="ft-report-filter"><label htmlFor="transaction-account">Dompet</label><select id="transaction-account" className="ft-input" value={account} onChange={event => { setAccount(event.target.value); setCategory('__all__'); setSubcategory('__all__'); setPage(1) }}><option value="__all__">Semua dompet</option>{accounts.map(item => <option key={item.id} value={item.id}>{item.name}{item.access_role !== 'owner' ? ' (dibagikan)' : ''}</option>)}</select></div>
          <div className="ft-report-filter"><label htmlFor="transaction-category">Kategori</label><select id="transaction-category" className="ft-input" value={category} onChange={event => { setCategory(event.target.value); setSubcategory('__all__'); setPage(1) }}><option value="__all__">Semua kategori</option><option value="__none__">Tanpa kategori</option>{categoryOptions.filter(item => !item.parent_id).map(item => <option key={item.id} value={item.id}>{item.emoji ? `${item.emoji} ` : ''}{item.name}</option>)}</select></div>
        </div>
      </> : <div className="ft-report-filter"><label htmlFor="report-account">Dompet</label><select id="report-account" className="ft-input" value={account} onChange={event => { setAccount(event.target.value); setCategory('__all__'); setSubcategory('__all__'); setPage(1) }}><option value="__all__">Semua dompet</option>{accounts.map(item => <option key={item.id} value={item.id}>{item.name}{item.access_role !== 'owner' ? ' (dibagikan)' : ''}</option>)}</select></div>}
      {view === 'report' && <div className="ft-report-filter"><label htmlFor="report-category">Kategori induk</label><select id="report-category" className="ft-input" value={category} onChange={event => { setCategory(event.target.value); setSubcategory('__all__'); setPage(1) }}><option value="__all__">Semua kategori induk</option>{categoryOptions.filter(item => !item.parent_id).map(item => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select><small>Pilih induk untuk melihat rincian subkategori.</small></div>}
      {categoryOptions.some(item => item.parent_id === category) && (view === 'report' || filtersOpen) && <div className="ft-report-filter"><label htmlFor="activity-subcategory">Subkategori</label><select id="activity-subcategory" className="ft-input" value={subcategory} onChange={event => { setSubcategory(event.target.value); setPage(1) }}><option value="__all__">Semua subkategori</option>{categoryOptions.filter(item => item.parent_id === category).map(item => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></div>}
    </div>
    {reportQuery.error && <div className="ft-inline-message ft-error" role="alert"><p>{reportQuery.error.message}</p><button type="button" className="ft-button ft-button-secondary" onClick={() => void reportQuery.refetch()}>Coba lagi</button></div>}
    {view === 'transactions' && <div className="ft-sub-tabs" role="tablist" aria-label="Filter transaksi">{([['all', 'Semua'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran']] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} data-active={filter === value} onClick={() => { setFilter(value); setPage(1) }}>{label}</button>)}</div>}
    {busy ? <p className="ft-hint" role="status">Memuat aktivitas…</p> : report && (view === 'transactions' ? <section className="ft-tab-panel">
      <div className="ft-card ft-transactions"><TransactionRows transactions={report.transactions} accountMap={accountMap} categoryMap={categoryMap} emptyLabel={emptyLabel} onEdit={openComposer} /></div>
      <Pagination page={report.transaction_page} totalPages={Math.max(1, Math.ceil(report.transaction_total / report.transaction_page_size))} total={report.transaction_total} busy={busy} onPage={setPage} />
    </section> : <section className="ft-tab-panel ft-report-list"><ComparisonChart report={report} /><TrendChart report={report} mode={trendMode} pendingMode={trendMode} loading={false} onModeChange={setTrendMode} /><ReportChart title="Pengeluaran" items={report.expense} tone="expense" /><ReportChart title="Pemasukan" items={report.income} tone="income" /></section>)}
    <BottomNav />
  </main>
}
