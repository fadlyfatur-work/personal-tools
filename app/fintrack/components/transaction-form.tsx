'use client'

import { useState } from 'react'
import type { Account, Transaction, TransactionType } from '@/types/fintrack'

interface Category { id: string; plan_id: string; name: string; type: 'income' | 'expense' }

interface TransactionFormProps {
  accounts: Account[]
  categories: Category[]
  onSaved: () => Promise<void> | void
  editing?: Transaction | null
  onCancelEdit?: () => void
}

export default function TransactionForm({ accounts, categories, onSaved, editing, onCancelEdit }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(editing?.type || 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [from, setFrom] = useState(editing?.from_account_id || '')
  const [to, setTo] = useState(editing?.to_account_id || '')
  const [category, setCategory] = useState(editing?.category_id || '')
  const [note, setNote] = useState(editing?.note || '')
  const [date, setDate] = useState(editing?.transaction_date || new Date().toISOString().slice(0, 10))
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  function changeType(nextType: TransactionType) {
    setType(nextType)
    setCategory('')
    setMessage(null)
    if (nextType === 'income') setFrom('')
    if (nextType === 'expense') setTo('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    const res = await fetch(editing ? `/api/fintrack/transactions/${editing.id}` : '/api/fintrack/transactions', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        amount: Number(amount),
        from_account_id: from || null,
        to_account_id: to || null,
        category_id: category || null,
        note: note || null,
        transaction_date: date,
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage({ kind: 'error', text: body.error || 'Transaksi gagal disimpan' })
      setSaving(false)
      return
    }
    setAmount('')
    setNote('')
    setCategory('')
    setMessage({ kind: 'success', text: editing ? 'Perubahan transaksi dan saldo sudah diterapkan.' : 'Transaksi tersimpan dan saldo sudah diperbarui.' })
    await onSaved()
    setSaving(false)
  }

  const selectedAccountId = type === 'income' ? to : from
  const selectedPlanId = accounts.find((account) => account.id === selectedAccountId)?.plan_id
  const filteredCategories = categories.filter((item) => item.type === type && (!selectedPlanId || item.plan_id === selectedPlanId))

  return (
    <form className="ft-card ft-form" onSubmit={submit}>
      <h2>{editing ? 'Edit transaksi' : 'Catat transaksi'}</h2>
      <div className="ft-segment" aria-label="Jenis transaksi">
        {(['expense', 'income', 'transfer'] as TransactionType[]).map((item) => (
          <button key={item} type="button" data-active={type === item} onClick={() => changeType(item)}>
            {item === 'expense' ? 'Pengeluaran' : item === 'income' ? 'Pemasukan' : 'Transfer'}
          </button>
        ))}
      </div>

      <div className="ft-field">
        <label htmlFor="amount">Nominal</label>
        <input id="amount" className="ft-input" inputMode="numeric" placeholder="Rp0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} required />
      </div>
      {(type === 'expense' || type === 'transfer') && (
        <div className="ft-field">
          <label htmlFor="from">{type === 'expense' ? 'Bayar dari' : 'Dompet asal'}</label>
          <select id="from" className="ft-input" value={from} onChange={(e) => { setFrom(e.target.value); setCategory('') }} required>
            <option value="">Pilih dompet</option>
            {accounts.filter((a) => a.can_manage).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </div>
      )}
      {(type === 'income' || type === 'transfer') && (
        <div className="ft-field">
          <label htmlFor="to">{type === 'income' ? 'Masuk ke' : 'Dompet tujuan'}</label>
          <select id="to" className="ft-input" value={to} onChange={(e) => { setTo(e.target.value); setCategory('') }} required>
            <option value="">Pilih dompet</option>
            {accounts.filter((a) => a.can_manage && a.id !== from).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </div>
      )}
      {type !== 'transfer' && filteredCategories.length > 0 && (
        <div className="ft-field">
          <label htmlFor="category">Kategori</label>
          <select id="category" className="ft-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Tanpa kategori</option>
            {filteredCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      )}
      <div className="ft-field">
        <label htmlFor="date">Tanggal</label>
        <input id="date" className="ft-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="ft-field">
        <label htmlFor="note">Catatan</label>
        <input id="note" className="ft-input" placeholder="Opsional" maxLength={240} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {message && <p className={`ft-inline-message ft-${message.kind}`}>{message.text}</p>}
      <button className="ft-button ft-button-primary" style={{ width: '100%' }} disabled={saving}>
        {saving ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Simpan transaksi'}
      </button>
      {editing && <button type="button" className="ft-button ft-button-secondary" style={{ width: '100%', marginTop: 8 }} onClick={onCancelEdit}>Batal edit</button>}
    </form>
  )
}
