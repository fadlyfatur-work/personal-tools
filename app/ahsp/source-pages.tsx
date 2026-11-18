'use client'

import { useState } from 'react'
import type { AhspItem, AhspSource } from '@/lib/ahsp'
import styles from './catalog.module.css'

export default function SourcePages({ source, item }: { source: AhspSource; item: AhspItem }) {
  const start = item.page_from ?? 1
  const end = item.page_to ?? start
  const [page, setPage] = useState(start)
  const asset = source.assets.find(a => page >= a.page_start && page <= a.page_end)
  const documentUrl = asset ? `${asset.url}#page=${page - asset.page_start + 1}` : source.url ? `${source.url}#page=${page}` : null
  return <section className={styles.pagePreview} aria-label="Halaman lampiran">
    <div className={styles.previewControls}>
      <strong>Halaman PDF {page}</strong>
      {end > start && <><button type="button" disabled={page <= start} onClick={() => setPage(p => p - 1)}>Halaman sebelumnya</button><button type="button" disabled={page >= end} onClick={() => setPage(p => p + 1)}>Halaman berikutnya</button></>}
      {documentUrl && <a href={documentUrl} target="_blank" rel="noopener noreferrer">Buka PDF di tab baru</a>}
    </div>
    {documentUrl ? <iframe key={documentUrl} loading="lazy" className={styles.pdf} title={`Halaman PDF ${page} dari ${source.title}, rujukan ${item.code}`} src={documentUrl} />
      : <p className={styles.help}>Tautan dokumen sumber belum tersedia.</p>}
  </section>
}
