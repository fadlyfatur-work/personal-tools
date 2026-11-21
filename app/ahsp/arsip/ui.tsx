'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Trash } from '@phosphor-icons/react'
import { useAhspAppearance } from '../appearance'
import PageSlider from '../page-slider'
import swiss from '../swiss-red.module.css'
import styles from './ui.module.css'

type ArchivedItem = { id: string; code: string; name: string; unit: string; field: string; regulation: string; archived_at: string }

export default function ArchivePage() {
  const appearance = useAhspAppearance()
  const [pin, setPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [checked, setChecked] = useState(false)
  const [items, setItems] = useState<ArchivedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (target = page, signal?: AbortSignal) => {
    const response = await fetch(`/api/ahsp/approval/archive?page=${target}`, { cache: 'no-store', signal })
    const body = await response.json()
    if (response.status === 401) { setAuthenticated(false); setChecked(true); return }
    if (!response.ok) throw new Error(body.error || 'Arsip gagal dimuat.')
    setAuthenticated(true)
    setItems(body.items)
    setTotal(body.total)
    setChecked(true)
  }, [page])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/ahsp/approval/archive?page=${page}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (controller.signal.aborted) return
        if (response.status === 401) { setAuthenticated(false); setChecked(true); return }
        if (!response.ok) throw new Error(body.error || 'Arsip gagal dimuat.')
        setAuthenticated(true); setItems(body.items); setTotal(body.total); setChecked(true)
      })
      .catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Arsip gagal dimuat.'); setChecked(true) } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [page])

  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/ahsp/approval/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'PIN tidak dapat diverifikasi.')
      setPin(''); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PIN tidak dapat diverifikasi.') }
    finally { setBusy(false) }
  }

  async function logout() {
    await fetch('/api/ahsp/approval/session', { method: 'DELETE' })
    setAuthenticated(false); setItems([]); setTotal(0)
  }

  const pages = Math.max(1, Math.ceil(total / 30))

  return <main className={`${swiss.page} ${styles.page}`} data-theme={appearance.mode} data-palette={appearance.palette}>
    <header className={styles.header}>
      <Link href="/ahsp" aria-label="Kembali ke katalog AHSP"><ArrowLeft size={18} aria-hidden="true" />Katalog AHSP</Link>
      <div><h1><Trash size={22} aria-hidden="true" /> Arsip item pekerjaan</h1><p>Item diarsipkan tidak tampil pada katalog aktif dan pencocokan.</p></div>
      {authenticated && <button type="button" onClick={logout}>Keluar</button>}
    </header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!checked ? <p role="status">Memeriksa akses…</p>
      : !authenticated ? <form className={styles.login} onSubmit={login}>
        <h2>PIN admin diperlukan</h2>
        <p>Masukkan PIN admin untuk membuka daftar arsip item pekerjaan.</p>
        <label>PIN admin<input autoComplete="current-password" inputMode="numeric" type="password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required value={pin} onChange={event => setPin(event.target.value)} /></label>
        <button type="submit" disabled={busy || !/^\d{6,12}$/.test(pin)}>{busy ? 'Memeriksa PIN…' : 'Buka arsip'}</button>
      </form>
      : <section className={styles.archiveList} aria-label="Daftar item pekerjaan diarsipkan">
        <div className={styles.listHeading}><h2>Item diarsipkan</h2><span>{total.toLocaleString('id-ID')} item</span></div>
        {items.length === 0 ? <p className={styles.empty}>Belum ada item pekerjaan yang diarsipkan.</p> : <ul>{items.map(item => <li key={item.id}>
          <div><strong>{item.code || 'Tanpa kode'} · {item.name}</strong><p>{item.field} · {item.unit || 'Satuan belum tersedia'} · {item.regulation}</p></div>
          <time dateTime={item.archived_at}>{new Date(item.archived_at).toLocaleString('id-ID')}</time>
        </li>)}</ul>}
        {total > 0 && <PageSlider page={page} pages={pages} label="Halaman arsip" loading={busy} onPageChange={next => { setError(''); setBusy(true); setPage(next) }} />}
      </section>}
  </main>
}
