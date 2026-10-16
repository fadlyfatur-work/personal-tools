import type { Metadata } from 'next'
import Link from 'next/link'
import { Outfit } from 'next/font/google'
import { ArrowUpRight, ArrowDown, GithubLogo, LinkedinLogo, InstagramLogo } from '@phosphor-icons/react/dist/ssr'
import { ProjectExplorer } from './components/portfolio/project-explorer'
import { Navigation } from './components/portfolio/navigation'
import { ProjectList } from './components/portfolio/project-list'
import { ContactActions } from './components/portfolio/contact-actions'
import { ScrollReveal } from './components/portfolio/scroll-reveal'
import { skills, socials } from './components/portfolio/data'
import styles from './components/portfolio/portfolio.module.css'

const outfit = Outfit({ subsets: ['latin'], display: 'swap' })
const description = 'Fadly Faturrohman, Fullstack Developer. Membangun aplikasi web dari perencanaan proses bisnis, backend dan frontend hingga deployment.'
export const metadata: Metadata = {
  title: 'Fadly Faturrohman | Fullstack Developer', description,
  openGraph: { title: 'Fadly Faturrohman | Fullstack Developer', description, type: 'website', locale: 'id_ID' },
  twitter: { card: 'summary', title: 'Fadly Faturrohman | Fullstack Developer', description },
}
const socialIcons = [GithubLogo, LinkedinLogo, InstagramLogo]

export default function Home() {
  return <div className={`${styles.portfolio} ${outfit.className}`}>
    <a className={styles.skipLink} href="#main">Lewati ke konten</a>
    <Navigation />
    <main id="main" className={styles.container}>
      <ScrollReveal />
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.sectionBar}><span>01 / Perkenalan</span><span>Portofolio pengembangan web</span></div>
        <div className={styles.heroTitle}>
          <p className={styles.heroIdentity}>Fadly Faturrohman <span>Fullstack Developer</span></p>
          <h1 id="hero-title">Dari ide menjadi<br /><span>aplikasi yang berjalan.</span></h1>
          <p className={styles.heroDescription}>Membangun aplikasi web dari perencanaan proses bisnis, backend dan frontend hingga deployment.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#projects">Lihat proyek<ArrowDown size={18} aria-hidden="true" /></a>
            <Link className={styles.secondaryButton} href="/menu">Menu aplikasi<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <section id="projects" className={styles.section} aria-labelledby="projects-title">
        <div className={styles.sectionBar}><span>02 / Proyek</span><span>Aplikasi, sistem, dan infrastruktur</span></div>
        <div className={styles.sectionBody}>
          <div className={styles.sectionHeading} data-scroll-reveal><h2 id="projects-title">Jelajahi <span>proyek saya.</span></h2></div>
          <ProjectExplorer />
          <div className={styles.listHeading} data-scroll-reveal><h3>Seluruh proyek</h3><p>Simpan favorit dan atur urutan sesuai kebutuhan Anda.</p></div>
          <ProjectList />
          <p className={styles.projectNote}>Teknologi di atas mengikuti versi proyek portofolio asal. Menu aplikasi dan Fintrack di situs ini berjalan dengan Next.js dan Supabase.</p>
        </div>
      </section>

      <section id="about" className={styles.section} aria-labelledby="about-title">
        <div className={styles.sectionBar}><span>03 / Tentang</span><span>Fadly Faturrohman</span></div>
        <div className={`${styles.sectionBody} ${styles.about}`}>
          <div className={styles.aboutTitle} data-scroll-reveal>
            <p className={styles.availability}>Tersedia untuk proyek baru</p>
            <h2 id="about-title">Dari ide hingga<br /><span>aplikasi berjalan.</span></h2>
            <a className={styles.inlineLink} href="#contact">Kontak<ArrowUpRight size={20} aria-hidden="true" /></a>
          </div>
          <div data-scroll-reveal data-reveal-delay="90">
            <p className={styles.introName}>Saya Fadly Faturrohman.</p>
            <p className={styles.muted}>Fullstack Developer dengan spesialisasi backend, frontend (UI/UX), dan perencanaan proses bisnis sistem. Saya membangun aplikasi web dari perencanaan hingga deployment.</p>
            <p className={styles.lead}>Membangun aplikasi web dari end-to-end, frontend seperti React dan Vue yang interaktif, hingga backend Laravel, Node.js, dan Go yang scalable, juga infrastruktur container dengan Docker.</p>
            <p className={styles.muted}>Kode bersih dan arsitektur terstruktur.</p>
            <div className={styles.socials}>{socials.map((social, index) => {
              const Icon = socialIcons[index]
              return <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer"><Icon size={20} aria-hidden="true" />{social.name}<span className={styles.srOnly}> (tab baru)</span></a>
            })}</div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="skills-title">
        <div className={styles.sectionBar}><span>04 / Teknologi</span><span>Dari antarmuka hingga infrastruktur</span></div>
        <div className={`${styles.sectionBody} ${styles.skillSection}`}>
          <h2 id="skills-title" data-scroll-reveal>Teknologi yang<br /><span>saya gunakan.</span></h2>
          <ul className={styles.skills} data-scroll-reveal="scale" data-reveal-delay="90">{skills.map(skill => <li key={skill}>{skill}</li>)}</ul>
        </div>
      </section>

      <section id="contact" className={styles.section} aria-labelledby="contact-title">
        <div className={styles.sectionBar}><span>05 / Kontak</span><span>Mari bekerja bersama</span></div>
        <div className={`${styles.sectionBody} ${styles.contact}`} data-scroll-reveal>
          <p className={styles.availability}>Terbuka untuk full-time dan kontrak</p>
          <h2 id="contact-title">Diskusikan<br /><span>proyek web Anda.</span></h2>
          <p className={styles.muted}>Punya proyek atau ingin bekerja bersama? Mari mulai percakapan.</p>
          <ContactActions />
        </div>
      </section>
    </main>
    <footer className={styles.footer}><div className={styles.footerInner}>
      <span>Fadly Faturrohman</span>
      <div>{socials.map(social => <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer">{social.name}<span className={styles.srOnly}> (tab baru)</span></a>)}<Link href="/menu">Menu aplikasi</Link></div>
    </div></footer>
  </div>
}
