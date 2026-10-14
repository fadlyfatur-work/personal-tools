'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowClockwise, ArrowDownLeft, ArrowUpRight, CaretLeft, CaretRight, EyeSlash, Receipt } from '@phosphor-icons/react'
import { Header } from './components/header'
import { BottomNav } from './components/bottom-nav'
import { AccountCard, formatRupiah } from './components/account-card'
import { useFintrack } from './components/fintrack-provider'
import { CategoryBudget } from './components/category-budget'
import { compareBudgetUsage } from '@/lib/fintrackOrdering'
import { TransactionList } from './components/transaction-list'
import { categoryBudget } from '@/lib/fintrackCategories'

const labelMonth = (month: string) => new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))

export default function FintrackHome() {
  const { data, user, accounts, categories, transactions, loading, error, beginTask, endTask, isBusy, refreshData, openComposer } = useFintrack()
  const accountsRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(5)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [homePanel, setHomePanel] = useState<'transactions' | 'budgets'>('transactions')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  useEffect(() => {
    const element = sentinelRef.current
    if (!element || homePanel !== 'transactions' || visibleCount >= 20) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setVisibleCount(count => Math.min(20, count + 5))
    }, { rootMargin: '80px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [homePanel, visibleCount, selectedAccountId, loading, transactions.length])

  function scrollAccounts(direction: -1 | 1) {
    const container = accountsRef.current
    if (!container) return
    container.scrollBy({ left: direction * Math.max(180, container.clientWidth * .72), behavior: 'smooth' })
  }

  async function refreshLatest() {
    beginTask('transactions-refresh', 'Memuat transaksi terbaru')
    try { await refreshData() } finally { endTask('transactions-refresh') }
  }

  function selectAccount(accountId: string) {
    setSelectedAccountId(accountId); setVisibleCount(5)
    setHomePanel('transactions')
    window.setTimeout(() => document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 142 }} /><div className="ft-skeleton-line" style={{ height: 210, marginTop: 28 }} /><div className="ft-skeleton-line" style={{ height: 112, marginTop: 16 }} /></div>
  if (!user || !data) return null
  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const homeAccounts = accounts.filter(account => !account.is_goal)
  const displayedAccounts = data.sort_accounts_by_balance ? [...homeAccounts].sort((a, b) => Number(b.current_balance) - Number(a.current_balance) || a.name.localeCompare(b.name)) : homeAccounts
  const recentTransactions = selectedAccountId ? transactions.filter((transaction) => transaction.from_account_id === selectedAccountId || transaction.to_account_id === selectedAccountId) : transactions
  const selectedAccount = selectedAccountId ? accountMap.get(selectedAccountId) : null
  const budgetWatchers = categories.filter((category) => category.plan_id === data.personal_plan_id && category.type === 'expense' && !category.parent_id && categoryBudget(category, categories) > 0).map((category) => {
    const used = data.report.expense.find((slice) => slice.category_id === category.id)?.amount || 0
    const budget = categoryBudget(category, categories)
    return { category, used, budget, percentage: Math.round(used / budget * 100) }
  }).filter(item => item.used > 0).sort(compareBudgetUsage)
  return (
    <main className="ft-container ft-home">
      <Header user={user} />
      {error && <p className="ft-inline-message ft-error">{error}</p>}
      <section className="ft-net-worth" aria-label="Ringkasan keuangan">
        <span>Aset bersih</span><h2>{formatRupiah(data.summary.net_worth)}</h2>
        <div className="ft-wealth-context"><span>Aset <strong>{formatRupiah(data.summary.assets)}</strong></span><span>Utang <strong>{formatRupiah(data.summary.liabilities)}</strong></span></div>
      </section>
      <section className="ft-flow-summary" aria-label="Arus kas periode ini"><div><span><ArrowDownLeft size={18} />Pemasukan</span><strong className="ft-positive">{formatRupiah(data.summary.income)}</strong></div><div><span><ArrowUpRight size={18} />Pengeluaran</span><strong>{formatRupiah(data.summary.expense)}</strong></div></section>
      <p className="ft-period-caption">Periode {data.report.period_start} hingga {data.report.period_end}</p>

      <section className="ft-section">
        <div className="ft-section-heading"><div><h2>Dompet</h2><p>Ringkasan saldo aktif</p></div><div className="ft-wallet-heading-actions">{displayedAccounts.length > 2 && <div className="ft-wallet-arrows" aria-label="Geser daftar dompet"><button type="button" onClick={() => scrollAccounts(-1)} aria-label="Dompet sebelumnya"><CaretLeft size={16} /></button><button type="button" onClick={() => scrollAccounts(1)} aria-label="Dompet berikutnya"><CaretRight size={16} /></button></div>}<Link href="/fintrack/manage" className="ft-text-link">Kelola</Link></div></div>
        <div ref={accountsRef} className="ft-accounts" data-scrollable={displayedAccounts.length > 2}>{displayedAccounts.map((account) => <div className="ft-account-wrap" key={account.id}><AccountCard account={account} selected={selectedAccountId === account.id} onClick={() => selectAccount(account.id)} />{account.include_in_net_worth === false && <span className="ft-account-excluded" title="Tidak dihitung dalam total aset"><EyeSlash size={14} /></span>}</div>)}</div>
      </section>

      <section className="ft-section ft-workspace" id="transactions">
        <div className="ft-home-tabs" role="tablist" aria-label="Ringkasan aktivitas"><button type="button" role="tab" aria-selected={homePanel === 'transactions'} data-active={homePanel === 'transactions'} onClick={() => setHomePanel('transactions')}>Transaksi terbaru</button><button type="button" role="tab" aria-selected={homePanel === 'budgets'} data-active={homePanel === 'budgets'} onClick={() => setHomePanel('budgets')}>Pantauan budget</button></div>
        {homePanel === 'transactions' ? <><div className="ft-section-heading"><div><h2>Transaksi terbaru</h2></div><button className="ft-icon-button ft-refresh-transactions" type="button" title="Muat ulang transaksi" aria-label="Muat ulang transaksi" disabled={isBusy('transactions-refresh')} onClick={refreshLatest}><ArrowClockwise size={20} /></button></div>{selectedAccount && <div className="ft-home-account-filter"><span>{selectedAccount.name}</span><button type="button" onClick={() => { setSelectedAccountId(null); setVisibleCount(5) }}>Semua dompet</button></div>}<div className="ft-card ft-transactions" data-updating={isBusy('transactions-refresh')}>
          <TransactionList showSubtotal={false} transactions={recentTransactions.slice(0, visibleCount)} accounts={accounts} categories={categories} onEdit={openComposer} emptyLabel={selectedAccount ? `Belum ada transaksi di ${selectedAccount.name}. Pilih dompet lain atau tampilkan semua dompet.` : undefined} />
          {visibleCount < Math.min(recentTransactions.length, 20) && <div ref={sentinelRef} className="ft-load-more"><button type="button" className="ft-button ft-button-secondary" onClick={() => setVisibleCount(count => Math.min(20, count + 5))}>Tampilkan 5 transaksi lagi</button></div>}
          <Link href="/fintrack/activity" className="ft-history-end">Lihat semua aktivitas<CaretRight size={16} aria-hidden="true" /></Link>
        </div></> : <><div className="ft-section-heading"><div><h2>Pantauan budget</h2><p>{labelMonth(data.report.month)}</p></div><Link href="/fintrack/manage" className="ft-text-link">Atur</Link></div>{budgetWatchers.length > 0 ? <div className="ft-budget-watchers">{budgetWatchers.map(({ category, used }) => <CategoryBudget month={data.report.month} key={category.id} category={category} used={used} categories={categories} totals={data.report.category_expense || data.report.expense} />)}</div> : <div className="ft-card ft-empty"><div><Receipt size={32} /><p>Belum ada pengeluaran pada kategori yang memiliki budget.</p><Link href="/fintrack/manage" className="ft-text-link">Atur budget</Link></div></div>}</>}
      </section>
      <BottomNav />
    </main>
  )
}
