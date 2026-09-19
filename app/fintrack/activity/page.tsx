'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowsLeftRight, ChartDonut, Receipt } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import type { ReportSlice } from '@/types/fintrack'

const reportColors = ['var(--ft-report-1)', 'var(--ft-report-2)', 'var(--ft-report-3)', 'var(--ft-report-4)', 'var(--ft-report-5)', 'var(--ft-report-6)']

function ReportChart({ title, items, tone }: { title: string; items: ReportSlice[]; tone: 'income' | 'expense' }) {
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0)
  let cursor = 0
  const gradient = items.length ? items.map((item, index) => {
    const start = cursor
    cursor += total ? Number(item.amount) / total * 100 : 0
    return `${reportColors[index % reportColors.length]} ${start}% ${cursor}%`
  }).join(', ') : 'var(--ft-surface-soft) 0 100%'
  return (
    <article className="ft-report-card">
      <div className="ft-report-heading"><div><h2>{title}</h2><p>Transfer antar-dompet tidak dihitung.</p></div><strong className={tone === 'income' ? 'ft-positive' : 'ft-negative'}>{formatRupiah(total)}</strong></div>
      {items.length === 0 ? <div className="ft-empty ft-report-empty"><div><ChartDonut size={32} /><p>Belum ada data pada periode ini.</p></div></div> : <div className="ft-report-content"><div className="ft-donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`${title} berdasarkan kategori`}><div><strong>{items.length}</strong><span>kategori</span></div></div><div className="ft-report-ranking">{items.map((item, index) => { const percentage = total ? Math.round(Number(item.amount) / total * 100) : 0; return <div className="ft-rank" key={item.category_id || item.name}><div><i style={{ background: reportColors[index % reportColors.length] }} /><span>{item.name}</span><strong>{percentage}%</strong></div><small>{formatRupiah(item.amount)}</small><span className="ft-rank-track"><i style={{ width: `${percentage}%`, background: reportColors[index % reportColors.length] }} /></span></div> })}</div></div>}
    </article>
  )
}

export default function ActivityPage() {
  const { data, user, accounts, categories, transactions, loading } = useFintrack()
  const [view, setView] = useState<'transactions' | 'report'>('transactions')
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account.name])), [accounts])
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 150 }} /><div className="ft-skeleton-line" style={{ height: 310, marginTop: 28 }} /></div>
  if (!user || !data) return null
  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${data.report.month}-01T00:00:00`))
  const visibleTransactions = filter === 'income' || filter === 'expense' ? transactions.filter((transaction) => transaction.type === filter) : transactions
  const emptyLabel = filter === 'income' ? 'Belum ada pemasukan.' : filter === 'expense' ? 'Belum ada pengeluaran.' : 'Belum ada transaksi.'

  return (
    <main className="ft-container">
      <Header user={user} eyebrow={monthLabel} title="Aktivitas" />
      <div className="ft-page-tabs" role="tablist" aria-label="Tampilan aktivitas"><button role="tab" aria-selected={view === 'transactions'} data-active={view === 'transactions'} onClick={() => setView('transactions')}>Transaksi</button><button role="tab" aria-selected={view === 'report'} data-active={view === 'report'} onClick={() => setView('report')}>Laporan</button></div>
      {view === 'transactions' ? <section className="ft-tab-panel"><div className="ft-sub-tabs" role="tablist" aria-label="Filter transaksi"><button role="tab" aria-selected={filter === 'all'} data-active={filter === 'all'} onClick={() => setFilter('all')}>Semua</button><button role="tab" aria-selected={filter === 'income'} data-active={filter === 'income'} onClick={() => setFilter('income')}>Pemasukan</button><button role="tab" aria-selected={filter === 'expense'} data-active={filter === 'expense'} onClick={() => setFilter('expense')}>Pengeluaran</button></div><div className="ft-card ft-transactions"><div className="ft-transaction-list">{visibleTransactions.length === 0 ? <div className="ft-empty"><div><Receipt size={34} /><p>{emptyLabel}</p></div></div> : visibleTransactions.map((transaction) => { const Icon = transaction.type === 'income' ? ArrowDown : transaction.type === 'expense' ? ArrowUp : ArrowsLeftRight; const accountId = transaction.type === 'income' ? transaction.to_account_id : transaction.from_account_id; const meta = [transaction.category_id ? categoryMap.get(transaction.category_id) : null, accountId ? accountMap.get(accountId) : null, new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${transaction.transaction_date}T00:00:00`))].filter(Boolean).join(', '); return <button className="ft-transaction-row ft-transaction-button" key={transaction.id}><span className={`ft-transaction-icon ${transaction.type}`}><Icon size={17} weight="bold" /></span><span className="ft-transaction-copy"><strong>{transaction.note || (transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'expense' ? 'Pengeluaran' : 'Transfer')}</strong><span>{meta}</span></span><span className={`ft-transaction-amount ${transaction.type === 'income' ? 'ft-positive' : transaction.type === 'expense' ? 'ft-negative' : ''}`}>{transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}{formatRupiah(transaction.amount)}</span></button> })}</div></div></section> : <section className="ft-tab-panel ft-report-list"><ReportChart title="Pengeluaran" items={data.report.expense} tone="expense" /><ReportChart title="Pemasukan" items={data.report.income} tone="income" /></section>}
      <BottomNav />
    </main>
  )
}
