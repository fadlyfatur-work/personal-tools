'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, FileText, Files } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { documentTemplates } from '@/lib/documentTemplates'
import styles from './documents.module.css'

type Template = { code: string; name: string }

export default function DocumentsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(false)
      try {
        const { data, error } = await supabase.from('templates').select('code, name').order('name').abortSignal(controller.signal)
        if (controller.signal.aborted) return
        if (error) throw error
        setTemplates([...Object.values(documentTemplates), ...(data ?? []).filter(template => !Object.hasOwn(documentTemplates, template.code))].sort((a, b) => a.name.localeCompare(b.name, 'id')))
      } catch {
        if (!controller.signal.aborted) {
          setTemplates(Object.values(documentTemplates))
          setError(true)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])

  const filtered = templates.filter(template => template.name.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')))

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/menu" className={styles.back}><ArrowLeft size={18} aria-hidden="true" /> Semua tools</Link>
        <header className={styles.header}>
          <h1>Surat yang tepat,<br />siap untuk diisi.</h1>
          <p>Pilih template surat, lengkapi datanya, lalu unduh dalam format Word.</p>
        </header>
        <div className={styles.workspace}>
          <div>
            {!loading && templates.length > 0 && (
              <div className={styles.search}>
                <label htmlFor="template-search" className={styles.label}>Cari template surat</label>
                <input id="template-search" type="search" className={styles.input} placeholder="Cari berdasarkan nama surat" value={query} onChange={event => setQuery(event.target.value)} />
                <p className={styles.counter} role="status">{filtered.length} template tersedia</p>
              </div>
            )}
            {error && <div className={styles.notice} role="alert">Template tambahan belum bisa dimuat. Template bawaan tetap tersedia. <button className={styles.secondary} onClick={() => setAttempt(value => value + 1)}>Coba lagi</button></div>}
            {loading ? (
              <div role="status" aria-label="Memuat template"><div className={styles.skeleton} /><div className={styles.skeleton} /><p className={styles.muted}>Memuat daftar template…</p></div>
            ) : templates.length === 0 ? (
              <div className={styles.empty}><Files size={32} aria-hidden="true" /><h2>Belum ada template surat</h2><p>Template yang disediakan akan muncul di sini setelah ditambahkan oleh pengelola.</p></div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}><h2>Template tidak ditemukan</h2><p>Coba nama surat lain atau tampilkan semua template.</p><button className={styles.secondary} onClick={() => setQuery('')}>Hapus pencarian</button></div>
            ) : (
              <div className={styles.catalog}>
                {filtered.map(template => (
                  <Link key={template.code} href={`/documents/${encodeURIComponent(template.code)}`} className={styles.template}>
                    <span className={styles.fileIcon}><FileText size={28} aria-hidden="true" /></span>
                    <div className={styles.templateText}><h2>{template.name}</h2><p>Isi data dan unduh surat Word</p></div>
                    <ArrowRight size={22} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
          </div>
          <aside className={styles.aside}>
            <Files size={32} aria-hidden="true" />
            <h2>Dari template ke surat</h2>
            <p>Setiap template memiliki isian sendiri. Pilih surat sesuai kebutuhan untuk mulai mengisi.</p>
            <h2>Bisa diedit di Word</h2>
            <p>Dokumen diunduh sebagai .docx. Periksa kembali isi surat sebelum dicetak atau dikirim.</p>
          </aside>
        </div>
      </div>
    </main>
  )
}
