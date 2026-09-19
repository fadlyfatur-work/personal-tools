'use client'

import { useState } from 'react'
import { Archive, Bank, Coins, CreditCard, Eye, EyeSlash, HandCoins, PencilSimple, PiggyBank, Plus, Tag, Trash, Wallet } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'
import type { Account, AccountKind, Category } from '@/types/fintrack'

const accountIcons = { cash: Wallet, bank: Bank, ewallet: CreditCard, emergency_fund: PiggyBank, investment: Coins, debt: CreditCard, receivable: HandCoins }

export default function ManagePage() {
  const { user, accounts, categories, loading, setAccounts, setCategories, beginTask, endTask, isBusy } = useFintrack()
  const [tab, setTab] = useState<'wallets' | 'categories'>('wallets')
  const [walletForm, setWalletForm] = useState({ name: '', kind: 'bank' as AccountKind, initial_balance: '' })
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' as 'income' | 'expense' })
  const [walletFormOpen, setWalletFormOpen] = useState(false)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function createWallet(event: React.FormEvent) {
    event.preventDefault(); setMessage(null); beginTask('wallet-create', 'Membuat dompet')
    try {
      const response = await fintrackRequest('/api/fintrack/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...walletForm, initial_balance: Number(walletForm.initial_balance || 0) }) })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Dompet gagal dibuat')
      setAccounts((current) => [...current, body.data]); setWalletForm({ name: '', kind: 'bank', initial_balance: '' }); setMessage({ kind: 'success', text: 'Dompet berhasil dibuat.' })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Dompet gagal dibuat' }) } finally { endTask('wallet-create') }
  }

  async function updateWallet(account: Account, update: { name?: string; include_in_net_worth?: boolean }) {
    beginTask(`wallet-${account.id}`, 'Memperbarui dompet')
    try {
      const response = await fintrackRequest(`/api/fintrack/accounts/${account.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Dompet gagal diperbarui')
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, ...body.data, access_role: item.access_role, can_manage: item.can_manage } : item))
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Dompet gagal diperbarui' }) } finally { endTask(`wallet-${account.id}`) }
  }

  async function archiveWallet(account: Account) {
    if (!window.confirm(`Arsipkan dompet ${account.name}?`)) return
    beginTask(`wallet-${account.id}`, 'Mengarsipkan dompet')
    try { const response = await fintrackRequest(`/api/fintrack/accounts/${account.id}`, { method: 'DELETE' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Dompet gagal diarsipkan'); setAccounts((current) => current.filter((item) => item.id !== account.id)) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Dompet gagal diarsipkan' }) } finally { endTask(`wallet-${account.id}`) }
  }

  async function createCategory(event: React.FormEvent) {
    event.preventDefault(); setMessage(null); beginTask('category-create', 'Membuat kategori')
    try { const response = await fintrackRequest('/api/fintrack/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(categoryForm) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kategori gagal dibuat'); setCategories((current) => [...current, body.data].sort((a, b) => a.name.localeCompare(b.name))); setCategoryForm({ name: '', type: categoryForm.type }); setMessage({ kind: 'success', text: 'Kategori berhasil dibuat.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal dibuat' }) } finally { endTask('category-create') }
  }

  async function renameCategory(category: Category) {
    const name = window.prompt('Nama kategori', category.name)?.trim(); if (!name || name === category.name) return
    beginTask(`category-${category.id}`, 'Mengubah kategori')
    try { const response = await fintrackRequest(`/api/fintrack/categories/${category.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kategori gagal diubah'); setCategories((current) => current.map((item) => item.id === category.id ? body.data : item)) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal diubah' }) } finally { endTask(`category-${category.id}`) }
  }

  async function archiveCategory(category: Category) {
    if (!window.confirm(`Arsipkan kategori ${category.name}? Transaksi lama tetap tersimpan.`)) return
    beginTask(`category-${category.id}`, 'Mengarsipkan kategori')
    try { const response = await fintrackRequest(`/api/fintrack/categories/${category.id}`, { method: 'DELETE' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kategori gagal diarsipkan'); setCategories((current) => current.filter((item) => item.id !== category.id)) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal diarsipkan' }) } finally { endTask(`category-${category.id}`) }
  }

  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 150 }} /><div className="ft-skeleton-line" style={{ height: 300, marginTop: 28 }} /></div>
  if (!user) return null

  return (
    <main className="ft-container">
      <Header user={user} eyebrow="Master data" title="Kelola" />
      <div className="ft-page-tabs" role="tablist" aria-label="Kelola data"><button role="tab" aria-selected={tab === 'wallets'} data-active={tab === 'wallets'} onClick={() => setTab('wallets')}>Dompet</button><button role="tab" aria-selected={tab === 'categories'} data-active={tab === 'categories'} onClick={() => setTab('categories')}>Kategori</button></div>
      {message && <p className={`ft-inline-message ft-${message.kind}`}>{message.text}</p>}
      {tab === 'wallets' ? <div className="ft-tab-panel">
        <section className="ft-manage-list">{accounts.map((account) => { const Icon = accountIcons[account.kind] || Wallet; return <article className="ft-manage-row" key={account.id} data-updating={isBusy(`wallet-${account.id}`)}><span className="ft-account-icon"><Icon size={18} weight="fill" /></span><div><strong>{account.name}</strong><span>{formatRupiah(account.current_balance)}{account.access_role !== 'owner' ? ', dibagikan' : account.include_in_net_worth === false ? ', tidak dihitung dalam aset' : ', dihitung dalam aset'}</span></div><div className="ft-row ft-manage-actions">{account.access_role === 'owner' && <button className="ft-icon-button" title={account.include_in_net_worth === false ? 'Sertakan dalam kekayaan' : 'Kecualikan dari kekayaan'} onClick={() => updateWallet(account, { include_in_net_worth: account.include_in_net_worth === false })}>{account.include_in_net_worth === false ? <Eye size={16} /> : <EyeSlash size={16} />}</button>}<button className="ft-icon-button" title="Ubah nama" onClick={() => { const name = window.prompt('Nama dompet', account.name)?.trim(); if (name && name !== account.name) void updateWallet(account, { name }) }}><PencilSimple size={16} /></button>{account.access_role === 'owner' && <button className="ft-icon-button" title="Arsipkan" onClick={() => archiveWallet(account)}><Archive size={16} /></button>}</div></article> })}</section>
        <button className="ft-button ft-button-primary ft-manage-add" type="button" onClick={() => setWalletFormOpen((open) => !open)}><Plus size={16} />{walletFormOpen ? 'Tutup form' : 'Tambah dompet'}</button>
        <p className="ft-hint">Pengaturan hitung aset hanya memengaruhi total aset dan kekayaan bersih. Transaksi tetap masuk laporan.</p>
        {walletFormOpen && <form className="ft-card ft-settings-card ft-manage-form" onSubmit={createWallet} data-updating={isBusy('wallet-create')}><h2>Tambah dompet</h2><p>Rekening, tunai, e-wallet, investasi, utang, atau piutang.</p><div className="ft-field"><label htmlFor="wallet-name">Nama dompet</label><input id="wallet-name" className="ft-input" value={walletForm.name} onChange={(event) => setWalletForm({ ...walletForm, name: event.target.value })} required /></div><div className="ft-field"><label htmlFor="wallet-kind">Jenis</label><select id="wallet-kind" className="ft-input" value={walletForm.kind} onChange={(event) => setWalletForm({ ...walletForm, kind: event.target.value as AccountKind })}><option value="bank">Bank</option><option value="cash">Tunai</option><option value="ewallet">E-Wallet</option><option value="emergency_fund">Dana darurat</option><option value="investment">Investasi</option><option value="debt">Utang</option><option value="receivable">Piutang</option></select></div><div className="ft-field"><label htmlFor="initial-balance">Saldo awal</label><input id="initial-balance" className="ft-input" inputMode="numeric" value={walletForm.initial_balance} onChange={(event) => setWalletForm({ ...walletForm, initial_balance: event.target.value.replace(/[^0-9]/g, '') })} /></div><button className="ft-button ft-button-primary" style={{ width: '100%' }}><Plus size={16} />Buat dompet</button></form>}
      </div> : <div className="ft-tab-panel">{(['expense', 'income'] as const).map((type) => <section className="ft-section" key={type}><div className="ft-section-heading"><div><h2>{type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</h2><p>{type === 'expense' ? 'Digunakan saat mencatat uang keluar' : 'Digunakan saat mencatat uang masuk'}</p></div></div><div className="ft-manage-list">{categories.filter((category) => category.type === type).map((category) => <article className="ft-manage-row" key={category.id} data-updating={isBusy(`category-${category.id}`)}><span className="ft-account-icon"><Tag size={18} weight="fill" /></span><div><strong>{category.name}</strong><span>Aktif</span></div><div className="ft-row ft-manage-actions"><button className="ft-icon-button" title="Ubah nama" onClick={() => renameCategory(category)}><PencilSimple size={16} /></button><button className="ft-icon-button" title="Arsipkan" onClick={() => archiveCategory(category)}><Trash size={16} /></button></div></article>)}</div></section>)}<button className="ft-button ft-button-primary ft-manage-add" type="button" onClick={() => setCategoryFormOpen((open) => !open)}><Plus size={16} />{categoryFormOpen ? 'Tutup form' : 'Tambah kategori'}</button>{categoryFormOpen && <form className="ft-card ft-settings-card ft-manage-form" onSubmit={createCategory} data-updating={isBusy('category-create')}><h2>Tambah kategori</h2><p>Kategori berlaku untuk rencana pribadi Anda.</p><div className="ft-field"><label htmlFor="category-name">Nama kategori</label><input id="category-name" className="ft-input" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required /></div><div className="ft-field"><label htmlFor="category-type">Tipe</label><select id="category-type" className="ft-input" value={categoryForm.type} onChange={(event) => setCategoryForm({ ...categoryForm, type: event.target.value as 'income' | 'expense' })}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></div><button className="ft-button ft-button-primary" style={{ width: '100%' }}><Plus size={16} />Tambah kategori</button></form>}</div>}
      <BottomNav />
    </main>
  )
}
