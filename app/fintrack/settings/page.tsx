'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, UserPlus, X } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'

interface User { name: string; email: string }
interface Wallet { id: string; name: string; kind: string; current_balance: number }
interface JoinRequest {
  id: string
  requester: { name: string; email: string } | null
  account: { name: string } | null
}
interface Collaborator {
  account_id: string
  user_id: string
  user: { name: string; email: string } | null
  account: { name: string } | null
}

export default function FintrackSettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [selectedWallet, setSelectedWallet] = useState('')
  const [invite, setInvite] = useState<{ code: string; account: string; expires_at: string } | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [newWallet, setNewWallet] = useState({ name: '', kind: 'bank', initial_balance: '' })
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasPin, setHasPin] = useState(false)
  const [pin, setPin] = useState('')

  const loadData = useCallback(async () => {
    const [meResponse, collaborationResponse] = await Promise.all([
      fetch('/api/fintrack/auth/me'),
      fetch('/api/fintrack/collaboration'),
    ])
    if (meResponse.status === 401) {
      router.replace('/fintrack/login')
      return
    }
    if (!meResponse.ok || !collaborationResponse.ok) throw new Error()
    const [me, collaboration] = await Promise.all([meResponse.json(), collaborationResponse.json()])
    setUser(me.user)
    setHasPin(Boolean(me.has_pin))
    setWallets(collaboration.owned_accounts || [])
    setRequests(collaboration.pending_requests || [])
    setCollaborators(collaboration.collaborators || [])
    if (!selectedWallet && collaboration.owned_accounts?.[0]?.id) setSelectedWallet(collaboration.owned_accounts[0].id)
  }, [router, selectedWallet])

  useEffect(() => {
    let active = true
    const task = window.setTimeout(() => {
      loadData()
        .catch(() => { if (active) setMessage({ kind: 'error', text: 'Pengaturan belum dapat dimuat.' }) })
        .finally(() => { if (active) setLoading(false) })
    }, 0)
    return () => { active = false; window.clearTimeout(task) }
  }, [loadData])

  async function createWallet(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    const response = await fetch('/api/fintrack/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newWallet, initial_balance: Number(newWallet.initial_balance || 0) }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ kind: 'error', text: body.error || 'Dompet gagal dibuat' })
    setNewWallet({ name: '', kind: 'bank', initial_balance: '' })
    setMessage({ kind: 'success', text: 'Dompet baru berhasil dibuat.' })
    await loadData()
  }

  async function generateInvite() {
    setMessage(null)
    const confirmationPin = hasPin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (hasPin && !confirmationPin) return
    const response = await fetch('/api/fintrack/collaboration/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(confirmationPin ? { 'x-fintrack-pin': confirmationPin } : {}) },
      body: JSON.stringify({ account_id: selectedWallet }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ kind: 'error', text: body.error || 'Kode gagal dibuat' })
    setInvite(body)
  }

  async function requestJoin(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    const response = await fetch('/api/fintrack/collaboration/join-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: joinCode }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ kind: 'error', text: body.error || 'Permintaan gagal dikirim' })
    setJoinCode('')
    setMessage({ kind: 'success', text: 'Permintaan sudah dikirim. Tunggu owner menyetujuinya.' })
  }

  async function review(requestId: string, decision: 'accepted' | 'rejected') {
    const confirmationPin = hasPin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (hasPin && !confirmationPin) return
    const response = await fetch(`/api/fintrack/collaboration/join-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(confirmationPin ? { 'x-fintrack-pin': confirmationPin } : {}) },
      body: JSON.stringify({ decision }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ kind: 'error', text: body.error || 'Permintaan gagal diproses' })
    setMessage({ kind: 'success', text: decision === 'accepted' ? 'Kolaborator mendapat akses ke dompet.' : 'Permintaan ditolak.' })
    await loadData()
  }

  async function savePin(event: React.FormEvent) {
    event.preventDefault()
    setMessage(null)
    const response = await fetch('/api/fintrack/security/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ kind: 'error', text: body.error || 'PIN gagal disimpan' })
    setPin('')
    setHasPin(true)
    setMessage({ kind: 'success', text: 'PIN konfirmasi berhasil disimpan.' })
  }

  async function revokeAccess(item: Collaborator) {
    if (!window.confirm(`Cabut akses ${item.user?.name || 'kolaborator'} dari ${item.account?.name || 'dompet'}?`)) return
    const confirmationPin = hasPin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (hasPin && !confirmationPin) return
    const response = await fetch(`/api/fintrack/collaboration/members/${item.account_id}/${item.user_id}`, {
      method: 'DELETE',
      headers: confirmationPin ? { 'x-fintrack-pin': confirmationPin } : {},
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) return setMessage({ kind: 'error', text: body.error || 'Akses gagal dicabut' })
    setMessage({ kind: 'success', text: 'Akses kolaborator sudah dicabut.' })
    await loadData()
  }

  if (loading) return <div className="ft-skeleton"><div className="ft-skeleton-line" style={{ width: 180 }} /><div className="ft-skeleton-line" style={{ height: 260, marginTop: 32 }} /></div>
  if (!user) return null

  return (
    <main className="ft-container">
      <Header user={user} />
      <div className="ft-section-heading" style={{ marginBottom: 22 }}>
        <div><h2>Pengaturan</h2><p>Kelola dompet dan akses kolaborator.</p></div>
      </div>
      {message && <p className={`ft-inline-message ft-${message.kind}`}>{message.text}</p>}

      <div className="ft-settings-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          <form className="ft-card ft-settings-card" onSubmit={savePin}>
            <h2>PIN konfirmasi</h2>
            <p>{hasPin ? 'PIN aktif. Buat PIN baru jika ingin menggantinya.' : 'Opsional. PIN dipakai untuk undangan, persetujuan akses, dan pembatalan transaksi. Jika lupa, masuk dengan Google lalu buat PIN baru.'}</p>
            <div className="ft-field"><label htmlFor="security-pin">PIN 6 digit</label><input id="security-pin" className="ft-input" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} required /></div>
            <button className="ft-button ft-button-secondary" style={{ width: '100%' }}>{hasPin ? 'Ganti PIN' : 'Aktifkan PIN'}</button>
          </form>

          <form className="ft-card ft-settings-card" id="new-wallet" onSubmit={createWallet}>
            <h2>Tambah dompet</h2>
            <p>Buat rekening, uang tunai, e-wallet, atau akun keuangan lainnya.</p>
            <div className="ft-field"><label htmlFor="wallet-name">Nama dompet</label><input id="wallet-name" className="ft-input" value={newWallet.name} onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })} required /></div>
            <div className="ft-field"><label htmlFor="wallet-kind">Jenis</label><select id="wallet-kind" className="ft-input" value={newWallet.kind} onChange={(e) => setNewWallet({ ...newWallet, kind: e.target.value })}><option value="bank">Bank</option><option value="cash">Tunai</option><option value="ewallet">E-Wallet</option><option value="emergency_fund">Dana darurat</option><option value="investment">Investasi</option><option value="debt">Utang</option><option value="receivable">Piutang</option></select></div>
            <div className="ft-field"><label htmlFor="initial-balance">Saldo awal</label><input id="initial-balance" className="ft-input" inputMode="numeric" value={newWallet.initial_balance} onChange={(e) => setNewWallet({ ...newWallet, initial_balance: e.target.value.replace(/[^0-9]/g, '') })} /></div>
            <button className="ft-button ft-button-primary" style={{ width: '100%' }}>Buat dompet</button>
          </form>

          <form className="ft-card ft-settings-card" onSubmit={requestJoin}>
            <h2>Gabung ke dompet</h2>
            <p>Masukkan kode dari owner. Akses baru diberikan setelah owner menyetujui permintaan Anda.</p>
            <div className="ft-field"><label htmlFor="join-code">Kode undangan</label><input id="join-code" className="ft-input" value={joinCode} maxLength={10} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="10 karakter" required /></div>
            <button className="ft-button ft-button-secondary" style={{ width: '100%' }}><UserPlus size={17} />Kirim permintaan</button>
          </form>
        </div>

        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <section className="ft-card ft-settings-card">
            <h2>Bagikan dompet</h2>
            <p>Pilih dompet terlebih dahulu. Kode berlaku tujuh hari, hanya untuk satu permintaan, dan tidak langsung memberikan akses.</p>
            <div className="ft-field"><label htmlFor="share-wallet">Dompet yang dibagikan</label><select id="share-wallet" className="ft-input" value={selectedWallet} onChange={(e) => { setSelectedWallet(e.target.value); setInvite(null) }}><option value="">Pilih dompet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></div>
            <button className="ft-button ft-button-primary" onClick={generateInvite} disabled={!selectedWallet}>Buat kode undangan</button>
            {invite && <div className="ft-code"><div><span style={{ display: 'block', fontSize: 12, color: 'var(--ft-muted)', marginBottom: 5 }}>{invite.account}</span><strong>{invite.code}</strong></div><button className="ft-icon-button" title="Salin kode" onClick={() => navigator.clipboard.writeText(invite.code)}><Copy size={17} /></button></div>}
          </section>

          <section className="ft-card ft-settings-card">
            <h2>Permintaan bergabung</h2>
            <p>Periksa identitas pemohon sebelum memberikan akses mengelola dompet.</p>
            {requests.length === 0 ? <div className="ft-empty" style={{ minHeight: 130 }}>Belum ada permintaan.</div> : requests.map((request) => (
              <div className="ft-request" key={request.id}>
                <div><strong>{request.requester?.name || 'Pengguna'}</strong><span>{request.requester?.email}<br />Meminta akses ke {request.account?.name}</span></div>
                <div className="ft-row" style={{ gap: 7 }}><button className="ft-icon-button" title="Tolak" onClick={() => review(request.id, 'rejected')}><X size={17} /></button><button className="ft-icon-button" style={{ background: 'var(--ft-primary)', color: '#fff' }} title="Terima" onClick={() => review(request.id, 'accepted')}><Check size={17} /></button></div>
              </div>
            ))}
          </section>

          <section className="ft-card ft-settings-card">
            <h2>Kolaborator aktif</h2>
            <p>Kolaborator hanya dapat melihat dan mengelola dompet yang Anda bagikan.</p>
            {collaborators.length === 0 ? <div className="ft-empty" style={{ minHeight: 110 }}>Belum ada kolaborator aktif.</div> : collaborators.map((item) => (
              <div className="ft-request" key={`${item.account_id}:${item.user_id}`}>
                <div><strong>{item.user?.name || 'Pengguna'}</strong><span>{item.user?.email}<br />Akses ke {item.account?.name}</span></div>
                <button className="ft-button ft-button-danger" onClick={() => revokeAccess(item)}>Cabut akses</button>
              </div>
            ))}
          </section>
        </div>
      </div>
      <BottomNav />
    </main>
  )
}
