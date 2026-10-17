'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { buildRabUsage, type RabUsageAnalysis, type RabUsageReport } from '@/lib/ahspRabUsage'
import { mptkGroups, type MptkGroup } from '@/lib/ahspMptk'
import type { RabRow } from '@/lib/ahspRab'
import base from '../catalog.module.css'
import styles from './component-usage.module.css'

const number = new Intl.NumberFormat('id-ID')
export default function ComponentUsage({ rows, onLoaded, onBack, onDownload, exporting }: {
  rows: RabRow[]; onLoaded: (data: RabUsageReport | null) => void; onBack: () => void; onDownload: () => void; exporting: boolean;
}) {
  const [report, setReport] = useState<RabUsageReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [group, setGroup] = useState<MptkGroup>('tenaga')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const dialog = useRef<HTMLDialogElement>(null)
  const ids = useMemo(() => [...new Set(rows.flatMap(row => !row.excluded && row.status === 'matched' && row.candidate ? [row.candidate.id] : []))], [rows])
  const filtered = report?.components.filter(c => c.group === group && `${c.name} ${c.codes.join(' ')}`.toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID').trim())) ?? []
  const pages = Math.max(1, Math.ceil(filtered.length / 20)), currentPage = Math.min(page, pages)
  const component = report?.components.find(c => c.key === selected)
  const detailRows = selected === 'coverage' ? report?.coverage ?? [] : component?.jobs ?? []
  const detailPages = Math.max(1, Math.ceil(detailRows.length / 20))

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError(''); setLoaded(0); setReport(null); onLoaded(null)
      try {
        const records: RabUsageAnalysis[] = []
        for (let start = 0; start < ids.length; start += 100) {
          const response = await fetch('/api/ahsp/rab/components', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ids.slice(start, start + 100) }), signal: controller.signal })
          const body = await response.json()
          if (!response.ok) throw new Error(body.error || 'Rincian komponen gagal dimuat.')
          if (controller.signal.aborted) return
          if (!Array.isArray(body.analyses)) throw new Error('Respons rincian komponen tidak valid.')
          records.push(...body.analyses)
          setLoaded(Math.min(ids.length, start + 100))
        }
        if (!controller.signal.aborted) { const result = buildRabUsage(rows, records); setReport(result); onLoaded(result) }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Rincian komponen gagal dimuat.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [ids, rows, retry, onLoaded])
  useEffect(() => {
    if (!selected) return
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [selected])
  const close = () => { dialog.current?.close(); setSelected(null) }
  const open = (key: string) => { setDetailPage(1); setSelected(key) }

  return <section className={styles.panel} data-rab-panel aria-labelledby="rab-usage-title">
    <div className={styles.header}><div><h2 id="rab-usage-title">Rekap penggunaan komponen</h2><p>Penggunaan dihitung dari pekerjaan RAB yang sudah ditetapkan cocok.</p></div><button type="button" onClick={onBack}>Kembali ke rekonsiliasi</button></div>
    <p className={styles.help}>Total dipakai = jumlah baris RAB. Item pekerjaan/AHSP = jumlah analisis unik, termasuk versi regulasinya. Komponen yang berulang pada satu analisis dihitung sekali per baris RAB.</p>
    <p className={base.loadingIndicator} role="status" aria-atomic="true">{loading ? <><span className={base.spinner} aria-hidden="true" />Memuat rincian AHSP… {loaded} / {ids.length} analisis</> : report ? `Rincian komponen tersedia untuk ${number.format(report.covered)} dari ${number.format(report.matched)} pekerjaan yang cocok (${number.format(report.uniqueJobs)} AHSP unik).` : ''}</p>
    {error && <div className={styles.warning} role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(n => n + 1)}>Muat ulang rincian</button></div>}
    {report && !loading && <>
      <div className={styles.coverage}><p>{number.format(report.matched - report.covered)} pekerjaan belum memiliki rincian yang dapat ditampilkan. {number.format(report.review)} pekerjaan memakai rincian sebagian atau perlu ditinjau.</p><button type="button" onClick={() => open('coverage')}>Periksa cakupan rincian</button></div>
      <div className={styles.tabs} role="group" aria-label="Jenis komponen">{(Object.entries(mptkGroups) as [MptkGroup, string][]).map(([key, title]) => <button key={key} type="button" aria-pressed={group === key} onClick={() => { setGroup(key); setPage(1); setQuery('') }}>{title} ({number.format(report.components.filter(c => c.group === key).length)})</button>)}</div>
      <label className={styles.search}>Cari komponen<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Nama atau kode komponen" /></label>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`Tabel penggunaan ${mptkGroups[group]}`}><table className={styles.table}><thead><tr><th scope="col">Komponen</th><th scope="col">Total dipakai</th><th scope="col">Item pekerjaan/AHSP</th></tr></thead><tbody>{filtered.slice((currentPage - 1) * 20, currentPage * 20).map(c => <tr key={c.key}><td><strong>{c.name}</strong><small>{c.unit}{c.codes.length ? ` · ${c.codes.join(', ')}` : ''}</small>{c.jobs.some(job => job.review) && <small>Memuat analisis yang perlu ditinjau</small>}</td><td>{number.format(c.total)}</td><td><button type="button" aria-label={`Lihat daftar pekerjaan untuk ${c.name} (${c.unit})`} onClick={() => open(c.key)}>{number.format(c.jobs.length)} · Lihat daftar</button></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className={styles.empty}>{query ? 'Tidak ada komponen sesuai pencarian.' : `Belum ada komponen ${mptkGroups[group].toLocaleLowerCase('id-ID')} yang berhasil teridentifikasi dari pekerjaan ini.`}</p>}
      <nav className={styles.pagination} aria-label="Halaman komponen"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(n => n - 1)}>Sebelumnya</button><span>Halaman {currentPage} / {pages} · {number.format(filtered.length)} komponen</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(n => n + 1)}>Berikutnya</button></nav>
    </>}
    <div className={styles.actions}><button type="button" className={styles.primary} disabled={loading || !report || exporting} onClick={onDownload}>{exporting && <span className={base.spinner} aria-hidden="true" />}{exporting ? 'Menyiapkan Excel…' : 'Unduh Excel dengan rekap penggunaan'}</button></div>
    <dialog ref={dialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="rab-usage-detail-title" onClose={() => setSelected(null)}>
      <div className={styles.header}><h2 id="rab-usage-detail-title">{selected === 'coverage' ? 'Cakupan rincian AHSP' : `Pekerjaan pengguna ${component?.name ?? 'komponen'}`}</h2><button type="button" autoFocus onClick={close}>Tutup</button></div>
      <div className={styles.body}>{selected === 'coverage' ? <ul className={styles.jobs}>{report?.coverage.slice((detailPage - 1) * 20, detailPage * 20).map(c => <li key={c.source.id}><strong>{c.item.code || 'Tanpa kode'} · {c.item.name}</strong><small>{c.item.regulation} · {c.source.sheet}!{c.source.source} · baris {c.source.row}</small><p>{c.available ? c.review ? 'Rincian tersedia, perlu ditinjau' : 'Rincian tersedia' : 'Rincian belum tersedia'}{c.note ? `: ${c.note}` : ''}</p></li>)}</ul> : <ul className={styles.jobs}>{component?.jobs.slice((detailPage - 1) * 20, detailPage * 20).map(job => <li key={job.item.id}><strong>{job.item.code || 'Tanpa kode'} · {job.item.name}</strong><small>{job.item.regulation} · {number.format(job.sources.length)} baris RAB</small>{job.analysis.id !== job.item.id && <small>Acuan analisis: {job.analysis.code} · {job.analysis.regulation}</small>}{job.note && <p>{job.note}</p>}<div className={styles.locations} tabIndex={0} role="region" aria-label={`Lokasi RAB untuk ${job.item.code || job.item.name}`}><ul>{job.sources.map(source => <li key={source.id}>{source.sheet}!{source.source} · baris {source.row} · {source.name}</li>)}</ul></div></li>)}</ul>}
        {!detailRows.length && <p>Belum ada pekerjaan pada daftar ini.</p>}
        <nav className={styles.pagination} aria-label="Halaman daftar pekerjaan"><button type="button" disabled={detailPage <= 1} onClick={() => setDetailPage(n => n - 1)}>Sebelumnya</button><span>{detailPage} / {detailPages} · {number.format(detailRows.length)} pekerjaan</span><button type="button" disabled={detailPage >= detailPages} onClick={() => setDetailPage(n => n + 1)}>Berikutnya</button></nav>
      </div>
    </dialog>
  </section>
}
