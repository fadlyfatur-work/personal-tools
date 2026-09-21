'use client'

import { useMemo, useState } from 'react'
import { Archive, ArrowDown, ArrowUp, Bank, Coins, CreditCard, Eye, EyeSlash, HandCoins, PencilSimple, PiggyBank, Plus, Tag, Trash, Wallet, X } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'
import type { Account, AccountKind, Category } from '@/types/fintrack'

const accountIcons = { cash: Wallet, bank: Bank, ewallet: CreditCard, emergency_fund: PiggyBank, investment: Coins, debt: CreditCard, receivable: HandCoins }
const emojiPresets = ['🛒', '🍽️', '🚗', '🏠', '💡', '💊', '🎓', '🎁', '✈️', '💼', '💰', '📈', '🎮', '🐾', '👨‍👩‍👧‍👦', '📦']
const emptyCategoryForm = { name: '', type: 'expense' as 'income' | 'expense', emoji: '🛒', budget_amount: '' }
const onlyDigits = (value: string) => value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
const formatNominal = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export default function ManagePage() {
  const { data, user, accounts, categories, loading, setAccounts, setCategories, updateData, beginTask, endTask, isBusy } = useFintrack()
  const [tab, setTab] = useState<'wallets' | 'categories'>('wallets')
  const [walletForm, setWalletForm] = useState({ name: '', kind: 'bank' as AccountKind, initial_balance: '' })
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [walletFormOpen, setWalletFormOpen] = useState(false)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const autoSort = Boolean(data?.sort_accounts_by_balance)
  const displayedAccounts = useMemo(() => autoSort ? [...accounts].sort((a, b) => Number(b.current_balance) - Number(a.current_balance) || a.name.localeCompare(b.name)) : accounts, [accounts, autoSort])

  async function createWallet(event: React.FormEvent) {
    event.preventDefault(); setMessage(null); beginTask('wallet-create', 'Membuat dompet')
    try {
      const response = await fintrackRequest('/api/fintrack/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...walletForm, initial_balance: Number(walletForm.initial_balance || 0) }) })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Dompet gagal dibuat')
      setAccounts((current) => [...current, body.data]); setWalletForm({ name: '', kind: 'bank', initial_balance: '' }); setWalletFormOpen(false); setMessage({ kind: 'success', text: 'Dompet berhasil dibuat.' })
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

  async function moveWallet(account: Account, direction: -1 | 1) {
    if (autoSort) return
    const owned = accounts.filter((item) => item.access_role === 'owner'), shared = accounts.filter((item) => item.access_role !== 'owner')
    const index = owned.findIndex((item) => item.id === account.id), target = index + direction
    if (index < 0 || target < 0 || target >= owned.length) return
    const reordered = [...owned]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    const optimistic = reordered.map((item, position) => ({ ...item, sort_order: position }))
    setAccounts([...optimistic, ...shared]); beginTask('wallet-reorder', 'Menyimpan urutan dompet')
    try {
      const response = await fintrackRequest('/api/fintrack/accounts/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordered_ids: optimistic.map((item) => item.id) }) })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Urutan dompet gagal disimpan')
      setAccounts([...(body.data as Account[]), ...shared])
    } catch (error) { setAccounts(accounts); setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Urutan dompet gagal disimpan' }) } finally { endTask('wallet-reorder') }
  }

  async function toggleWalletSort() {
    const next = !autoSort; beginTask('wallet-sort-mode', 'Menyimpan urutan dompet')
    try {
      const response = await fintrackRequest('/api/fintrack/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_accounts_by_balance: next }) })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Pengaturan urutan gagal disimpan')
      updateData((current) => ({ ...current, sort_accounts_by_balance: next }))
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Pengaturan urutan gagal disimpan' }) } finally { endTask('wallet-sort-mode') }
  }

  function openCategoryForm(category?: Category) {
    setEditingCategory(category || null)
    setCategoryForm(category ? { name: category.name, type: category.type, emoji: category.emoji || '🛒', budget_amount: category.budget_amount ? String(Math.trunc(Number(category.budget_amount))) : '' } : emptyCategoryForm)
    setCategoryFormOpen(true)
    window.setTimeout(() => document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function saveCategory(event: React.FormEvent) {
    event.preventDefault(); setMessage(null); beginTask('category-write', editingCategory ? 'Memperbarui kategori' : 'Membuat kategori')
    const payload = { name: categoryForm.name, type: categoryForm.type, emoji: categoryForm.emoji || null, budget_amount: categoryForm.type === 'expense' && categoryForm.budget_amount ? Number(categoryForm.budget_amount) : null }
    try {
      const response = await fintrackRequest(editingCategory ? `/api/fintrack/categories/${editingCategory.id}` : '/api/fintrack/categories', { method: editingCategory ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kategori gagal disimpan')
      setCategories((current) => editingCategory ? current.map((item) => item.id === editingCategory.id ? body.data : item) : [...current, body.data].sort((a, b) => a.name.localeCompare(b.name)))
      setCategoryForm(emptyCategoryForm); setEditingCategory(null); setCategoryFormOpen(false); setMessage({ kind: 'success', text: editingCategory ? 'Kategori berhasil diperbarui.' : 'Kategori berhasil dibuat.' })
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal disimpan' }) } finally { endTask('category-write') }
  }

  async function archiveCategory(category: Category) {
    if (!window.confirm(`Arsipkan kategori ${category.name}? Transaksi lama tetap tersimpan.`)) return
    beginTask(`category-${category.id}`, 'Mengarsipkan kategori')
    try { const response = await fintrackRequest(`/api/fintrack/categories/${category.id}`, { method: 'DELETE' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kategori gagal diarsipkan'); setCategories((current) => current.filter((item) => item.id !== category.id)) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Kategori gagal diarsipkan' }) } finally { endTask(`category-${category.id}`) }
  }

  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 150 }} /><div className="ft-skeleton-line" style={{ height: 300, marginTop: 28 }} /></div>
  if (!user) return null
  const personalCategories = categories.filter((category) => category.plan_id === data?.personal_plan_id)
  const owned = accounts.filter((item) => item.access_role === 'owner')

  return <main className="ft-container">
    <Header user={user} eyebrow="Master data" title="Kelola" />
    <div className="ft-page-tabs" role="tablist" aria-label="Kelola data"><button role="tab" aria-selected={tab === 'wallets'} data-active={tab === 'wallets'} onClick={() => setTab('wallets')}>Dompet</button><button role="tab" aria-selected={tab === 'categories'} data-active={tab === 'categories'} onClick={() => setTab('categories')}>Kategori</button></div>
    {message && <p className={`ft-inline-message ft-${message.kind}`}>{message.text}</p>}
    {tab === 'wallets' ? <div className="ft-tab-panel">
      <button className="ft-button ft-button-primary ft-manage-add ft-manage-add-top" type="button" onClick={() => setWalletFormOpen((open) => !open)}>{walletFormOpen ? <X size={16} /> : <Plus size={16} />}{walletFormOpen ? 'Tutup form' : 'Tambah dompet'}</button>
      {walletFormOpen && <form className="ft-card ft-settings-card ft-manage-form" onSubmit={createWallet} data-updating={isBusy('wallet-create')}><h2>Tambah dompet</h2><p>Rekening, tunai, e-wallet, investasi, utang, atau piutang.</p><div className="ft-field"><label htmlFor="wallet-name">Nama dompet</label><input id="wallet-name" className="ft-input" value={walletForm.name} onChange={(event) => setWalletForm({ ...walletForm, name: event.target.value })} required /></div><div className="ft-field"><label htmlFor="wallet-kind">Jenis</label><select id="wallet-kind" className="ft-input" value={walletForm.kind} onChange={(event) => setWalletForm({ ...walletForm, kind: event.target.value as AccountKind })}><option value="bank">Bank</option><option value="cash">Tunai</option><option value="ewallet">E-Wallet</option><option value="emergency_fund">Dana darurat</option><option value="investment">Investasi</option><option value="debt">Utang</option><option value="receivable">Piutang</option></select></div><div className="ft-field"><label htmlFor="initial-balance">Saldo awal</label><input id="initial-balance" className="ft-input" inputMode="numeric" value={formatNominal(walletForm.initial_balance)} onChange={(event) => setWalletForm({ ...walletForm, initial_balance: onlyDigits(event.target.value) })} /></div><button className="ft-button ft-button-primary" style={{ width: '100%' }}><Plus size={16} />Buat dompet</button></form>}
      <label className="ft-preference-toggle"><div><strong>Urutkan berdasarkan saldo</strong><span>{autoSort ? 'Saldo terbesar tampil lebih dahulu.' : 'Urutan manual sedang digunakan.'}</span></div><input type="checkbox" checked={autoSort} disabled={isBusy('wallet-sort-mode')} onChange={() => void toggleWalletSort()} /><i aria-hidden="true" /></label>
      <section className="ft-manage-list">{displayedAccounts.map((account) => { const Icon = accountIcons[account.kind] || Wallet; const ownedIndex = owned.findIndex((item) => item.id === account.id); return <article className="ft-manage-row ft-wallet-manage-row" key={account.id} data-updating={isBusy(`wallet-${account.id}`) || isBusy('wallet-reorder')}><div className="ft-manage-identity"><span className="ft-account-icon"><Icon size={18} weight="fill" /></span><div className="ft-manage-copy"><strong>{account.name}</strong><span>{formatRupiah(account.current_balance)}{account.access_role !== 'owner' ? ', dibagikan' : account.include_in_net_worth === false ? ', tidak dihitung dalam aset' : ', dihitung dalam aset'}</span></div></div><div className="ft-row ft-manage-actions">{account.access_role === 'owner' && <>{!autoSort && <><button className="ft-icon-button" title="Naikkan urutan" disabled={ownedIndex === 0} onClick={() => moveWallet(account, -1)}><ArrowUp size={15} /></button><button className="ft-icon-button" title="Turunkan urutan" disabled={ownedIndex === owned.length - 1} onClick={() => moveWallet(account, 1)}><ArrowDown size={15} /></button></>}<button className="ft-icon-button" title={account.include_in_net_worth === false ? 'Sertakan dalam total aset' : 'Kecualikan dari total aset'} onClick={() => updateWallet(account, { include_in_net_worth: account.include_in_net_worth === false })}>{account.include_in_net_worth === false ? <Eye size={16} /> : <EyeSlash size={16} />}</button></>}<button className="ft-icon-button" title="Ubah nama" onClick={() => { const name = window.prompt('Nama dompet', account.name)?.trim(); if (name && name !== account.name) void updateWallet(account, { name }) }}><PencilSimple size={16} /></button>{account.access_role === 'owner' && <button className="ft-icon-button" title="Arsipkan" onClick={() => archiveWallet(account)}><Archive size={16} /></button>}</div></article> })}</section>
      <p className="ft-hint">Dompet yang dikecualikan tidak masuk total aset. Transaksinya tetap tercatat dalam laporan.</p>
    </div> : <div className="ft-tab-panel">
      <button className="ft-button ft-button-primary ft-manage-add ft-manage-add-top" type="button" onClick={() => categoryFormOpen ? setCategoryFormOpen(false) : openCategoryForm()}>{categoryFormOpen ? <X size={16} /> : <Plus size={16} />}{categoryFormOpen ? 'Tutup form' : 'Tambah kategori'}</button>
      {categoryFormOpen && <form id="category-form" className="ft-card ft-settings-card ft-manage-form" onSubmit={saveCategory} data-updating={isBusy('category-write')}><h2>{editingCategory ? 'Ubah kategori' : 'Tambah kategori'}</h2><p>Emoji membantu kategori lebih mudah dikenali. Budget hanya berlaku untuk pengeluaran.</p><div className="ft-field"><label htmlFor="category-name">Nama kategori</label><input id="category-name" className="ft-input" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required maxLength={60} /></div><div className="ft-field"><label>Emoji kategori</label><div className="ft-emoji-presets" role="group" aria-label="Pilihan emoji kategori">{emojiPresets.map((emoji) => <button type="button" key={emoji} data-active={categoryForm.emoji === emoji} onClick={() => setCategoryForm({ ...categoryForm, emoji })}>{emoji}</button>)}</div><input className="ft-input ft-emoji-input" aria-label="Emoji kategori lain" value={categoryForm.emoji} maxLength={16} onChange={(event) => setCategoryForm({ ...categoryForm, emoji: event.target.value })} placeholder="Atau masukkan emoji lain" /></div><div className="ft-field"><label htmlFor="category-type">Tipe</label><select id="category-type" className="ft-input" value={categoryForm.type} onChange={(event) => setCategoryForm({ ...categoryForm, type: event.target.value as 'income' | 'expense', budget_amount: event.target.value === 'income' ? '' : categoryForm.budget_amount })}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></div>{categoryForm.type === 'expense' && <div className="ft-field"><label htmlFor="category-budget">Budget per periode</label><input id="category-budget" className="ft-input" inputMode="numeric" value={formatNominal(categoryForm.budget_amount)} onChange={(event) => setCategoryForm({ ...categoryForm, budget_amount: onlyDigits(event.target.value) })} placeholder="Opsional" /><small>Periode mengikuti tanggal cutoff laporan.</small></div>}<button className="ft-button ft-button-primary" style={{ width: '100%' }}>{editingCategory ? <PencilSimple size={16} /> : <Plus size={16} />}{editingCategory ? 'Simpan perubahan' : 'Tambah kategori'}</button></form>}
      {(['expense', 'income'] as const).map((type) => <section className="ft-section" key={type}><div className="ft-section-heading"><div><h2>{type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</h2><p>{type === 'expense' ? 'Budget dapat diatur secara opsional' : 'Digunakan saat mencatat uang masuk'}</p></div></div><div className="ft-manage-list">{personalCategories.filter((category) => category.type === type).map((category) => <article className="ft-manage-row ft-category-manage-row" key={category.id} data-updating={isBusy(`category-${category.id}`)}><div className="ft-manage-identity"><span className="ft-category-emoji">{category.emoji || <Tag size={18} weight="fill" />}</span><div className="ft-manage-copy"><strong>{category.name}</strong><span>{category.budget_amount ? `Budget ${formatRupiah(category.budget_amount)} per periode` : 'Tanpa budget'}</span></div></div><div className="ft-row ft-manage-actions"><button className="ft-icon-button" title="Ubah kategori" onClick={() => openCategoryForm(category)}><PencilSimple size={16} /></button><button className="ft-icon-button" title="Arsipkan" onClick={() => archiveCategory(category)}><Trash size={16} /></button></div></article>)}</div></section>)}
    </div>}
    <BottomNav />
  </main>
}
