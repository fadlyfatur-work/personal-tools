import type { Metadata } from 'next'
import Link from 'next/link'
import { Outfit } from 'next/font/google'
import { ArrowUpRight, ArrowDown, GithubLogo, LinkedinLogo, InstagramLogo } from '@phosphor-icons/react/dist/ssr'
import { Navigation } from './components/portfolio/navigation'
import { ProjectList } from './components/portfolio/project-list'
import { ContactActions } from './components/portfolio/contact-actions'
import { skills, socials } from './components/portfolio/data'
import styles from './components/portfolio/portfolio.module.css'

const outfit = Outfit({ subsets: ['latin'], display: 'swap' })
const description = 'Fadly Faturrohman, Fullstack Developer. Membangun aplikasi web dari perencanaan proses bisnis, backend dan frontend hingga deployment.'
export const metadata: Metadata = {
  title: 'Fadly Faturrohman — Fullstack Developer', description,
  openGraph: { title: 'Fadly Faturrohman — Fullstack Developer', description, type: 'website', locale: 'id_ID' },
  twitter: { card: 'summary', title: 'Fadly Faturrohman — Fullstack Developer', description },
}
const socialIcons = [GithubLogo, LinkedinLogo, InstagramLogo]

export default function Home() {
  return <div className={`${styles.portfolio} ${outfit.className}`}>
    <a className={styles.skipLink} href="#main">Lewati ke konten</a>
    <Navigation />
    <main id="main" className={styles.container}>
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroTitle}>
          <h1 id="hero-title">Developer.<br />Pengembangan<br className={styles.heroBreak} /> sistem.</h1>
          <a className={styles.primaryButton} href="#projects">Lihat proyek<ArrowDown size={20} aria-hidden="true" /></a>
        </div>
        <div className={styles.heroIntro}>
          <p className={styles.availability}><span aria-hidden="true" />Tersedia untuk proyek baru</p>
          <p className={styles.introName}>Saya Fadly Faturrohman.</p>
          <p>Fullstack Developer dengan spesialisasi backend, frontend (UI/UX), dan perencanaan proses bisnis sistem. Saya membangun aplikasi web dari perencanaan hingga deployment.</p>
          <a className={styles.inlineLink} href="#contact">Mari berdiskusi<ArrowUpRight size={20} aria-hidden="true" /></a>
        </div>
      </section>
      <section id="about" className={`${styles.section} ${styles.about}`} aria-labelledby="about-title">
        <h2 id="about-title">Dari ide hingga<br />aplikasi berjalan.</h2>
        <div><p className={styles.lead}>Membangun aplikasi web dari end-to-end — frontend seperti React dan Vue yang interaktif, hingga backend Laravel, Node.js, dan Go yang scalable, juga infrastruktur container dengan Docker.</p><p className={styles.muted}>Kode bersih dan arsitektur terstruktur.</p><div className={styles.socials}>{socials.map((social, index) => { const Icon = socialIcons[index]; return <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer"><Icon size={20} aria-hidden="true" />{social.name}<span className={styles.srOnly}> (tab baru)</span></a> })}</div></div>
      </section>
      <section id="projects" className={styles.section} aria-labelledby="projects-title">
        <div className={styles.sectionHeading}><h2 id="projects-title">Proyek</h2><p>Eksplorasi sistem, aplikasi, dan infrastruktur.</p></div>
        <ProjectList />
        <p className={styles.projectNote}>Teknologi di atas mengikuti versi proyek portofolio asal. Menu aplikasi dan Fintrack di situs ini berjalan dengan Next.js dan Supabase.</p>
      </section>
      <section className={`${styles.section} ${styles.skillSection}`} aria-labelledby="skills-title"><div><h2 id="skills-title">Teknologi<br />yang saya gunakan.</h2><p className={styles.muted}>Dari antarmuka hingga infrastruktur.</p></div><ul className={styles.skills}>{skills.map(skill => <li key={skill}>{skill}</li>)}</ul></section>
      <section id="contact" className={`${styles.section} ${styles.contact}`} aria-labelledby="contact-title"><p className={styles.availability}><span aria-hidden="true" />Terbuka untuk full-time dan kontrak</p><h2 id="contact-title">Let’s build<br />something great.</h2><p className={styles.muted}>Punya proyek atau ingin bekerja bersama? Mari mulai percakapan.</p><ContactActions /></section>
    </main>
    <footer className={styles.footer}><div className={styles.container}><span>Fadly Faturrohman</span><div>{socials.map(social => <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer">{social.name}<span className={styles.srOnly}> (tab baru)</span></a>)}<Link href="/menu">Menu aplikasi</Link></div></div></footer>
  </div>
}
