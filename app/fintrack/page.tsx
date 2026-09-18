'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowsLeftRight, PencilSimple, Plus, Receipt, Trash } from '@phosphor-icons/react'
import { Header } from './components/header'
import { BottomNav } from './components/bottom-nav'
import { AccountCard, formatRupiah } from './components/account-card'
import TransactionForm from './components/transaction-form'
import type { Account, Transaction } from '@/types/fintrack'

interface User { name: string; email: string }
interface Category { id: string; plan_id: string; name: string; type: 'income' | 'expense' }

export default function FintrackHome() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [hasPin, setHasPin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const loadData = useCallback(async () => {
    const responses = await Promise.all([
      fetch('/api/fintrack/auth/me'),
      fetch('/api/fintrack/accounts'),
      fetch('/api/fintrack/transactions?limit=80'),
      fetch('/api/fintrack/categories'),
    ])
    if (responses[0].status === 401) {
      router.replace('/fintrack/login')
      return
    }
    if (responses.some((response) => !response.ok)) throw new Error('Sebagian data tidak dapat dimuat')
    const [me, accountData, transactionData, categoryData] = await Promise.all(responses.map((response) => response.json()))
    setUser(me.user)
    setHasPin(Boolean(me.has_pin))
    setAccounts(accountData.data || [])
    setTransactions(transactionData.data || [])
    setCategories(categoryData.data || [])
  }, [router])

  useEffect(() => {
    let active = true
    const task = window.setTimeout(() => {
      loadData()
        .catch(() => { if (active) setError('Data keuangan belum dapat dimuat. Periksa koneksi lalu coba lagi.') })
        .finally(() => { if (active) setLoading(false) })
    }, 0)
    return () => { active = false; window.clearTimeout(task) }
  }, [loadData])

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts])
  const summary = useMemo(() => {
    const owned = accounts.filter((account) => account.access_role === 'owner')
    const assets = owned.filter((account) => account.classification === 'asset').reduce((sum, account) => sum + Number(account.current_balance), 0)
    const liabilities = owned.filter((account) => account.classification === 'liability').reduce((sum, account) => sum + Number(account.current_balance), 0)
    const month = new Date().toISOString().slice(0, 7)
    const monthly = transactions.filter((transaction) => transaction.transaction_date.startsWith(month))
    const income = monthly.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    const expense = monthly.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount), 0)
    return { assets, liabilities, netWorth: assets - liabilities, income, expense }
  }, [accounts, transactions])

  async function voidTransaction(id: string) {
    if (!window.confirm('Batalkan transaksi ini dan kembalikan perubahan saldonya?')) return
    const pin = hasPin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (hasPin && !pin) return
    const response = await fetch(`/api/fintrack/transactions/${id}`, { method: 'DELETE', headers: pin ? { 'x-fintrack-pin': pin } : {} })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error || 'Transaksi tidak dapat dibatalkan')
      return
    }
    await loadData()
  }

  if (loading) {
    return <div className="ft-skeleton"><div className="ft-skeleton-line" style={{ width: 160 }} /><div className="ft-skeleton-line" style={{ height: 220, marginTop: 36 }} /><div className="ft-skeleton-line" style={{ height: 120, marginTop: 20 }} /></div>
  }
  if (!user) return null

  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date())

  return (
    <main className="ft-container">
      <Header user={user} />
      {error && <p className="ft-inline-message ft-error">{error}</p>}

      <section className="ft-hero" aria-label="Ringkasan keuangan">
        <div className="ft-balance-panel">
          <div>
            <p className="ft-eyebrow">Kekayaan bersih</p>
            <h1 className="ft-balance">{formatRupiah(summary.netWorth)}</h1>
          </div>
          <div className="ft-balance-meta">
            <div><span>Total aset</span><strong>{formatRupiah(summary.assets)}</strong></div>
            <div><span>Total utang</span><strong>{formatRupiah(summary.liabilities)}</strong></div>
          </div>
        </div>
        <aside className="ft-month-panel">
          <h2>{monthLabel}</h2>
          <div className="ft-month-stat"><span>Pemasukan</span><strong className="ft-positive">{formatRupiah(summary.income)}</strong></div>
          <div className="ft-month-stat"><span>Pengeluaran</span><strong className="ft-negative">{formatRupiah(summary.expense)}</strong></div>
          <div className="ft-month-stat"><span>Arus bersih</span><strong>{formatRupiah(summary.income - summary.expense)}</strong></div>
        </aside>
      </section>

      <section className="ft-section">
        <div className="ft-section-heading">
          <div><h2>Dompet</h2><p>Dompet pribadi dan yang dibagikan kepada Anda.</p></div>
          <a href="/fintrack/settings#new-wallet" className="ft-button ft-button-secondary"><Plus size={16} />Tambah</a>
        </div>
        <div className="ft-accounts">
          {accounts.map((account) => <AccountCard key={account.id} account={account} />)}
        </div>
      </section>

      <section className="ft-section ft-workspace" id="transactions">
        <TransactionForm key={editing?.id || 'new'} accounts={accounts} categories={categories} editing={editing} onCancelEdit={() => setEditing(null)} onSaved={async () => { await loadData(); setEditing(null) }} />
        <div className="ft-card ft-transactions">
          <div className="ft-transaction-header"><h2>Transaksi terbaru</h2></div>
          <div className="ft-transaction-list">
            {transactions.length === 0 ? (
              <div className="ft-empty"><div><Receipt size={34} /><div>Belum ada transaksi.<br />Catat transaksi pertama Anda.</div></div></div>
            ) : transactions.slice(0, 20).map((transaction) => {
              const Icon = transaction.type === 'income' ? ArrowDown : transaction.type === 'expense' ? ArrowUp : ArrowsLeftRight
              const accountId = transaction.type === 'income' ? transaction.to_account_id : transaction.from_account_id
              const accountName = accountId ? accountMap.get(accountId)?.name : undefined
              const label = transaction.note || (transaction.type === 'income' ? 'Pemasukan' : transaction.type === 'expense' ? 'Pengeluaran' : 'Transfer')
              return (
                <div className="ft-transaction-row" key={transaction.id}>
                  <div className={`ft-transaction-icon ${transaction.type}`}><Icon size={17} weight="bold" /></div>
                  <div className="ft-transaction-copy"><strong>{label}</strong><span>{accountName || 'Dompet bersama'} · {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(transaction.transaction_date))}</span></div>
                  <div className={`ft-transaction-amount ${transaction.type === 'income' ? 'ft-positive' : transaction.type === 'expense' ? 'ft-negative' : ''}`}>
                    {transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}{formatRupiah(transaction.amount)}
                  </div>
                  <div className="ft-row" style={{ gap: 6 }}>
                    <button className="ft-icon-button" title="Edit transaksi" onClick={() => { setEditing(transaction); document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' }) }}><PencilSimple size={16} /></button>
                    <button className="ft-icon-button" title="Batalkan transaksi" onClick={() => voidTransaction(transaction.id)}><Trash size={16} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      <BottomNav />
    </main>
  )
}
