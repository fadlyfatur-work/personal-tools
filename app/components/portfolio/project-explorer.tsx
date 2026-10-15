'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ArrowRight } from '@phosphor-icons/react'
import { projects } from './data'
import styles from './portfolio.module.css'

const previews = [
  { src: '/portfolio/nominatif.webp', width: 1280, height: 720, alt: 'Nominatif menghitung contoh perjalanan Jakarta ke Palembang dengan rincian biaya per pegawai.', caption: 'Nominatif, salah satu aplikasi di Personal Tools.' },
  { src: '/portfolio/fintrack.webp', width: 430, height: 825, alt: 'Halaman masuk Fintrack dengan pilihan email dan PIN atau akun Google.', caption: 'Halaman masuk Fintrack. Data keuangan memerlukan autentikasi.' },
]

export function ProjectExplorer() {
  const [selected, setSelected] = useState(0)
  const project = projects[selected]
  const preview = previews[selected]
  return <div className={styles.explorer}>
    <div className={styles.explorerChoices} role="tablist" aria-label="Pilih proyek" onKeyDown={event => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
      if (!keys.includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? projects.length - 1 : (selected + (event.key === 'ArrowRight' ? 1 : -1) + projects.length) % projects.length
      setSelected(next)
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
    }}>
      {projects.map((item, index) => <button type="button" role="tab" key={item.id} id={`preview-tab-${item.id}`} aria-controls="project-preview" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)}>{item.id === 'fintrack' ? 'Fintrack' : item.title}</button>)}
    </div>
    <div id="project-preview" role="tabpanel" aria-labelledby={`preview-tab-${project.id}`} tabIndex={0}>
      <div key={project.id} className={`${styles.explorerPanel} ${styles.projectReveal}`}>
        <div className={styles.explorerCopy}>
          <h3>{project.title}</h3>
          <p>{project.desc}</p>
          <div className={styles.explorerTags}>{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          {project.href ? <Link className={styles.inlineLink} href={project.href}>{selected === 1 ? 'Buka Fintrack' : 'Menu aplikasi'}<ArrowUpRight size={20} aria-hidden="true" /></Link> : <a className={styles.inlineLink} href="#project-list">Lihat proyek<ArrowRight size={20} aria-hidden="true" /></a>}
          <p className={styles.explorerNote}>Teknologi portofolio asal. Aplikasi saat ini memakai Next.js dan Supabase.</p>
        </div>
        {preview ? <figure className={styles.projectPreview}>
          <div className={`${styles.previewImage} ${selected === 1 ? styles.portraitPreview : ''}`}>
            <Image src={preview.src} width={preview.width} height={preview.height} alt={preview.alt} loading={selected === 0 ? 'eager' : 'lazy'} fetchPriority={selected === 0 ? 'high' : 'auto'} sizes="(max-width: 767px) 100vw, 65vw" />
          </div>
          <figcaption>{preview.caption}</figcaption>
        </figure> : <div className={styles.projectDetails}>
          <p>Teknologi proyek</p>
          <ul>{project.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
          <span>Detail proyek tersedia pada daftar portofolio di bawah.</span>
        </div>}
      </div>
    </div>
  </div>
}
