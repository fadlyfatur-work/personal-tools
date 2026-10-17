'use client'

import { useEffect, useRef, useState } from 'react'
import { FloppyDisk } from '@phosphor-icons/react'
import { deleteRabSession, listRabSessions, readRabSession, saveRabSession, type RabSavedSession, type RabSavedSummary } from '@/lib/ahspRabStorage'
import base from '../catalog.module.css'
import styles from './reconciliation.module.css'

export default function SavedSessions({ current, activeId, disabled, onRestore, onSaved }: {
  current: Omit<RabSavedSession, 'version' | 'id' | 'name' | 'savedAt'> | null;
  activeId: string | null; disabled: boolean; onRestore: (session: RabSavedSession) => void;
  onSaved: (session: RabSavedSession) => void;
}) {
  const [sessions, setSessions] = useState<RabSavedSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [name, setName] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (saveOpen) dialog.current?.showModal() }, [saveOpen])
  useEffect(() => { let active = true; listRabSessions().then(data => { if (active) setSessions(data) }).catch(() => { if (active) setError('Simpanan belum dapat dibaca. Pastikan penyimpanan browser diizinkan.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])
  async function save() {
    if (!current || !name.trim() || busy) return
    setBusy(true); setError('')
    try {
      const session: RabSavedSession = { ...current, version: 1, id: activeId ?? crypto.randomUUID(), name: name.trim(), savedAt: new Date().toISOString() }
      await saveRabSession(session)
      onSaved(session); dialog.current?.close()
      setSessions(await listRabSessions()); setStatus(`“${session.name}” tersimpan di browser ini.`)
    } catch (error) { setError(error instanceof Error ? error.message : 'Perhitungan belum berhasil disimpan.') }
    finally { setBusy(false) }
  }
  async function open(id: string) {
    if (busy || disabled) return
    setBusy(true); setError(''); setStatus('')
    try { onRestore(await readRabSession(id)) } catch (error) { setError(error instanceof Error ? error.message : 'Simpanan belum dapat dibuka.') }
    finally { setBusy(false) }
  }
  async function remove(session: RabSavedSummary) {
    if (!window.confirm(`Hapus simpanan “${session.name}” dari browser ini?`)) return
    setBusy(true); setError('')
    try { await deleteRabSession(session.id); setSessions(await listRabSessions()); setStatus(`Simpanan “${session.name}” dihapus.`) }
    catch { setError('Simpanan belum dapat dihapus. Coba lagi.') }
    finally { setBusy(false) }
  }
  return <section className={styles.savedPanel} data-rab-panel aria-label="Perhitungan tersimpan">
    <div className={styles.savedHeader}><div><h2>Perhitungan tersimpan</h2><p className={styles.help}>Disimpan di browser dan perangkat ini. Menghapus data situs akan menghapus simpanan.</p></div>{current && <button type="button" data-rab-save disabled={disabled || busy || loading} onClick={() => { setName(sessions.find(session => session.id === activeId)?.name ?? current.filename.replace(/\.xlsx$/i, '')); setError(''); setSaveOpen(true) }}><FloppyDisk size={18} aria-hidden="true" />Simpan perhitungan</button>}</div>
    {(loading || busy) && <p className={base.loadingIndicator} role="status"><span className={base.spinner} aria-hidden="true" />{loading ? 'Memuat simpanan…' : 'Memproses simpanan…'}</p>}
    {status && <p className={styles.notice} role="status">{status}</p>}
    {error && !saveOpen && <p className={styles.problem} role="alert">{error}</p>}
    {!loading && <details><summary>{sessions.length ? `${sessions.length} perhitungan tersedia` : 'Belum ada perhitungan tersimpan'}</summary>{sessions.length > 0 && <ul className={styles.savedList}>{sessions.map(session => <li key={session.id}><div><strong>{session.name}</strong><small>{session.filename} · {session.count} item · {new Date(session.savedAt).toLocaleString('id-ID')}</small></div><button type="button" disabled={disabled || busy} onClick={() => { void open(session.id) }}>Buka</button><button type="button" disabled={disabled || busy} onClick={() => { void remove(session) }}>Hapus</button></li>)}</ul>}</details>}
    <dialog ref={dialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="save-rab-title" onClose={() => setSaveOpen(false)} onCancel={event => { if (busy) event.preventDefault() }}>
      <div className={styles.modalHeader}><h2 id="save-rab-title">Simpan perhitungan</h2><button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Tutup</button></div>
      <form className={styles.modalBody} onSubmit={event => { event.preventDefault(); void save() }}><label>Nama perhitungan<input autoFocus required maxLength={160} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label><p className={styles.help}>Sheet terpilih, koreksi, keputusan pasangan, dan rekap komponen yang sudah dimuat ikut disimpan.</p>{activeId && <p className={styles.help}>Menyimpan akan memperbarui perhitungan yang sedang dibuka.</p>}{error && <p className={styles.problem} role="alert">{error}</p>}<div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy || !name.trim()}>{busy && <span className={base.spinner} aria-hidden="true" />}{busy ? 'Menyimpan…' : 'Simpan'}</button></div></form>
    </dialog>
  </section>
}
