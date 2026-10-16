'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { AhspItem, AhspSource } from '@/lib/ahsp'
import styles from './catalog.module.css'

export default function SourcePages({ source, item }: { source: AhspSource; item: AhspItem }) {
  const start = item.page_from ?? 1
  const end = item.page_to ?? start
  const [page, setPage] = useState(start)
  const [failed, setFailed] = useState(false)
  const [loadedUrl, setLoadedUrl] = useState('')
  const asset = source.assets.find(a => page >= a.page_start && page <= a.page_end)
  const preview = source.assets.find(a => a.preview_base_url)?.preview_base_url
  const url = preview ? `${preview}${page}.jpg` : null
  const documentUrl = asset ? `${asset.url}#page=${page - asset.page_start + 1}` : null
  const pendingUrl = url && !failed ? url : documentUrl
  return <section className={styles.pagePreview} aria-label="Halaman lampiran">
    <div className={styles.previewControls}>
      <strong>Halaman PDF {page}</strong>
      {end > start && <><button type="button" disabled={page <= start} onClick={() => { setPage(p => p - 1); setFailed(false) }}>Halaman sebelumnya</button><button type="button" disabled={page >= end} onClick={() => { setPage(p => p + 1); setFailed(false) }}>Halaman berikutnya</button></>}
      {url && <a href={url} target="_blank" rel="noopener noreferrer">Buka halaman ukuran penuh</a>}
    </div>
    {pendingUrl && loadedUrl !== pendingUrl && <p className={styles.previewLoading} role="status"><span className={styles.spinner} aria-hidden="true" />Memuat halaman lampiran…</p>}
    {url && !failed ? <Image key={url} unoptimized width={1600} height={2200} className={styles.pageImage} src={url} alt={`Halaman PDF ${page} dari ${source.title}, rujukan ${item.code}`} onLoad={() => setLoadedUrl(url)} onError={() => setFailed(true)} />
      : asset && documentUrl ? <><p className={styles.help}>Pratinjau halaman belum tersedia. Dokumen PDF dan tautan resmi tetap dapat dibuka.</p><iframe key={documentUrl} loading="lazy" className={styles.pdf} title={`Lampiran asli ${item.code}`} src={documentUrl} onLoad={() => setLoadedUrl(documentUrl)} /></>
      : <p className={styles.help}>Buka dokumen melalui tautan lampiran asli.</p>}
  </section>
}
