'use client'

import './goals.css'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, PencilSimple, Plus, Target, Trash, X } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { ActionMenu } from '../components/action-menu'
import { TransactionSheet } from '../components/transaction-sheet'
import TransactionForm from '../components/transaction-form'
import { formatRupiah } from '../components/account-card'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'
import { goalProgress } from '@/lib/fintrackGoals'
import type { Goal, GoalItem, Transaction } from '@/types/fintrack'

const emptyGoal = { name: '', emoji: '🎯', kind: 'purchase', target_amount: '', target_date: '' }
const digits = (value: string) => value.replace(/[^0-9]/g, '')
const nominal = (value: string) => value.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
type Panel = { type: 'goal'; goal?: Goal } | { type: 'item'; goal: Goal; item?: GoalItem } | { type: 'transaction'; goal: Goal; initial: Partial<Transaction> }

export default function GoalsPage() {
  const router = useRouter()
  const { user, loading, accounts, categories, refreshData, applyTransactionChange } = useFintrack()
  const client = useQueryClient()
  const [filter, setFilter] = useState<Goal['status']>('active')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const query = useQuery<Goal[]>({ queryKey: ['fintrack', 'goals'], enabled: Boolean(user), queryFn: async () => {
    const response = await fintrackRequest('/api/fintrack/goals', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Tujuan gagal dimuat')
    return body.data
  } })

  async function write(url: string, method: string, payload: unknown) {
    const response = await fintrackRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Perubahan gagal disimpan')
    return body.data
  }

  async function action(operation: () => Promise<unknown>) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try { await operation(); await client.invalidateQueries({ queryKey: ['fintrack', 'goals'] }) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Perubahan gagal disimpan') }
    finally { setBusy(false) }
  }

  function transact(goal: Goal, type: 'deposit' | 'withdraw' | 'expense', item?: GoalItem) {
    setPanel({ type: 'transaction', goal, initial: type === 'deposit' ? { type: 'transfer', to_account_id: goal.account_id } : { type: type === 'withdraw' ? 'transfer' : 'expense', from_account_id: goal.account_id, goal_item_id: item?.id } })
  }

  if (loading) return <main className="ft-container"><p role="status">Memuat FinTrack...</p></main>
  if (!user) return null
  const goals = query.data || []
  const displayed = goals.filter(goal => goal.status === filter)
  const active = goals.filter(goal => goal.status === 'active')
  const remaining = active.reduce((sum, goal) => sum + goalProgress(goal).remaining, 0)

  return <main className="ft-container ft-goals-page">
    <Header user={user} eyebrow="Rencana keuangan" title="Tujuan" />
    <div className="ft-goals-intro"><p>Pisahkan dana untuk sesuatu yang ingin kamu capai.</p><button type="button" className="ft-button ft-button-primary" onClick={() => setPanel({ type: 'goal' })} disabled={query.isError || query.isPending}><Plus size={17} />Buat tujuan</button></div>
    {query.isError ? <div className="ft-card ft-goals-empty" role="alert"><p>{query.error.message}</p><button type="button" className="ft-button ft-button-secondary" onClick={() => void query.refetch()}>Coba lagi</button></div> : <>
      <section className="ft-goals-overview" aria-label="Ringkasan tujuan aktif"><div><span>Dana tersedia</span><strong>{formatRupiah(active.reduce((sum, goal) => sum + Number(goal.current_balance), 0))}</strong></div><div><span>Masih dibutuhkan</span><strong>{formatRupiah(remaining)}</strong></div></section>
      <div className="ft-page-tabs" aria-label="Status tujuan">{(['active', 'completed', 'archived'] as const).map(status => <button type="button" key={status} data-active={filter === status} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status === 'active' ? 'Aktif' : status === 'completed' ? 'Selesai' : 'Arsip'} ({goals.filter(goal => goal.status === status).length})</button>)}</div>
      {query.isPending && <p role="status">Memuat tujuan...</p>}
      {message && <p role="alert" className="ft-inline-message ft-error">{message}</p>}
      {!query.isPending && displayed.length === 0 && <section className="ft-card ft-goals-empty"><Target size={32} /><h2>{filter === 'active' ? 'Apa tujuan berikutnya?' : 'Belum ada tujuan di sini'}</h2><p>{filter === 'active' ? 'Buat tujuan untuk liburan, membeli barang, atau mengumpulkan dana investasi.' : 'Tujuan yang kamu selesaikan atau arsipkan akan muncul di sini.'}</p></section>}
      <div className="ft-goals-list">{displayed.map(goal => {
        const progress = goalProgress(goal)
        const estimated = goal.items.reduce((sum, item) => sum + Number(item.estimated_amount), 0)
        return <details key={goal.id} className="ft-card ft-goal-card">
          <summary><span className="ft-goal-emoji" aria-hidden="true">{goal.emoji}</span><div className="ft-goal-heading"><h2>{goal.name}</h2><span>{goal.kind === 'investment' ? 'Investasi' : 'Tabungan tujuan'}{goal.target_date ? ` · ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${goal.target_date}T12:00:00`))}` : ''}</span><div className="ft-goal-progress-label"><strong>{formatRupiah(progress.funded)}</strong><span>{progress.percentage}%</span></div><progress max={100} value={progress.percentage} aria-label={`Progres pendanaan ${goal.name}`} /><small>Target {formatRupiah(goal.target_amount)}</small></div><span className="ft-goal-chevron" aria-hidden="true">⌄</span></summary>
          <div className="ft-goal-detail">
            <dl className="ft-goal-numbers"><div><dt>Tersedia</dt><dd>{formatRupiah(goal.current_balance)}</dd></div><div><dt>Sudah digunakan</dt><dd>{formatRupiah(goal.spent)}</dd></div><div><dt>Kurang</dt><dd>{formatRupiah(progress.remaining)}</dd></div></dl>
            <div className="ft-goal-actions">
              {goal.status !== 'archived' && <><button type="button" className="ft-button ft-button-primary" onClick={() => transact(goal, 'deposit')}>Tambah dana</button><button type="button" className="ft-button ft-button-secondary" onClick={() => transact(goal, 'expense')}>Catat belanja</button></>}
              {goal.status === 'archived' && accounts.some(account => account.id === goal.account_id) && <button type="button" className="ft-button ft-button-secondary" disabled={busy} onClick={() => void action(() => write(`/api/fintrack/goals/${goal.id}`, 'PATCH', { status: 'active' }))}>Pulihkan tujuan</button>}
              <ActionMenu label={`Aksi tujuan ${goal.name}`}>
                {goal.status !== 'archived' && <>
                  <button type="button" role="menuitem" onClick={() => transact(goal, 'withdraw')}><ArrowUpRight size={16} />Tarik dana</button>
                  <button type="button" role="menuitem" onClick={() => setPanel({ type: 'goal', goal })}><PencilSimple size={16} />Ubah tujuan</button>
                  <button type="button" role="menuitem" disabled={busy} onClick={() => void action(() => write(`/api/fintrack/goals/${goal.id}`, 'PATCH', { status: goal.status === 'active' ? 'completed' : 'active' }))}><Check size={16} />{goal.status === 'active' ? 'Tandai selesai' : 'Aktifkan lagi'}</button>
                </>}
                <button type="button" role="menuitem" onClick={() => router.push('/fintrack/activity')}><ArrowUpRight size={16} />Lihat aktivitas</button>
                {goal.status !== 'archived' && <button type="button" role="menuitem" className="danger ft-goal-menu-archive" disabled={busy} onClick={() => { if (window.confirm('Arsipkan tujuan ini? Dompet dan riwayat transaksi tetap tersimpan.')) void action(() => write(`/api/fintrack/goals/${goal.id}`, 'PATCH', { status: 'archived' })) }}><Trash size={16} />Arsipkan</button>}
              </ActionMenu>
            </div>
            <div className="ft-goal-items-title"><h3>Rincian <span>({goal.items.length})</span></h3>{goal.status !== 'archived' && <button type="button" className="ft-goal-add-item" onClick={() => setPanel({ type: 'item', goal })}><Plus size={16} />Tambah item</button>}</div>
            {goal.items.length === 0 && <p className="ft-goal-help ft-goal-no-items">Belum ada rincian kebutuhan.</p>}
            <ul className="ft-goal-items">{goal.items.map(item => <li key={item.id}><div><strong>{item.name}</strong><span>Estimasi {formatRupiah(item.estimated_amount)}</span><span data-over={Number(item.spent) > Number(item.estimated_amount)}>Realisasi {formatRupiah(item.spent)}</span></div>{goal.status !== 'archived' && <ActionMenu label={`Aksi item ${item.name}`}><button type="button" role="menuitem" onClick={() => transact(goal, 'expense', item)}><Plus size={16} />Catat belanja</button><button type="button" role="menuitem" onClick={() => setPanel({ type: 'item', goal, item })}><PencilSimple size={16} />Ubah item</button><button type="button" role="menuitem" className="danger" disabled={busy} onClick={() => { if (window.confirm('Hapus item ini? Transaksi dan saldonya tetap tersimpan, tanpa kaitan ke item.')) void action(() => write(`/api/fintrack/goals/${goal.id}/items`, 'DELETE', { id: item.id })) }}><Trash size={16} />Hapus item</button></ActionMenu>}</li>)}</ul>
            {goal.items.length > 0 && <p className="ft-goal-help">Total estimasi {formatRupiah(estimated)}{estimated > Number(goal.target_amount) ? '. Estimasi melebihi target dana.' : '.'}</p>}
          </div>
        </details>
      })}</div>
      <p className="ft-goal-help">Dana tujuan tetap dihitung dalam aset. Transfer antar dompet tidak dihitung sebagai pengeluaran. Untuk investasi, progres mencatat dana; perubahan harga aset belum dihitung.</p>
    </>}
    <BottomNav />
    {panel && <TransactionSheet onClose={() => setPanel(null)}>{close => <>
      <div className="ft-modal-header"><div><p>Tujuan keuangan</p><h2 id="transaction-modal-title">{panel.type === 'goal' ? panel.goal ? 'Ubah tujuan' : 'Buat tujuan' : panel.type === 'item' ? panel.item ? 'Ubah item' : 'Tambah item' : panel.goal.name}</h2></div><button type="button" className="ft-icon-button" onClick={close} aria-label="Tutup"><X size={18} /></button></div>
      <div className="ft-modal-body">{panel.type === 'transaction' ? <TransactionForm accounts={accounts} categories={categories} initial={panel.initial} onSaved={transaction => { applyTransactionChange(null, transaction); void refreshData(); close() }} /> : <GoalEditor panel={panel} save={async payload => {
        await write(panel.type === 'goal' ? panel.goal ? `/api/fintrack/goals/${panel.goal.id}` : '/api/fintrack/goals' : `/api/fintrack/goals/${panel.goal.id}/items`, panel.type === 'goal' ? panel.goal ? 'PATCH' : 'POST' : panel.item ? 'PATCH' : 'POST', payload)
        await refreshData()
        close()
      }} />}</div>
    </>}</TransactionSheet>}
  </main>
}

function GoalEditor({ panel, save }: { panel: Exclude<Panel, { type: 'transaction' }>; save: (payload: unknown) => Promise<void> }) {
  const [form, setForm] = useState(panel.type === 'goal' ? panel.goal ? { name: panel.goal.name, emoji: panel.goal.emoji, kind: panel.goal.kind, target_amount: String(panel.goal.target_amount), target_date: panel.goal.target_date || '' } : emptyGoal : { ...emptyGoal, name: panel.item?.name || '', target_amount: panel.item ? String(panel.item.estimated_amount) : '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await save(panel.type === 'goal' ? { name: form.name, emoji: form.emoji, ...(!panel.goal ? { kind: form.kind } : {}), target_amount: Number(form.target_amount), target_date: form.target_date || null } : { ...(panel.item ? { id: panel.item.id } : {}), name: form.name, estimated_amount: Number(form.target_amount) }) }
    catch (err) { setError(err instanceof Error ? err.message : 'Gagal menyimpan') }
    finally { setSaving(false) }
  }
  return <form className="ft-form" onSubmit={submit}>
    <div className="ft-field"><label htmlFor="goal-name">{panel.type === 'goal' ? 'Nama tujuan' : 'Nama item'}</label><input id="goal-name" className="ft-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required maxLength={60} placeholder={panel.type === 'goal' ? 'Misalnya, liburan Jepang' : 'Misalnya, tiket pesawat'} /></div>
    {panel.type === 'goal' && <><div className="ft-field"><label htmlFor="goal-emoji">Ikon</label><input id="goal-emoji" className="ft-input" value={form.emoji} onChange={event => setForm({ ...form, emoji: event.target.value })} required maxLength={16} /></div>{!panel.goal && <div className="ft-field"><label htmlFor="goal-kind">Jenis tujuan</label><select id="goal-kind" className="ft-input" value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value })}><option value="purchase">Tabungan tujuan</option><option value="investment">Investasi</option></select></div>}</>}
    <div className="ft-field"><label htmlFor="goal-amount">{panel.type === 'goal' ? 'Target dana (Rp)' : 'Estimasi biaya (Rp)'}</label><input id="goal-amount" className="ft-input" inputMode="numeric" value={nominal(form.target_amount)} onChange={event => setForm({ ...form, target_amount: digits(event.target.value) })} required maxLength={16} /><small>{panel.type === 'item' ? 'Estimasi item tidak mengubah target tujuan secara otomatis.' : 'Dompet tujuan dimulai dari Rp0. Tambahkan dana melalui transfer.'}</small></div>
    {panel.type === 'goal' && <div className="ft-field"><label htmlFor="goal-date">Tenggat (opsional)</label><input id="goal-date" className="ft-input" type="date" value={form.target_date} onChange={event => setForm({ ...form, target_date: event.target.value })} /></div>}
    {error && <p role="alert" className="ft-inline-message ft-error">{error}</p>}
    <button className="ft-button ft-button-primary" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
  </form>
}
