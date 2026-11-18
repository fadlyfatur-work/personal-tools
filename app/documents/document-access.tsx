'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { toolsRequest } from '@/lib/tools/client'
import styles from './documents.module.css'
export type DocumentGrant = { tag: { id: string; name: string; kind: string } | null; admin: boolean; userId?: string | null; expiresAt?: number }
const grantScope = (access: DocumentGrant) => `${access.userId || 'pin'}:${access.admin ? 'admin' : 'public'}:${access.tag?.id || ''}`
export function DocumentAccess({ children }: { children: (access: DocumentGrant, reset: () => void) => ReactNode }) {
  const [access, setAccess] = useState<DocumentGrant | null>(null)
  const [checking, setChecking] = useState(true)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [changingPin, setChangingPin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scope = useRef('')
  const accessOperation = useRef({ epoch: 0, pending: false })
  const reset = useCallback(() => { setAccess(null); setPin(''); setShowPin(false); setChangingPin(false); setError('Akses dokumen berakhir. Masukkan PIN kembali.') }, [])
  useEffect(() => {
    const controller = new AbortController()
    const load = () => {
      if (accessOperation.current.pending) return
      const epoch = accessOperation.current.epoch
      toolsRequest<DocumentGrant>('/api/documents/access', { signal: controller.signal })
        .then(data => {
          if (controller.signal.aborted || epoch !== accessOperation.current.epoch) return
          const nextScope = grantScope(data)
          if (scope.current !== nextScope) { setPin(''); setShowPin(false); setChangingPin(false); setError('') }
          scope.current = nextScope
          setAccess(data)
        })
        .catch(err => { if (!controller.signal.aborted && epoch === accessOperation.current.epoch) { scope.current = ''; setAccess(null); setPin(''); setShowPin(false); setChangingPin(false); setError(err.message) } })
        .finally(() => { if (!controller.signal.aborted && epoch === accessOperation.current.epoch) setChecking(false) })
    }
    load()
    const refresh = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', refresh)
    return () => { controller.abort(); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  async function unlock() {
    accessOperation.current.pending = true; accessOperation.current.epoch += 1
    setBusy(true); setError('')
    try {
      const data = await toolsRequest<DocumentGrant>('/api/documents/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      scope.current = grantScope(data)
      setAccess(data); setPin(''); setShowPin(false); setChangingPin(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Akses belum dapat dibuka.') }
    finally { accessOperation.current.pending = false; setBusy(false) }
  }
  async function lock() {
    accessOperation.current.pending = true; accessOperation.current.epoch += 1
    scope.current = ''; setAccess(null); setPin(''); setShowPin(false); setChangingPin(false); setBusy(true); setError('')
    try { await toolsRequest('/api/documents/access', { method: 'DELETE' }) }
    catch (err) { setError(`Kunci akses belum tersimpan. ${err instanceof Error ? err.message : 'Coba lagi sebelum menutup halaman.'}`) }
    finally { accessOperation.current.pending = false; setBusy(false) }
  }
  function cancelChange() { setChangingPin(false); setPin(''); setShowPin(false); setError('') }
  function pinForm(changing: boolean) {
    return <section className={`${styles.panel} ${styles.accessPanel}`}>
      <h2>{changing ? 'Ganti koleksi dokumen' : 'Buka koleksi dokumen'}</h2><p className={styles.help}>{changing ? 'Masukkan PIN kelompok lain. Koleksi dan isian saat ini tetap tersedia sampai PIN baru berhasil diperiksa.' : 'Masukkan PIN dari pengelola instansi atau divisi. Akun tidak diperlukan.'}</p>
      <form onSubmit={event => { event.preventDefault(); void unlock() }}>
        <label className={styles.label} htmlFor="documents-pin">{changing ? 'PIN kelompok baru' : 'PIN kelompok dokumen'}</label>
        <div className={styles.pinControl}><input id="documents-pin" type={showPin ? 'text' : 'password'} inputMode="numeric" pattern="[0-9]{5,12}" minLength={5} maxLength={12} autoComplete="off" required disabled={busy} aria-describedby="documents-pin-hint" className={styles.input} value={pin} onChange={event => setPin(event.target.value)} />
        <button type="button" className={styles.secondary} aria-controls="documents-pin" aria-pressed={showPin} onClick={() => setShowPin(value => !value)}>{showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}</button></div>
        <p id="documents-pin-hint" className={styles.pinHint}>Gunakan 5-12 angka. Satu PIN membuka koleksi kelompok yang diberikan pengelola.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><button className={styles.button} disabled={busy}>{busy ? 'Memeriksa PIN…' : changing ? 'Buka koleksi baru' : 'Buka dokumen'}</button>{changing ? <button type="button" className={styles.secondary} disabled={busy} onClick={cancelChange}>Batal ganti PIN</button> : <Link className={styles.secondary} href="/documents/admin">Masuk sebagai admin</Link>}</div>
      </form>
    </section>
  }
  if (checking) return <p role="status" className={styles.panel}>Memeriksa akses dokumen…</p>
  if (access?.tag || access?.admin) return <div key={grantScope(access)}>
    <div className={styles.accessBar}><p>{access.tag?.name || 'Akses admin template'}</p><div className={styles.actions}><button disabled={busy || changingPin} className={styles.secondary} onClick={() => { setPin(''); setShowPin(false); setError(''); setChangingPin(true) }}>Ganti PIN kelompok</button><button disabled={busy} className={styles.secondary} onClick={() => void lock()}>Kunci dokumen</button>{access.admin && <Link className={styles.secondary} href="/documents/admin">Kelola template</Link>}</div></div>
    {changingPin ? pinForm(true) : null}
    <div key="collection">{children(access, reset)}</div>
  </div>
  return pinForm(false)
}
