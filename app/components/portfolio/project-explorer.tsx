'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ArrowRight } from '@phosphor-icons/react'
import { projects } from './data'
import styles from './portfolio.module.css'

export function ProjectExplorer() {
  const [selected, setSelected] = useState(0)
  const project = projects[selected]
  return <div className={styles.explorer}>
    <div className={styles.explorerHeading}><h2>Jelajahi proyek saya.</h2><a href="#projects" aria-label="Lihat seluruh proyek"><ArrowRight size={24} /></a></div>
    <div className={styles.explorerChoices} role="tablist" aria-label="Pilih proyek" onKeyDown={event => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
      if (!keys.includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? projects.length - 1 : (selected + (event.key === 'ArrowRight' ? 1 : -1) + projects.length) % projects.length
      setSelected(next)
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
    }}>
      {projects.map((item, index) => <button type="button" role="tab" key={item.id} id={`preview-tab-${item.id}`} aria-controls="project-preview" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)}>{item.title === 'Financial tracking (Fintrack)' ? 'Fintrack' : item.title}</button>)}
    </div>
    <div id="project-preview" role="tabpanel" aria-labelledby={`preview-tab-${project.id}`} tabIndex={0} className={styles.explorerPanel}>
      <div key={project.id} className={styles.projectReveal}>
        <h3>{project.title}</h3><p>{project.desc}</p>
        <div className={styles.explorerTags}>{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        {project.href ? <Link href={project.href}>Buka {selected === 1 ? 'Fintrack' : 'menu aplikasi'}<ArrowUpRight size={20} aria-hidden="true" /></Link> : <a href="#projects">Lihat dalam daftar proyek<ArrowRight size={20} aria-hidden="true" /></a>}
      </div>
    </div>
    <p className={styles.explorerNote}>Teknologi portofolio asal. Aplikasi saat ini memakai Next.js dan Supabase.</p>
  </div>
}

