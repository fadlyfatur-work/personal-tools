import type { Metadata } from 'next'
import Link from 'next/link'
import { Outfit } from 'next/font/google'
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr'
import { PasteWorkspace } from './paste-workspace'
import portfolio from '../components/portfolio/portfolio.module.css'
import styles from './paste.module.css'

const outfit = Outfit({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Paste Text | Personal Tools',
  description: 'Bagikan teks dengan kode singkat. Buat kode di satu perangkat, lalu buka teks di perangkat lain.',
}

export default function PastePage() {
  return <div className={`${portfolio.portfolio} ${outfit.className} ${styles.page}`}>
    <a className={portfolio.skipLink} href="#main">Lewati ke konten</a>
    <header className={portfolio.header}>
      <div className={portfolio.navInner}>
        <Link href="/" className={portfolio.brand} aria-label="Fdly.dev, Beranda">Fdly<span>.dev</span></Link>
        <Link href="/menu" className={styles.backLink}><ArrowLeft size={18} aria-hidden="true" />Menu aplikasi</Link>
      </div>
    </header>
    <main id="main" className={portfolio.container}>
      <div className={portfolio.sectionBar}><span>Personal Tools / Paste Text</span><span>Berbagi teks</span></div>
      <header className={styles.intro}>
        <h1>Paste <span>Text</span></h1>
        <p>Bagikan teks dengan kode singkat.</p>
      </header>
      <PasteWorkspace />
      <footer className={styles.footer}>
        <p>Buat kode di satu perangkat, buka teks di perangkat lain.</p>
        <span>Personal Tools</span>
      </footer>
    </main>
  </div>
}
