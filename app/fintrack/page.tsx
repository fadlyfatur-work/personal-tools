'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowClockwise, ArrowDown, ArrowUp, ArrowsLeftRight, CaretDown, CaretLeft, CaretRight, CaretUp, EyeSlash, Receipt } from '@phosphor-icons/react'
import { Header } from './components/header'
import { BottomNav } from './components/bottom-nav'
import { AccountCard, formatRupiah } from './components/account-card'
import { useFintrack } from './components/fintrack-provider'

const labelMonth = (month: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))

export default function FintrackHome() {
  const { data, user, accounts, categories, transactions, loading, error, beginTask, endTask, isBusy, refreshData, openComposer } = useFintrack()
  const accountsRef = useRef<HTMLDivElement>(null)
  const [cashFlowExpanded, setCashFlowExpanded] = useState(false)
  const [homePanel, setHomePanel] = useState<'transactions' | 'budgets'>('transactions')

  function scrollAccounts(direction: -1 | 1) {
    const container = accountsRef.current
    if (!container) return
    container.scrollBy({ left: direction * Math.max(180, container.clientWidth * .72), behavior: 'smooth' })
  }

  async function refreshLatest() {
    beginTask('transactions-refresh', 'Memuat transaksi terbaru')
    try { await refreshData() } finally { endTask('transactions-refresh') }
  }

  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 142 }} /><div className="ft-skeleton-line" style={{ height: 210, marginTop: 28 }} /><div className="ft-skeleton-line" style={{ height: 112, marginTop: 16 }} /></div>
  if (!user || !data) return null
  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const displayedAccounts = data.sort_accounts_by_balance ? [...accounts].sort((a, b) => Number(b.current_balance) - Number(a.current_balance) || a.name.localeCompare(b.name)) : accounts
  const maxFlow = Math.max(data.summary.income, data.summary.expense, 1)
  const budgetWatchers = categories.filter((category) => category.plan_id === data.personal_plan_id && category.type === 'expense' && Number(category.budget_amount || 0) > 0).map((category) => {
    const used = data.report.expense.find((slice) => slice.category_ids.includes(category.id))?.amount || 0
    const budget = Number(category.budget_amount)
    return { category, used, budget, percentage: Math.round(used / budget * 100) }
  }).sort((a, b) => b.percentage - a.percentage)
  return (
    <main className="ft-container">
      <Header user={user} />
      {error && <p className="ft-inline-message ft-error">{error}</p>}
      <section className="ft-hero" aria-label="Ringkasan keuangan">
        <div className="ft-balance-panel"><div><p className="ft-eyebrow">Total aset</p><h1 className="ft-balance">{formatRupiah(data.summary.assets)}</h1></div><div className="ft-debt-summary"><span>Total utang/kredit</span><strong>{formatRupiah(data.summary.liabilities)}</strong></div><button className="ft-cashflow-toggle" type="button" aria-expanded={cashFlowExpanded} onClick={() => setCashFlowExpanded((expanded) => !expanded)}><span><strong>Arus kas bersih</strong><small className={data.summary.income - data.summary.expense >= 0 ? 'ft-positive' : 'ft-negative'}>{formatRupiah(data.summary.income - data.summary.expense)}</small></span>{cashFlowExpanded ? <CaretUp size={17} /> : <CaretDown size={17} />}</button>{cashFlowExpanded ? <div className="ft-cashflow-expanded"><div className="ft-cashflow-columns"><span><i className="income" style={{ height: `${Math.max(4, data.summary.income / maxFlow * 100)}%` }} /></span><span><i className="expense" style={{ height: `${Math.max(4, data.summary.expense / maxFlow * 100)}%` }} /></span></div><div className="ft-cashflow-labels"><span>Pemasukan<strong>{formatRupiah(data.summary.income)}</strong></span><span>Pengeluaran<strong>{formatRupiah(data.summary.expense)}</strong></span></div></div> : <div className="ft-cashflow-balance" aria-label="Perbandingan pemasukan dan pengeluaran"><span><b>Pemasukan</b><i className="income" tabIndex={0} data-tooltip={`${formatRupiah(data.summary.income)} · ${data.summary.assets > 0 ? Math.round(data.summary.income / data.summary.assets * 100) : 0}% dari total aset`} style={{ width: `${data.summary.income / maxFlow * 100}%` }} /></span><span><b>Pengeluaran</b><i className="expense" tabIndex={0} data-tooltip={`${formatRupiah(data.summary.expense)} · ${data.summary.assets > 0 ? Math.round(data.summary.expense / data.summary.assets * 100) : 0}% dari total aset`} style={{ width: `${data.summary.expense / maxFlow * 100}%` }} /></span></div>}</div>
      </section>

      <section className="ft-section">
        <div className="ft-section-heading"><div><h2>Dompet</h2><p>Ringkasan saldo aktif</p></div><div className="ft-wallet-heading-actions">{displayedAccounts.length > 2 && <div className="ft-wallet-arrows" aria-label="Geser daftar dompet"><button type="button" onClick={() => scrollAccounts(-1)} aria-label="Dompet sebelumnya"><CaretLeft size={16} /></button><button type="button" onClick={() => scrollAccounts(1)} aria-label="Dompet berikutnya"><CaretRight size={16} /></button></div>}<Link href="/fintrack/manage" className="ft-text-link">Kelola</Link></div></div>
        <div ref={accountsRef} className="ft-accounts" data-scrollable={displayedAccounts.length > 2}>{displayedAccounts.map((account) => <div className="ft-account-wrap" key={account.id}><AccountCard account={account} />{account.include_in_net_worth === false && <span className="ft-account-excluded" title="Tidak dihitung dalam total aset"><EyeSlash size={14} /></span>}</div>)}</div>
      </section>

      <section className="ft-section ft-workspace" id="transactions">
        <div className="ft-home-tabs" role="tablist" aria-label="Ringkasan aktivitas"><button type="button" role="tab" aria-selected={homePanel === 'transactions'} data-active={homePanel === 'transactions'} onClick={() => setHomePanel('transactions')}>Transaksi terbaru</button><button type="button" role="tab" aria-selected={homePanel === 'budgets'} data-active={homePanel === 'budgets'} onClick={() => setHomePanel('budgets')}>Pantauan budget</button></div>
        {homePanel === 'transactions' ? <><div className="ft-section-heading"><div><h2>Transaksi terbaru</h2></div><div className="ft-latest-actions"><button className="ft-icon-button" type="button" title="Muat transaksi terbaru" aria-label="Muat transaksi terbaru" disabled={isBusy('transactions-refresh')} onClick={refreshLatest}><ArrowClockwise size={16} /></button><Link href="/fintrack/activity" className="ft-text-link">Lihat semua</Link></div></div><div className="ft-card ft-transactions" data-updating={isBusy('transactions-refresh')}>
          <div className="ft-transaction-list">
            {transactions.length === 0 ? <div className="ft-empty"><div><Receipt size={34} /><div>Belum ada transaksi.<br />Catat transaksi pertama Anda.</div></div></div> : transactions.slice(0, 5).map((transaction) => {
              const Icon = transaction.type === 'income' ? ArrowDown : transaction.type === 'expense' ? ArrowUp : ArrowsLeftRight
              const accountId = transaction.type === 'income' ? transaction.to_account_id : transaction.from_account_id
              const category = transaction.category_id ? categoryMap.get(transaction.category_id) : null
              const meta = [accountId ? accountMap.get(accountId)?.name : null, new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${transaction.transaction_date}T00:00:00`))].filter(Boolean).join(' • ')
              return <button type="button" className="ft-transaction-row ft-transaction-button" key={transaction.id} onClick={() => openComposer(transaction)} aria-label={`Edit ${category?.name || 'transaksi'} ${formatRupiah(transaction.amount)}`}><span className={`ft-transaction-icon ${transaction.type}`}>{category?.emoji || <Icon size={17} weight="bold" />}</span><span className="ft-transaction-copy"><span className="ft-transaction-category">{category?.name || (transaction.type === 'transfer' ? 'Transfer' : 'Tanpa kategori')}</span><strong>{transaction.note || (transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'expense' ? 'Pengeluaran' : 'Transfer antar-dompet')}</strong><span>{meta}</span></span><span className={`ft-transaction-amount ${transaction.type === 'income' ? 'ft-positive' : transaction.type === 'expense' ? 'ft-negative' : ''}`}>{transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}{formatRupiah(transaction.amount)}</span></button>
            })}
          </div>
        </div></> : <><div className="ft-section-heading"><div><h2>Pantauan budget</h2><p>{labelMonth(data.report.month)}</p></div><Link href="/fintrack/manage" className="ft-text-link">Atur</Link></div>{budgetWatchers.length > 0 ? <div className="ft-budget-watchers">{budgetWatchers.map(({ category, used, budget, percentage }) => <article key={category.id} data-over={percentage > 100}><div><span className="ft-category-emoji">{category.emoji || '🏷️'}</span><span><strong>{category.name}</strong><small>{formatRupiah(used)} dari {formatRupiah(budget)}</small></span><b>{percentage}%</b></div><i><span style={{ width: `${Math.min(percentage, 100)}%` }} /></i><p>{percentage > 100 ? `Lebih ${formatRupiah(used - budget)}` : `Sisa ${formatRupiah(Math.max(0, budget - used))}`}</p></article>)}</div> : <div className="ft-card ft-empty"><div><Receipt size={32} /><p>Belum ada budget kategori.</p><Link href="/fintrack/manage" className="ft-text-link">Atur budget</Link></div></div>}</>}
      </section>
      <BottomNav />
    </main>
  )
}
