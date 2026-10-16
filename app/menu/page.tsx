import Link from 'next/link'
import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { ArrowUpRight, Wallet, ClipboardText, FileText, TimerIcon, Calculator } from '@phosphor-icons/react/dist/ssr'
import { Navigation } from '../components/portfolio/navigation'
import { ScrollReveal } from '../components/portfolio/scroll-reveal'
import styles from '../components/portfolio/portfolio.module.css'
import menu from './menu.module.css'

const outfit = Outfit({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Menu aplikasi | Personal Tools',
  description: 'Pilih katalog AHSP, Fintrack, Paste Text, Nominatif, atau Time Mark.',
}

const features = [
  { href: '/ahsp', title: 'Katalog AHSP 2026', desc: 'Telusuri pekerjaan, komponen analisis, kalkulator, dan status rekonsiliasi.', icon: <Calculator size={32} aria-hidden="true" /> },
  { href: '/fintrack', title: 'Fintrack', desc: 'Kelola dompet & transaksi. Login PIN 6 digit.', icon: <Wallet size={32} aria-hidden="true" /> },
  { href: '/paste', title: 'Paste Text', desc: 'Bagikan teks dengan kode singkat.', icon: <ClipboardText size={32} aria-hidden="true" /> },
  { href: '/nominatif', title: 'Nominatif Perjalanan Dinas', desc: 'Hitung rincian biaya sesuai aturan dan ekspor Excel.', icon: <FileText size={32} aria-hidden="true" /> },
  { href: '/timemark', title: 'Time Mark', desc: 'Catat waktu dan manajemen tugas.', icon: <TimerIcon size={32} aria-hidden="true" /> },
]

export default function Menu() {
  return <div className={`${styles.portfolio} ${outfit.className} ${menu.menu}`}>
    <a className={styles.skipLink} href="#main">Lewati ke konten</a>
    <Navigation isMenu />
    <main id="main" className={styles.container}>
      <ScrollReveal />
      <section id="applications" aria-labelledby="menu-title">
        <header className={menu.titleBar}>
          <h1 id="menu-title">Personal <span>Tools</span></h1>
          <span className={menu.count}>{features.length} aplikasi</span>
        </header>
        <div className={menu.catalogArea}>
          <ul className={menu.catalog}>
            {features.map((feature, index) => <li key={feature.href} data-scroll-reveal={index === 0 || index === 4 ? 'scale' : 'slide'} data-reveal-delay={index % 2 * 70}>
              <Link href={feature.href} className={menu.toolLink} aria-labelledby={`tool-${index}-title`} aria-describedby={`tool-${index}-description`}>
                <span className={menu.toolIcon}>{feature.icon}</span>
                <div className={menu.toolCopy}>
                  <h2 id={`tool-${index}-title`}>{feature.title}</h2>
                  <p id={`tool-${index}-description`}>{feature.desc}</p>
                </div>
                <ArrowUpRight className={menu.open} size={20} aria-hidden="true" />
              </Link>
            </li>)}
          </ul>
        </div>
      </section>
    </main>
    <footer className={menu.footer}><Link href="/">Kembali ke portofolio<ArrowUpRight size={16} aria-hidden="true" /></Link></footer>
  </div>
}
