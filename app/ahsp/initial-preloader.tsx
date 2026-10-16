'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import styles from './catalog.module.css'

export default function InitialPreloader({ pending, onExit }: { pending: boolean; onExit: (visible: boolean) => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    if (pending) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => onExit(false), reduced ? 0 : 180)
    return () => clearTimeout(timer)
  }, [pending, onExit])

  return <div className={styles.preloader} data-ready={!pending}>
    <div className={styles.preloaderContent} role="status" aria-live="polite" aria-atomic="true">
      <div className={styles.loaderMark} aria-hidden="true"><span className={styles.spinner} /></div>
      <p className={styles.loaderTitle}>Katalog AHSP</p>
      <p className={styles.loaderStatus}>{pending ? 'Memuat item pekerjaan…' : 'Menampilkan halaman…'}</p>
      <p className={styles.loaderHelp}>Menyiapkan daftar item dan sumber regulasi.</p>
    </div>
    <Link className={styles.preloaderBack} href="/menu">Kembali ke menu</Link>
  </div>
}
