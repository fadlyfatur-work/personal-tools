'use client'

import { TransactionList } from '../components/transaction-list'
import { ActivityCalendar } from '../components/activity-calendar'
import { ReportGraphic } from '../components/report-chart'
import { sortCategoryTree } from '@/lib/fintrackCategories'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { activityAccount } from '@/lib/fintrackUx'
import { CaretDown, CaretLeft, CaretRight, ChartDonut, CircleNotch, Funnel, MagnifyingGlass } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackActivityOptions } from '@/lib/fintrackClient'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { FintrackReport, ReportSlice } from '@/types/fintrack'

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

function ReportChart({ title, items, tone, onSelect }: { title: string; items: ReportSlice[]; tone: 'income' | 'expense'; onSelect: (id: string | null) => void }) {
  const [legendPage, setLegendPage] = useState(0)
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(legendPage, pageCount - 1)
  const visibleItems = items.slice(safePage * pageSize, safePage * pageSize + pageSize)
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>{title}</h2><p>Transfer antar-dompet tidak dihitung.</p></div><strong className={tone === 'income' ? 'ft-positive' : 'ft-negative'}>{formatRupiah(total)}</strong></div>{items.length === 0 ? <div className="ft-empty ft-report-empty"><div><ChartDonut size={32} /><p>Belum ada data pada periode ini. Pilih periode atau dompet lain, atau catat transaksi lewat tombol tambah.</p></div></div> : <div className="ft-report-content"><ReportGraphic kind="pie" label={`${title} berdasarkan kategori`} data={items.map(item => ({ name: item.name, amount: Number(item.amount) }))} onSelect={index => onSelect(items[index]?.category_id || null)} /><div className="ft-report-legend-column"><div className="ft-report-ranking">{visibleItems.map((item, index) => { const actualIndex = safePage * pageSize + index; const percentage = total ? Math.round(Number(item.amount) / total * 100) : 0; const value = item.category_id || '__none__'; return <button type="button" className="ft-rank" key={value} onClick={() => onSelect(item.category_id)}><span><i style={{ background: reportColors[actualIndex % reportColors.length] }} /><span>{item.emoji ? `${item.emoji} ` : ''}{item.name}</span><strong>{percentage}%</strong></span><small>{formatRupiah(item.amount)}</small><span className="ft-rank-track"><i style={{ width: `${percentage}%`, background: reportColors[actualIndex % reportColors.length] }} /></span></button> })}</div>{pageCount > 1 && <nav className="ft-legend-pagination" aria-label={`Kategori ${title.toLowerCase()}`}><button type="button" disabled={safePage === 0} onClick={() => setLegendPage((page) => Math.max(0, page - 1))} aria-label="Kategori sebelumnya"><CaretLeft size={15} /></button><span>{safePage + 1}/{pageCount}</span><button type="button" disabled={safePage === pageCount - 1} onClick={() => setLegendPage((page) => Math.min(pageCount - 1, page + 1))} aria-label="Kategori berikutnya"><CaretRight size={15} /></button></nav>}</div></div>}</article>
}

function ComparisonChart({ report }: { report: FintrackReport }) {
  const currentIncome = report.income.reduce((sum, item) => sum + item.amount, 0), currentExpense = report.expense.reduce((sum, item) => sum + item.amount, 0)
  const rows = [{ label: 'Pemasukan', current: currentIncome, previous: report.previous.income, tone: 'income' }, { label: 'Pengeluaran', current: currentExpense, previous: report.previous.expense, tone: 'expense' }]
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>Bulan ini vs sebelumnya</h2><p>{labelMonth(report.previous.month)} sebagai pembanding.</p></div></div><ReportGraphic kind="bar" label="Perbandingan bulanan" data={rows.map(row => ({ name: row.label, current: row.current, previous: row.previous }))} /></article>
}

