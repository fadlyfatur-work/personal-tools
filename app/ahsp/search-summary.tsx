'use client'

import { useEffect, useState } from 'react'
import { ahspTypeLabel, type AhspSearchStats, type AhspTypeCount } from '@/lib/ahsp'
import styles from './catalog.module.css'

const number = new Intl.NumberFormat('id-ID')
export default function SearchSummary({ stats, total, types, busy = false }: { stats: AhspSearchStats; total: number; types: AhspTypeCount[]; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1280px)')
    const update = () => setOpen(desktop.matches)
    update()
    desktop.addEventListener('change', update)
    return () => desktop.removeEventListener('change', update)
  }, [])

  return <aside className={styles.summarySidebar} aria-label="Ringkasan pencarian" aria-busy={busy}>
    <details open={open} onToggle={e => { if (e.target === e.currentTarget) setOpen(e.currentTarget.open) }}>
      <summary className={styles.summaryToggle}>Ringkasan pencarian <span>{busy ? 'Memuat…' : `${number.format(total)} hasil`}</span></summary>
      <div className={styles.searchSummary}>
        {busy ? <p role="status">Memperbarui ringkasan pencarian…</p> : <>
          <p className={styles.summaryTotal}><strong>{number.format(total)}</strong><span>item unik ditemukan</span></p>
          <p className={styles.summaryComparison}>{stats.found_terms} dari {stats.input_count} istilah memiliki hasil pada {stats.match === 'exact' ? 'Exact-match' : 'Like-match'}.</p>
          <p className={styles.summaryComparison}>Exact-match: <strong>{number.format(stats.exact_total)}</strong> item dari {number.format(stats.filtered_catalog_total)} item dalam cakupan filter. {stats.exact_found_terms} dari {stats.input_count} istilah cocok persis.</p>
          <details className={styles.termDetails} open={stats.input_count === 1}>
            <summary>Kecocokan per istilah ({stats.input_count})</summary>
            <ul className={styles.termList}>{stats.terms.map(term => <li key={term.term}>
              <strong>{term.term}</strong>
              <dl><div data-active={stats.match === 'exact'}><dt>Exact-match</dt><dd>{number.format(term.exact_count)}</dd></div><div data-active={stats.match === 'like'}><dt>Like-match</dt><dd>{number.format(term.like_count)}</dd></div></dl>
            </li>)}</ul>
            <p className={styles.help}>Satu item bisa cocok dengan beberapa istilah. Total menghitung item pekerjaan unik.</p>
          </details>
          {!!types.length && <div className={styles.summaryTypes}><h3>Jenis item ditemukan</h3><dl>{types.map(type => <div key={type.type}><dt>{ahspTypeLabel(type.type)}</dt><dd>{number.format(type.count)}</dd></div>)}</dl></div>}
        </>}
      </div>
    </details>
  </aside>
}
