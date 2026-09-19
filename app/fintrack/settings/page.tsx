'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Moon, SignOut, Sun, UserPlus, X } from '@phosphor-icons/react'
import { Header } from '../components/header'
import { BottomNav } from '../components/bottom-nav'
import { useFintrack } from '../components/fintrack-provider'
import { fintrackRequest } from '@/lib/fintrackRequest'

export default function FintrackSettingsPage() {
  const router = useRouter()
  const { data, user, palette, setPalette, theme, setTheme, loading, beginTask, endTask, isBusy, updateData, refreshData, clearCache } = useFintrack()
  const [pin, setPin] = useState('')
  const [selectedWallet, setSelectedWallet] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [invite, setInvite] = useState<{ code: string; account: string; expires_at: string } | null>(null)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  async function savePin(event: React.FormEvent) {
    event.preventDefault(); setMessage(null); beginTask('pin-save', 'Menyimpan PIN')
    try { const response = await fintrackRequest('/api/fintrack/security/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'PIN gagal disimpan'); setPin(''); updateData((current) => ({ ...current, has_pin: true })); setMessage({ kind: 'success', text: 'PIN berhasil disimpan.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'PIN gagal disimpan' }) } finally { endTask('pin-save') }
  }

  async function generateInvite() {
    if (!selectedWallet) return
    const confirmationPin = data?.has_pin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (data?.has_pin && !confirmationPin) return
    beginTask('invite-create', 'Membuat kode undangan')
    try { const response = await fintrackRequest('/api/fintrack/collaboration/invites', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(confirmationPin ? { 'x-fintrack-pin': confirmationPin } : {}) }, body: JSON.stringify({ account_id: selectedWallet }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kode gagal dibuat'); setInvite(body) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Kode gagal dibuat' }) } finally { endTask('invite-create') }
  }

  async function requestJoin(event: React.FormEvent) {
    event.preventDefault(); beginTask('join-request', 'Mengirim permintaan')
    try { const response = await fintrackRequest('/api/fintrack/collaboration/join-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: joinCode }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Permintaan gagal dikirim'); setJoinCode(''); setMessage({ kind: 'success', text: 'Permintaan sudah dikirim kepada owner.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Permintaan gagal dikirim' }) } finally { endTask('join-request') }
  }

  async function review(id: string, decision: 'accepted' | 'rejected') {
    const confirmationPin = data?.has_pin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (data?.has_pin && !confirmationPin) return
    beginTask('join-review', 'Memproses permintaan')
    try { const response = await fintrackRequest(`/api/fintrack/collaboration/join-requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(confirmationPin ? { 'x-fintrack-pin': confirmationPin } : {}) }, body: JSON.stringify({ decision }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Permintaan gagal diproses'); updateData((current) => ({ ...current, collaboration: { ...current.collaboration, pending_requests: current.collaboration.pending_requests.filter((request) => request.id !== id) } })); if (decision === 'accepted') await refreshData(); setMessage({ kind: 'success', text: decision === 'accepted' ? 'Kolaborator mendapat akses.' : 'Permintaan ditolak.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Permintaan gagal diproses' }) } finally { endTask('join-review') }
  }

  async function revoke(accountId: string, userId: string, name: string) {
    if (!window.confirm(`Cabut akses ${name}?`)) return
    const confirmationPin = data?.has_pin ? window.prompt('Masukkan PIN konfirmasi 6 digit') : null
    if (data?.has_pin && !confirmationPin) return
    beginTask('access-revoke', 'Mencabut akses')
    try { const response = await fintrackRequest(`/api/fintrack/collaboration/members/${accountId}/${userId}`, { method: 'DELETE', headers: confirmationPin ? { 'x-fintrack-pin': confirmationPin } : {} }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Akses gagal dicabut'); updateData((current) => ({ ...current, collaboration: { ...current.collaboration, collaborators: current.collaboration.collaborators.filter((item) => item.account_id !== accountId || item.user_id !== userId) } })); setMessage({ kind: 'success', text: 'Akses kolaborator dicabut.' }) } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Akses gagal dicabut' }) } finally { endTask('access-revoke') }
  }

  async function logout() {
    beginTask('logout', 'Mengakhiri sesi')
    try {
      await fintrackRequest('/api/fintrack/auth/logout', { method: 'POST' })
      clearCache()
      router.replace('/fintrack/login')
      router.refresh()
    } finally {
      endTask('logout')
    }
  }

  if (loading) return <div className="ft-skeleton" aria-hidden="true"><div className="ft-skeleton-line" style={{ width: 150 }} /><div className="ft-skeleton-line" style={{ height: 240, marginTop: 28 }} /></div>
  if (!user || !data) return null
  const collaboration = data.collaboration

  return <main className="ft-container"><Header user={user} eyebrow="Preferensi pribadi" title="Pengaturan" settings />{message && <p className={`ft-inline-message ft-${message.kind}`}>{message.text}</p>}
    <section className="ft-card ft-settings-card ft-palette-card"><div className="ft-theme-row"><span className="ft-account-icon">{theme === 'dark' ? <Moon size={18} weight="fill" /> : <Sun size={18} weight="fill" />}</span><div><strong>Mode gelap</strong><span>{theme === 'dark' ? 'Aktif' : 'Nonaktif'}</span></div><button className={`ft-switch${theme === 'dark' ? '' : ' off'}`} type="button" role="switch" aria-checked={theme === 'dark'} aria-label="Aktifkan mode gelap" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><span /></button></div><div className="ft-settings-divider" /><h2>Palet warna</h2><p>Pilih suasana yang nyaman. Disimpan hanya di perangkat ini.</p><div className="ft-palette-options" role="radiogroup" aria-label="Palet warna FinTrack">{([['forest', 'Rimba'], ['ocean', 'Laut'], ['earth', 'Tanah']] as const).map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={palette === value} data-palette-option={value} onClick={() => setPalette(value)}><span aria-hidden="true"><i /><i /><i /></span>{label}{palette === value && <Check size={16} weight="bold" />}</button>)}</div></section>
    <form className="ft-card ft-settings-card" onSubmit={savePin} data-updating={isBusy('pin-save')}><h2>PIN FinTrack</h2><p>{data.has_pin ? 'PIN aktif untuk login cepat dan tindakan sensitif.' : 'Aktifkan PIN untuk login cepat tanpa membuka Google berulang kali.'}</p><div className="ft-field"><label htmlFor="security-pin">PIN 6 digit</label><input id="security-pin" className="ft-input" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ''))} required /></div><button className="ft-button ft-button-secondary" style={{ width: '100%' }}>{data.has_pin ? 'Ganti PIN' : 'Aktifkan PIN'}</button></form>
    <section className="ft-section"><div className="ft-section-heading"><div><h2>Kolaborasi dompet</h2><p>Undangan selalu terikat pada dompet yang dipilih.</p></div></div><section className="ft-card ft-settings-card" data-updating={isBusy('invite-create')}><h2>Bagikan dompet</h2><div className="ft-field"><label htmlFor="share-wallet">Dompet</label><select id="share-wallet" className="ft-input" value={selectedWallet} onChange={(event) => { setSelectedWallet(event.target.value); setInvite(null) }}><option value="">Pilih dompet</option>{collaboration.owned_accounts.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></div><button className="ft-button ft-button-primary" disabled={!selectedWallet} onClick={generateInvite}>Buat kode undangan</button>{invite && <div className="ft-code"><div><span>{invite.account}</span><strong>{invite.code}</strong></div><button className="ft-icon-button" title="Salin kode" onClick={() => navigator.clipboard.writeText(invite.code)}><Copy size={17} /></button></div>}</section>
      <form className="ft-card ft-settings-card" onSubmit={requestJoin} data-updating={isBusy('join-request')}><h2>Gabung ke dompet</h2><p>Owner harus menyetujui permintaan sebelum akses diberikan.</p><div className="ft-field"><label htmlFor="join-code">Kode undangan</label><input id="join-code" className="ft-input" value={joinCode} maxLength={10} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} required /></div><button className="ft-button ft-button-secondary" style={{ width: '100%' }}><UserPlus size={17} />Kirim permintaan</button></form>
      {collaboration.pending_requests.length > 0 && <section className="ft-card ft-settings-card" data-updating={isBusy('join-review')}><h2>Permintaan bergabung</h2>{collaboration.pending_requests.map((request) => <div className="ft-request" key={request.id}><div><strong>{request.requester?.name || 'Pengguna'}</strong><span>{request.requester?.email}<br />Meminta akses ke {request.account?.name}</span></div><div className="ft-row" style={{ gap: 7 }}><button className="ft-icon-button" title="Tolak" onClick={() => review(request.id, 'rejected')}><X size={17} /></button><button className="ft-icon-button ft-accept" title="Terima" onClick={() => review(request.id, 'accepted')}><Check size={17} /></button></div></div>)}</section>}
      {collaboration.collaborators.length > 0 && <section className="ft-card ft-settings-card" data-updating={isBusy('access-revoke')}><h2>Kolaborator aktif</h2>{collaboration.collaborators.map((item) => <div className="ft-request" key={`${item.account_id}:${item.user_id}`}><div><strong>{item.user?.name || 'Pengguna'}</strong><span>{item.user?.email}<br />Akses ke {item.account?.name}</span></div><button className="ft-button ft-button-danger" onClick={() => revoke(item.account_id, item.user_id, item.user?.name || 'kolaborator')}>Cabut</button></div>)}</section>}
    </section><button className="ft-button ft-button-danger ft-logout-button" type="button" onClick={logout} disabled={isBusy('logout')}><SignOut size={18} />Keluar dan hapus cache sesi</button><BottomNav /></main>
}
