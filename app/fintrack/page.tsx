'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ArrowClockwise, ArrowDown, ArrowUp, ArrowsLeftRight, CaretLeft, CaretRight, EyeSlash, PencilSimple, Receipt, Trash } from '@phosphor-icons/react'
import { Header } from './components/header'
import { BottomNav } from './components/bottom-nav'
import { AccountCard, formatRupiah } from './components/account-card'
import { useFintrack } from './components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'
import type { Transaction } from '@/types/fintrack'

export default function FintrackHome() {
  const { data, user, accounts, categories, transactions, loading, error, beginTask, endTask, isBusy, refreshData, openComposer, applyTransactionChange } = useFintrack()
  const accountsRef = useRef<HTMLDivElement>(null)

  function scrollAccounts(direction: -1 | 1) {
    const container = accountsRef.current
    if (!container) return
    container.scrollBy({ left: direction * Math.max(180, container.clientWidth * .72), behavior: 'smooth' })
  }

  async function voidTransaction(id: string) {
    if (!window.confirm('Batalkan transaksi ini dan kembalikan perubahan saldonya?')) return
    const pin = data?.has_pin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (data?.has_pin && !pin) return
    beginTask('transaction-void', 'Membatalkan transaksi')
    try {
      const response = await fintrackRequest(`/api/fintrack/transactions/${id}`, { method: 'DELETE', headers: pin ? { 'x-fintrack-pin': pin } : {} })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Transaksi tidak dapat dibatalkan')
      applyTransactionChange(body.data as Transaction, null)
    } catch (requestError) {
      window.alert(requestError instanceof Error ? requestError.message : 'Transaksi tidak dapat dibatalkan')
    } finally {
      endTask('transaction-void')
    }
  }

  async function refreshLatest() {
    beginTask('transactions-refresh', 'Memuat transaksi terbaru')
    try { await refreshData() } finally { endTask('transactions-refresh') }
  }

  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 142 }} /><div className="ft-skeleton-line" style={{ height: 210, marginTop: 28 }} /><div className="ft-skeleton-line" style={{ height: 112, marginTop: 16 }} /></div>
  if (!user || !data) return null
  const accountMap = new Map(accounts.map((account) => [account.id, account]))
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  return (
    <main className="ft-container">
      <Header user={user} />
      {error && <p className="ft-inline-message ft-error">{error}</p>}
      <section className="ft-hero" aria-label="Ringkasan keuangan">
        <div className="ft-balance-panel"><div><p className="ft-eyebrow">Total aset</p><h1 className="ft-balance">{formatRupiah(data.summary.assets)}</h1></div><div className="ft-balance-meta"><div><span>Setelah utang</span><strong>{formatRupiah(data.summary.net_worth)}</strong></div><div><span>Total utang</span><strong>{formatRupiah(data.summary.liabilities)}</strong></div></div></div>
      </section>

      <section className="ft-section">
        <div className="ft-section-heading"><div><h2>Dompet</h2><p>Ringkasan saldo aktif</p></div><div className="ft-wallet-heading-actions">{accounts.length > 2 && <div className="ft-wallet-arrows" aria-label="Geser daftar dompet"><button type="button" onClick={() => scrollAccounts(-1)} aria-label="Dompet sebelumnya"><CaretLeft size={16} /></button><button type="button" onClick={() => scrollAccounts(1)} aria-label="Dompet berikutnya"><CaretRight size={16} /></button></div>}<Link href="/fintrack/manage" className="ft-text-link">Kelola</Link></div></div>
        <div ref={accountsRef} className="ft-accounts" data-scrollable={accounts.length > 2}>{accounts.map((account) => <div className="ft-account-wrap" key={account.id}><AccountCard account={account} />{account.include_in_net_worth === false && <span className="ft-account-excluded" title="Tidak dihitung dalam total aset"><EyeSlash size={14} /></span>}</div>)}</div>
      </section>

      <section className="ft-section ft-workspace" id="transactions">
        <div className="ft-section-heading"><div><h2>Transaksi terbaru</h2></div><div className="ft-latest-actions"><button className="ft-icon-button" type="button" title="Muat transaksi terbaru" aria-label="Muat transaksi terbaru" disabled={isBusy('transactions-refresh')} onClick={refreshLatest}><ArrowClockwise size={16} /></button><Link href="/fintrack/activity" className="ft-text-link">Lihat semua</Link></div></div>
        <div className="ft-card ft-transactions" data-updating={isBusy('transactions-refresh')}>
          <div className="ft-transaction-list">
            {transactions.length === 0 ? <div className="ft-empty"><div><Receipt size={34} /><div>Belum ada transaksi.<br />Catat transaksi pertama Anda.</div></div></div> : transactions.slice(0, 5).map((transaction) => {
              const Icon = transaction.type === 'income' ? ArrowDown : transaction.type === 'expense' ? ArrowUp : ArrowsLeftRight
              const accountId = transaction.type === 'income' ? transaction.to_account_id : transaction.from_account_id
              const meta = [transaction.category_id ? categoryMap.get(transaction.category_id) : null, accountId ? accountMap.get(accountId)?.name : null, new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${transaction.transaction_date}T00:00:00`))].filter(Boolean).join(', ')
              return <div className="ft-transaction-row" key={transaction.id}><div className={`ft-transaction-icon ${transaction.type}`}><Icon size={17} weight="bold" /></div><div className="ft-transaction-copy"><strong>{transaction.note || (transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'expense' ? 'Pengeluaran' : 'Transfer')}</strong><span>{meta}</span></div><div className={`ft-transaction-amount ${transaction.type === 'income' ? 'ft-positive' : transaction.type === 'expense' ? 'ft-negative' : ''}`}>{transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}{formatRupiah(transaction.amount)}</div><div className="ft-row" style={{ gap: 6 }}><button className="ft-icon-button" title="Edit transaksi" onClick={() => openComposer(transaction)}><PencilSimple size={16} /></button><button className="ft-icon-button" title="Batalkan transaksi" onClick={() => voidTransaction(transaction.id)}><Trash size={16} /></button></div></div>
            })}
          </div>
        </div>
      </section>
      <BottomNav />
    </main>
  )
}
