'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpRight, BookmarkSimple, DotsSixVertical } from '@phosphor-icons/react'
import { projects } from './data'
import { saveProjectPreference, useProjectPreferences } from './project-preferences'
import styles from './portfolio.module.css'

export function ProjectList() {
  const { order, favorites, ready, error } = useProjectPreferences()
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [message, setMessage] = useState('')
  const [dragged, setDragged] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)

  function save(kind: 'order' | 'favorites', value: string[], success: string) {
    saveProjectPreference(kind, value)
    setMessage(success)
  }
  function bookmark(id: string) {
    const selected = favorites.includes(id)
    const next = selected ? favorites.filter(value => value !== id) : [...favorites, id]
    save('favorites', next, `${projects.find(project => project.id === id)?.title} ${selected ? 'dihapus dari' : 'ditambahkan ke'} favorit.`)
  }
  function move(id: string, target: number) {
    const from = order.indexOf(id)
    if (from < 0 || target < 0 || target >= order.length || from === target) return
    const next = [...order]
    next.splice(from, 1); next.splice(target, 0, id)
    save('order', next, `${projects.find(project => project.id === id)?.title} dipindahkan ke posisi ${target + 1}.`)
  }
  const visible = order.filter(id => !onlyFavorites || favorites.includes(id))
  return <>
    <div className={styles.projectToolbar}>
      <div className={styles.filters} role="group" aria-label="Filter proyek">
        <button aria-pressed={!onlyFavorites} onClick={() => setOnlyFavorites(false)}>Semua <span>{projects.length}</span></button>
        <button aria-pressed={onlyFavorites} onClick={() => { setOnlyFavorites(true); setReordering(false) }}>Favorit <span>{favorites.length}</span></button>
      </div>
      {!onlyFavorites && <button className={styles.textButton} disabled={!ready} aria-pressed={reordering} onClick={() => setReordering(value => !value)}>{reordering ? 'Selesai mengatur' : 'Atur urutan'}</button>}
    </div>
    {reordering && <p className={styles.helper}>Seret proyek atau gunakan tombol naik dan turun untuk mengatur urutan.</p>}
    <p className={styles.srOnly} role="status">{message} {error}</p>
    {error && <p className={styles.helper}>{error}</p>}
    {visible.length === 0 ? <div className={styles.empty}><BookmarkSimple size={28} aria-hidden="true" /><h3>Belum ada proyek favorit</h3><p>Tandai proyek yang ingin Anda lihat kembali lewat tombol bookmark.</p><button className={styles.secondaryButton} onClick={() => setOnlyFavorites(false)}>Lihat semua proyek</button></div> :
      <ul className={styles.projectList}>{visible.map(id => {
        const project = projects.find(item => item.id === id)!
        const index = order.indexOf(id)
        return <li key={id} className={styles.project} data-dragging={dragged === id} draggable={ready && reordering}
          onDragStart={event => { draggedId.current = id; setDragged(id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id) }}
          onDragOver={event => { if (reordering && draggedId.current) event.preventDefault() }}
          onDrop={event => { event.preventDefault(); if (reordering && draggedId.current) move(draggedId.current, index); draggedId.current = null; setDragged(null) }}
          onDragEnd={() => { draggedId.current = null; setDragged(null) }}>
          <div className={styles.projectCopy}>
            <h3>{project.href ? <Link draggable={false} href={project.href}>{project.title}<ArrowUpRight size={22} aria-hidden="true" /></Link> : project.title}</h3>
            <p>{project.desc}</p>
            {project.href && <Link className={styles.projectDestination} href={project.href}>{id === 'fintrack' ? 'Buka aplikasi saat ini' : 'Jelajahi menu aplikasi'}</Link>}
          </div>
          <div className={styles.tags} aria-label={`Teknologi ${project.title}`}>{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          <div className={styles.projectControls}>
            {reordering && <><DotsSixVertical size={20} aria-hidden="true" /><button className={styles.iconButton} disabled={index === 0} aria-label={`Naikkan ${project.title}`} onClick={() => move(id, index - 1)}><ArrowUp size={18} aria-hidden="true" /></button><button className={styles.iconButton} disabled={index === order.length - 1} aria-label={`Turunkan ${project.title}`} onClick={() => move(id, index + 1)}><ArrowDown size={18} aria-hidden="true" /></button></>}
            <button disabled={!ready} className={styles.iconButton} aria-pressed={favorites.includes(id)} aria-label={`${favorites.includes(id) ? 'Hapus' : 'Tandai'} ${project.title} ${favorites.includes(id) ? 'dari' : 'sebagai'} favorit`} onClick={() => bookmark(id)}><BookmarkSimple size={22} weight={favorites.includes(id) ? 'fill' : 'regular'} aria-hidden="true" /></button>
          </div>
        </li>
      })}</ul>}
  </>
}
