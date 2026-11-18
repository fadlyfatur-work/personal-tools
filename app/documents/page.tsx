'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {CaretRight,Files} from '@phosphor-icons/react'
import { toolsRequest, ToolsRequestError } from '@/lib/tools/client'
import type { DocumentTemplate } from '@/lib/documents/types'
import { DocumentAccess } from './document-access'
import {SuiteFrame} from '@/app/tools/components/suite-frame'
import styles from './documents.module.css'
function Catalog({ reset }: { reset: () => void }) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [offset, setOffset] = useState(0)
  const [more, setMore] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    toolsRequest<DocumentTemplate[]>(`/api/documents/templates?offset=${offset}&q=${encodeURIComponent(query)}&kind=${encodeURIComponent(kind)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setTemplates(prev => offset ? [...prev, ...data] : data); setMore(data.length === 100) } })
      .catch(err => { if (!controller.signal.aborted) { if (err instanceof ToolsRequestError && err.status === 401) { setTemplates([]); reset() } else setError(err.message) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query, kind, offset, attempt, reset])
  function clearFilters(){setLoading(true);setError('');setQuery('');setKind('');setOffset(0);setTemplates([])}
  return <div>
    <p className={styles.catalogIntro}>Pilih template, lengkapi isian, lalu unduh Word. Periksa isi dokumen sebelum digunakan.</p>
    <div className={styles.panel}><div className={styles.catalogFilters}><div className={styles.field}><label htmlFor="template-search" className={styles.label}>Cari nama surat</label><input id="template-search" className={styles.input} type="search" value={query} onChange={event => { setLoading(true); setError(''); setQuery(event.target.value); setOffset(0); setTemplates([]) }} /></div><div className={styles.field}><label className={styles.label} htmlFor="template-kind">Jenis dokumen</label><input id="template-kind" className={styles.input} value={kind} onChange={event => { setLoading(true); setError(''); setKind(event.target.value); setOffset(0); setTemplates([]) }} placeholder="Semua jenis" /></div></div>{(query||kind)&&<div className={styles.actions}><button className={styles.secondary} onClick={clearFilters}>Hapus filter</button></div>}</div>
    {error && <div role="alert" className={styles.error}>{error} <button className={styles.secondary} onClick={() => { setLoading(true); setError(''); setAttempt(value => value + 1) }}>Coba lagi</button></div>}
    {loading && <p role="status">Memuat template…</p>}
    {!loading && !error && !templates.length && <div className={styles.empty}><h2>{query||kind?'Tidak ada template yang cocok':'Koleksi belum memiliki template'}</h2><p>{query||kind?'Hapus filter atau coba nama dokumen lain.':'Hubungi pengelola kelompok untuk menambahkan template.'}</p></div>}
    {!!templates.length&&<div className={styles.catalog}>{templates.map(template => <Link key={template.id} href={`/documents/${encodeURIComponent(template.code)}`} className={styles.template}><span className={styles.fileIcon}><Files size={22} aria-hidden="true"/></span><div className={styles.templateText}><h2>{template.name}</h2><p>{[template.kind, template.organization, template.division].filter(Boolean).join(' / ')}</p>{template.description && <p>{template.description}</p>}</div><CaretRight size={18} aria-hidden="true"/></Link>)}</div>}
    {more && <button disabled={loading} className={styles.secondary} onClick={() => { setLoading(true); setError(''); setOffset(value => value + 100) }}>Muat template berikutnya</button>}
  </div>
}
export default function DocumentsPage() {
  return <SuiteFrame title="Koleksi dokumen" description="Template instansi dan divisi, siap diisi setelah akses dibuka." section="documents"><div className={`${styles.page} ${styles.embedded}`}><DocumentAccess>{(_access, reset) => <Catalog reset={reset} />}</DocumentAccess></div></SuiteFrame>
}