function TrendChart({ report, mode, pendingMode, loading, onModeChange }: { report: FintrackReport; mode: TrendMode; pendingMode: TrendMode; loading: boolean; onModeChange: (mode: TrendMode) => void }) {
  const points = trendPoints(report, mode)
  const pending = pendingMode !== mode
  const rangeLabel = mode === 'monthly' ? '5 bulan terakhir' : 'Minggu dalam periode berjalan'
  return <article className="ft-report-card"><div className="ft-report-heading"><div><h2>Tren {mode === 'monthly' ? 'bulanan' : 'mingguan'}</h2><p>{rangeLabel}</p></div><InlineSpinner active={pending || loading} label={loading ? 'Memuat detail tren' : 'Menerapkan pilihan tren'} /></div><div className="ft-trend-tabs" role="tablist" aria-label="Rentang tren">{([['weekly', 'Mingguan'], ['monthly', 'Bulanan']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={pendingMode === value} data-active={pendingMode === value} data-pending={pending && pendingMode === value} onClick={() => onModeChange(value)}>{label}</button>)}</div><div data-updating={loading}>{points.length === 0 ? <div className="ft-empty ft-report-empty"><div><p>Belum ada transaksi pada rentang ini. Pilih rentang lain, atau catat transaksi lewat tombol tambah.</p></div></div> : <><ReportGraphic kind="area" label={`Tren ${mode === 'monthly' ? 'bulanan' : 'mingguan'}`} data={points.map(point => ({ name: point.label, income: point.income, expense: point.expense }))} /></>}</div></article>
}

function Pagination({ page, totalPages, total, busy, onPage }: { page: number; totalPages: number; total: number; busy: boolean; onPage: (page: number) => void }) {
  if (total <= 10) return null
  return <nav className="ft-pagination" aria-label="Halaman transaksi"><button type="button" disabled={busy || page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya"><CaretLeft size={16} /></button><span>Halaman <strong>{page}</strong> dari {totalPages}</span><button type="button" disabled={busy || page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya"><CaretRight size={16} /></button></nav>
}

export default function ActivityPage() {
  return <Suspense fallback={<p role="status">Memuat aktivitas…</p>}><ActivityFromLink /></Suspense>
}

function ActivityFromLink() {
  const params = useSearchParams()
  return <ActivityContent key={params.toString()} initialMonth={params.get('month') || ''} initialCategory={params.get('parent_id') || '__all__'} initialSubcategory={params.get('category_id') || '__all__'} initialAccount={activityAccount(params.get('account_id'))} />
}

function ActivityContent({ initialMonth, initialCategory, initialSubcategory, initialAccount }: { initialMonth: string; initialCategory: string; initialSubcategory: string; initialAccount: string }) {
  const { data, user, accounts, categories, loading, openComposer } = useFintrack()
  const [view, setView] = useState<'transactions' | 'report'>('transactions')
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [month, setMonth] = useState(/^\d{4}-(0[1-9]|1[0-2])$/.test(initialMonth) ? initialMonth : '')
  const [account, setAccount] = useState(initialAccount)
  const [selectedDate, setSelectedDate] = useState('')
  const [reportTone, setReportTone] = useState<'expense' | 'income'>('expense')
  const [subcategory, setSubcategory] = useState(initialSubcategory)
  const [category, setCategory] = useState(initialCategory)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(initialAccount !== '__all__' || initialCategory !== '__all__' || initialSubcategory !== '__all__')
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
    if (selectedDate) params.set('date', selectedDate)
    if (filter !== 'all') params.set('transaction_type', filter)
    if (searchTerm) params.set('q', searchTerm)
  }
  const queryString = params.toString()
  const reportQuery = useQuery({
    ...fintrackActivityOptions(user?.id, queryString),
    enabled: Boolean(user && data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
  if (loading || !data || !user) return <p role="status">Memuat aktivitas…</p>
  const report = reportQuery.data
  const busy = reportQuery.isPending || reportQuery.isPlaceholderData || (view === 'transactions' && search.trim() !== searchTerm)
  const categoryOptions = sortCategoryTree(categories.filter(item => account === '__all__' || item.plan_id === accounts.find(wallet => wallet.id === account)?.plan_id))
  const activeFilters = Number(account !== '__all__') + Number(category !== '__all__') + Number(subcategory !== '__all__')
  const emptyLabel = accounts.length === 0 ? 'Belum ada dompet. Tambahkan dompet melalui Kelola.' : searchTerm ? `Tidak ada keterangan yang cocok dengan “${searchTerm}”.` : activeFilters || filter !== 'all' ? 'Tidak ada transaksi yang cocok dengan filter ini.' : 'Belum ada transaksi pada periode ini.'
  function selectMonth(value: string) {
    if (value > data!.report.month) return
    setMonth(value); setSelectedDate(''); setPage(1)
  }

  return <main className="ft-container">
    <Header user={user} eyebrow={labelMonth(data.report.month)} title={view === 'report' ? 'Laporan' : 'Aktivitas'} />
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
        <label className="ft-period-select"><span className="ft-sr-only">Periode laporan</span><select value={selectedMonth} onChange={event => selectMonth(event.target.value)}>{Array.from({ length: 36 }, (_, index) => moveMonth(data.report.month, -index)).map(value => <option key={value} value={value}>{labelMonth(value)}</option>)}</select></label>
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
      </> : <div className="ft-report-controls"><button type="button" className="ft-button ft-button-secondary" aria-expanded={filtersOpen} aria-controls="report-filter-panel" onClick={() => setFiltersOpen(!filtersOpen)}><Funnel size={18} aria-hidden="true" /><span>Filter dompet & kategori{activeFilters > 0 && ` (${activeFilters})`}</span><CaretDown size={16} aria-hidden="true" /></button><div id="report-filter-panel" hidden={!filtersOpen} className="ft-report-filter"><label htmlFor="report-account">Dompet</label><select id="report-account" className="ft-input" value={account} onChange={event => { setAccount(event.target.value); setCategory('__all__'); setSubcategory('__all__'); setPage(1) }}><option value="__all__">Semua dompet</option>{accounts.map(item => <option key={item.id} value={item.id}>{item.name}{item.access_role !== 'owner' ? ' (dibagikan)' : ''}</option>)}</select></div></div>}
      {view === 'report' && filtersOpen && <div className="ft-report-filter"><label htmlFor="report-category">Kategori induk</label><select id="report-category" className="ft-input" value={category} onChange={event => { setCategory(event.target.value); setSubcategory('__all__'); setPage(1) }}><option value="__all__">Semua kategori induk</option>{categoryOptions.filter(item => !item.parent_id).map(item => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select><small>Pilih induk untuk melihat rincian subkategori.</small></div>}
      {categoryOptions.some(item => item.parent_id === category) && filtersOpen && <div className="ft-report-filter"><label htmlFor="activity-subcategory">Subkategori</label><select id="activity-subcategory" className="ft-input" value={subcategory} onChange={event => { setSubcategory(event.target.value); setPage(1) }}><option value="__all__">Semua subkategori</option><option value={category}>Langsung ke induk</option>{categoryOptions.filter(item => item.parent_id === category).map(item => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></div>}
    </div>
    {view === 'transactions' && report && <><section className="ft-flow-summary"><div><span>Pengeluaran periode</span><strong>{formatRupiah(report.expense.reduce((sum, item) => sum + item.amount, 0))}</strong></div><div><span>Pemasukan periode</span><strong className="ft-positive">{formatRupiah(report.income.reduce((sum, item) => sum + item.amount, 0))}</strong></div></section><ActivityCalendar key={`${report.period_start}-${report.period_end}`} start={report.period_start} end={report.period_end} days={report.calendar_days || []} selected={selectedDate} onSelect={day => { setSelectedDate(day); setPage(1) }} /></>}
    {reportQuery.error && <div className="ft-inline-message ft-error" role="alert"><p>{reportQuery.error.message}</p><button type="button" className="ft-button ft-button-secondary" onClick={() => void reportQuery.refetch()}>Coba lagi</button></div>}
    {view === 'transactions' && <div className="ft-sub-tabs" role="tablist" aria-label="Filter transaksi">{([['all', 'Semua'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran']] as const).map(([value, label]) => <button key={value} role="tab" aria-selected={filter === value} data-active={filter === value} onClick={() => { setFilter(value); setPage(1) }}>{label}</button>)}</div>}
    {busy ? <p className="ft-hint" role="status">Memuat aktivitas…</p> : report && (view === 'transactions' ? <section className="ft-tab-panel">
      <div className="ft-card ft-transactions"><TransactionList transactions={report.transactions} accounts={accounts} categories={categories} emptyLabel={emptyLabel} onEdit={openComposer} /></div>
      <Pagination page={report.transaction_page} totalPages={Math.max(1, Math.ceil(report.transaction_total / report.transaction_page_size))} total={report.transaction_total} busy={busy} onPage={setPage} />
    </section> : <section className="ft-tab-panel ft-report-list"><div className="ft-report-kind"><label htmlFor="report-kind">Tampilkan</label><select id="report-kind" className="ft-input" value={reportTone} onChange={event => setReportTone(event.target.value as 'expense' | 'income')}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></div>{category !== '__all__' && <button type="button" className="ft-text-link" onClick={() => { setCategory('__all__'); setSubcategory('__all__') }}>Semua kategori › {categories.find(item => item.id === category)?.name}</button>}<ReportChart title={reportTone === 'expense' ? 'Pengeluaran' : 'Pemasukan'} items={report[reportTone]} tone={reportTone} onSelect={id => { if (!id) { setCategory('__none__'); setSubcategory('__all__'); return } if (category === '__all__') setCategory(id); else if (id !== category) setSubcategory(id); setPage(1) }} /><TrendChart report={report} mode={trendMode} pendingMode={trendMode} loading={false} onModeChange={setTrendMode} /><ComparisonChart report={report} /></section>)}
    <BottomNav />
  </main>
}
