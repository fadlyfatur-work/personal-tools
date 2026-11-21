'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { AhspComponent } from '@/lib/ahsp'
import { useAhspAppearance } from '../appearance'
import swiss from '../swiss-red.module.css'
import styles from './ui.module.css'

type Submission = { id: string; item_id: string; components: AhspComponent[]; source_reference: string; submitted_at: string; items: { code: string; name: string; unit: string; field: string; regulation: string } | null }
export default function ApprovalPage() {
  const appearance = useAhspAppearance()
  const [authenticated, setAuthenticated] = useState(false), [pin, setPin] = useState(''), [queue, setQueue] = useState<Submission[]>([])
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState(''), [confirm, setConfirm] = useState<Record<string, boolean>>({}), [notes, setNotes] = useState<Record<string, string>>({})
  const load = useCallback(async () => {
    const response = await fetch('/api/ahsp/approval/submissions', { cache: 'no-store' }), body = await response.json()
    if (!response.ok) throw new Error(body.error)
    setQueue(body.submissions)
  }, [])
  useEffect(() => { fetch('/api/ahsp/approval/session').then(r => r.json()).then(async data => { if (data.authenticated) { setAuthenticated(true); try { await load() } catch (e) { setError(e instanceof Error ? e.message : 'Antrean gagal dimuat.') } } }) }, [load])
  async function login(event: React.FormEvent) { event.preventDefault(); setError(''); setBusy('login')
    try { const response = await fetch('/api/ahsp/approval/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }), body = await response.json(); if (!response.ok) throw new Error(body.error); setAuthenticated(true); setPin(''); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'PIN gagal diverifikasi.') } finally { setBusy('') }
  }
  async function review(item: Submission, action: 'approve'|'reject') { setBusy(item.id); setError(''); setSuccess('')
    try { const response = await fetch(`/api/ahsp/approval/submissions/${item.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note: notes[item.id] ?? '', confirmIdentity: confirm[item.id] ?? false }) }), body = await response.json(); if (!response.ok) throw new Error(body.error); setSuccess(action === 'approve' ? 'Analisis disetujui dan katalog diperbarui.' : 'Usulan ditolak.'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Keputusan gagal disimpan.') } finally { setBusy('') }
  }
  async function logout() { await fetch('/api/ahsp/approval/session', { method: 'DELETE' }); setAuthenticated(false); setQueue([]) }
  return <main className={`${swiss.page} ${styles.page}`} data-theme={appearance.mode} data-palette={appearance.palette}>
    <header><Link href="/ahsp">‹ Kembali ke Katalog AHSP</Link><div><h1>Approval analisis AHSP</h1><p>Periksa identitas pekerjaan, regulasi, sumber, dan rincian sebelum mengesahkan.</p></div>{authenticated && <button onClick={logout}>Keluar</button>}</header>
    {error && <p role="alert" className={styles.error}>{error}</p>}{success && <p role="status" className={styles.success}>{success}</p>}
    {!authenticated ? <form className={styles.login} onSubmit={login}><label>PIN admin<input autoComplete="current-password" inputMode="numeric" type="password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required value={pin} onChange={e => setPin(e.target.value)} /></label><button disabled={busy === 'login'}>{busy === 'login' ? 'Memeriksa…' : 'Buka antrean'}</button><p>PIN tidak disimpan di browser. Sesi berakhir otomatis setelah 20 menit.</p></form> : <section className={styles.queue} aria-label="Usulan menunggu approval"><h2>Menunggu approval <span>{queue.length}</span></h2>{!queue.length ? <p>Belum ada usulan yang menunggu.</p> : queue.map(row => <article key={row.id}>
      <header><h3>{row.items?.code || 'Tanpa kode'} · {row.items?.name}</h3><p>{row.items?.field} / {row.items?.regulation} / Satuan {row.items?.unit}</p></header>
      <p><strong>Sumber:</strong> {row.source_reference}</p><p><strong>Dikirim:</strong> {new Date(row.submitted_at).toLocaleString('id-ID')}</p>
      <div className={styles.components}>{row.components.map((c, i) => <div key={`${c.id}-${i}`}><strong>{c.group}: {c.name}</strong><span>{c.code || 'Tanpa kode'} · {c.unit} · Koefisien: {c.coefficient === null ? '—' : c.coefficient}{c.expression ? ` · Rumus: ${c.expression}` : ''}</span></div>)}</div>
      <label className={styles.confirm}><input type="checkbox" checked={confirm[row.id] ?? false} onChange={e => setConfirm(v => ({ ...v, [row.id]: e.target.checked }))} /> Saya sudah mencocokkan identitas, regulasi yang berlaku, sumber, dan rincian analisis.</label>
      <label>Catatan admin (wajib jika menolak)<textarea maxLength={1000} value={notes[row.id] ?? ''} onChange={e => setNotes(v => ({ ...v, [row.id]: e.target.value }))} /></label>
      <div className={styles.actions}><button disabled={busy === row.id || !confirm[row.id]} onClick={() => review(row, 'approve')}>Setujui dan perbarui katalog</button><button disabled={busy === row.id || (notes[row.id] ?? '').trim().length < 3} onClick={() => review(row, 'reject')}>Tolak usulan</button></div>
    </article>)}</section>}
  </main>
}
