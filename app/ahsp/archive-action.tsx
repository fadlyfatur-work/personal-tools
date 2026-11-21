'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Archive } from '@phosphor-icons/react'
import type { AhspItem } from '@/lib/ahsp'
import styles from './catalog.module.css'
import swiss from './swiss-red.module.css'

const subscribeClient = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export default function ArchiveAction({ item, theme, palette, onArchived, onCancel }: { item: AhspItem; theme: string; palette: string; onArchived: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const mounted = useSyncExternalStore(subscribeClient, getClientSnapshot, getServerSnapshot)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await fetch('/api/ahsp/approval/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
      })
      const sessionBody = await session.json()
      if (!session.ok) throw new Error(sessionBody.error || 'PIN tidak dapat diverifikasi.')
      const response = await fetch('/api/ahsp/approval/archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Pengarsipan gagal.')
      setPin('')
      dialog.current?.close()
      onArchived()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Item belum dapat diarsipkan.')
    } finally { setBusy(false) }
  }

  const cancel = () => {
    if (busy) return
    dialog.current?.close()
    onCancel()
  }

  const confirmation = <dialog ref={dialog} className={`${swiss.page} ${styles.archiveDialog}`} data-theme={theme} data-palette={palette} aria-labelledby="archive-item-title" aria-describedby="archive-item-description" onClose={() => setPin('')} onCancel={event => { event.preventDefault(); cancel() }}>
    <form onSubmit={submit}>
      <header className={styles.archiveHeading}>
        <span className={styles.archiveGlyph} aria-hidden="true"><Archive size={22} /></span>
        <div><h2 id="archive-item-title">Arsipkan item pekerjaan?</h2><p id="archive-item-description">Item ini akan disembunyikan dari katalog aktif dan pencocokan.</p></div>
      </header>
      <section className={styles.archiveItem} aria-label="Item yang akan diarsipkan">
        <strong>{item.code || 'Tanpa kode'}</strong>
        <p>{item.name}</p>
      </section>
      <p className={styles.archiveNote}>Data tetap tersimpan dan dapat dilihat dari daftar arsip.</p>
      <label>PIN admin<input autoFocus autoComplete="current-password" inputMode="numeric" type="password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required value={pin} onChange={event => setPin(event.target.value)} disabled={busy} /></label>
      {error && <p className={styles.archiveError} role="alert">{error}</p>}
      <footer className={styles.archiveActions}><button type="button" className={styles.archiveCancel} disabled={busy} onClick={cancel}>Batal</button><button type="submit" className={styles.archiveConfirm} disabled={busy || !/^\d{6,12}$/.test(pin)}>{busy ? 'Memeriksa PIN…' : 'Arsipkan item'}</button></footer>
    </form>
  </dialog>

  return <>
    <button type="button" className={styles.archiveAction} aria-label={`Arsipkan ${item.code || item.name}`} title="Arsipkan item pekerjaan" onClick={() => { setError(''); dialog.current?.showModal() }}>
      <Archive size={20} aria-hidden="true" />
    </button>
    {mounted && createPortal(confirmation, document.body)}
  </>
}
