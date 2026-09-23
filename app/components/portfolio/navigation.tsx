'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { List, X } from '@phosphor-icons/react'
import styles from './portfolio.module.css'

const links = [{ href: '#about', label: 'Tentang' }, { href: '#projects', label: 'Proyek' }, { href: '#contact', label: 'Kontak' }]
export function Navigation() {
  const disclosure = useRef<HTMLDetailsElement>(null)
  function close() { if (disclosure.current) disclosure.current.open = false }
  return <header className={styles.header}><div className={styles.navInner}>
    <Link href="/" className={styles.brand} aria-label="Fdly.dev — Beranda">Fdly<span>.dev</span></Link>
    <nav aria-label="Navigasi utama" className={styles.desktopNav}>
      {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
      <Link href="/menu" className={styles.menuLink}>Menu aplikasi</Link>
    </nav>
    <details ref={disclosure} className={styles.mobileNav} onKeyDown={event => {
      if (event.key === 'Escape') { close(); disclosure.current?.querySelector('summary')?.focus() }
    }}>
      <summary aria-label="Menu navigasi"><List className={styles.openIcon} size={24} aria-hidden="true" /><X className={styles.closeIcon} size={24} aria-hidden="true" /></summary>
      <nav aria-label="Navigasi ponsel" onClick={close}>
        {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
        <Link href="/menu">Menu aplikasi</Link>
      </nav>
    </details>
  </div></header>
}
