'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AHSP_CATALOG_REGULATIONS, AHSP_ARCHIVED_REGULATION } from '@/lib/ahsp'
import { mptkGroups, type MptkComponent, type MptkResponse } from '@/lib/ahspMptk'
import base from '../catalog.module.css'
import styles from './catalog.module.css'

const number = new Intl.NumberFormat('id-ID', { maximumSignificantDigits: 12 })
const initialFilters = { q: '', group: '', field: '', unit: '', regulation: '', analysis: '' }
const analysisLabels = { extracted: 'Struktur terekstrak', needs_review: 'Perlu ditinjau', unavailable: 'Analisis belum tersedia' }

async function readCatalog(params: URLSearchParams, signal: AbortSignal): Promise<MptkResponse> {
  const response = await fetch(`/api/ahsp/mptk?${params}`, { signal })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || 'Katalog komponen gagal dimuat.')
  return body
}

export default function MptkCatalog() {
  const [theme, setTheme] = useState('system')
  const [draft, setDraft] = useState(initialFilters)
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<MptkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<MptkComponent | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [detail, setDetail] = useState<MptkResponse | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailRetry, setDetailRetry] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!selected) return
    const modal = dialog.current
    modal?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { modal?.close(); document.body.style.overflow = previousOverflow }
  }, [selected])

  useEffect(() => {
    const controller = new AbortController()
    readCatalog(new URLSearchParams({ ...filters, page: String(page) }), controller.signal)
      .then(body => { if (!controller.signal.aborted) setData(body) })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Katalog gagal dimuat.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filters, page, retry])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    readCatalog(new URLSearchParams({ ...filters, key: selected.key, page: String(detailPage) }), controller.signal)
      .then(body => { if (!controller.signal.aborted) setDetail(body) })
      .catch(e => { if (!controller.signal.aborted) setDetailError(e instanceof Error ? e.message : 'Rincian gagal dimuat.') })
    return () => controller.abort()
  }, [selected, detailPage, filters, detailRetry])

  const applyFilters = (next: typeof filters) => {
    setLoading(true); setError(''); setSelected(null); setDetail(null)
    setPage(1); setFilters({ ...next }); setDraft({ ...next })
  }
  const change = (key: keyof typeof filters, value: string) => {
    applyFilters({ ...filters, q: draft.q, [key]: value, ...(['regulation', 'field'].includes(key) ? { unit: '' } : {}) })
  }
  const turnPage = (next: number) => { setLoading(true); setError(''); setSelected(null); setPage(next) }
  const turnDetailPage = (next: number) => { dialog.current?.querySelector('button')?.focus({ preventScroll: true }); setDetail(null); setDetailError(''); setDetailPage(next); dialog.current?.scrollTo({ top: 0 }) }
  const open = (component: MptkComponent) => {
    setSelected(component)
    setDetail(null); setDetailError(''); setDetailPage(1)
  }
  const keepModalFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],[tabindex="0"]')).filter(el => el.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 30))
  const usagePages = Math.max(1, Math.ceil((detail?.usage_total ?? selected?.occurrence_count ?? 0) / 30))
  const totalGroups = data?.groups.reduce((total, group) => total + group.count, 0) ?? 0

  return <main className={base.page} data-theme={theme}>
    <div className={base.container}>
      <header className={base.header}>
        <div><Link className={base.back} href="/ahsp">Katalog AHSP</Link>
          <h1>Rekapitulasi MPTK</h1><p>Cari tenaga kerja, material, dan peralatan beserta pekerjaan yang menggunakannya.</p></div>
        <label>Tampilan<select value={theme} onChange={e => setTheme(e.target.value)}><option value="system">Tema sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select></label>
      </header>

      <form className={base.filters} aria-label="Pencarian komponen MPTK" onSubmit={e => { e.preventDefault(); applyFilters(draft) }}>
        <div className={styles.search}>
          <label htmlFor="mptk-search">Nama atau kode komponen<input id="mptk-search" type="search" value={draft.q} onChange={e => setDraft(current => ({ ...current, q: e.target.value }))} maxLength={240} placeholder="Contoh: Semen Portland, Pekerja, L.01" /></label>
          <button type="submit" className={styles.searchButton}>Cari komponen</button>
          <button type="button" onClick={() => applyFilters(initialFilters)}>Reset pencarian</button>
        </div>
        <fieldset className={base.fieldFilters}><legend>Jenis komponen</legend>
          <div className={base.fieldOptions}>
            <button type="button" aria-pressed={!filters.group} onClick={() => change('group', '')}>Semua {!loading && data && `(${number.format(totalGroups)})`}</button>
            {Object.entries(mptkGroups).map(([group, label]) => <button key={group} type="button" aria-pressed={filters.group === group} onClick={() => change('group', group)}>{label} {!loading && data && `(${number.format(data.groups.find(g => g.group === group)?.count ?? 0)})`}</button>)}
          </div>
          <p className={base.searchHelp}>Jumlah komponen sesuai pencarian dan filter lain, sebelum pilihan jenis komponen.</p>
        </fieldset>
        <div className={styles.refinements}>
          <label>Regulasi<select value={filters.regulation} onChange={e => applyFilters({ ...filters, q: draft.q, regulation: e.target.value, field: '', unit: '' })}><option value="">Semua regulasi aktif</option>{AHSP_CATALOG_REGULATIONS.map(r => <option key={r} value={r}>{r}{r === AHSP_ARCHIVED_REGULATION && ' (arsip)'}</option>)}</select></label>
          <label>Bidang<select value={filters.field} onChange={e => change('field', e.target.value)}><option value="">Semua bidang</option>{data?.fields.map(field => <option key={field}>{field}</option>)}</select></label>
          <label>Satuan komponen<select value={filters.unit} onChange={e => change('unit', e.target.value)}><option value="">Semua satuan</option>{data?.units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
          <label>Status analisis<select value={filters.analysis} onChange={e => change('analysis', e.target.value)}><option value="">Semua status</option>{Object.entries(analysisLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </form>

      {!loading && !error && data?.validation && <p className={styles.validation} role="status">Validasi pada bidang dan regulasi terpilih: {number.format(data.validation.corrected)} kategori diperbaiki dari penanda kelompok sumber; {number.format(data.validation.excluded)} baris ditahan karena identitas, satuan, atau beberapa komponen tergabung dan perlu diperiksa ulang.</p>}

      <details className={styles.coverage}>
        <summary>Cakupan dan cara membaca data</summary>
        <p>Komponen dikelompokkan berdasarkan jenis, nama, dan satuan. Kapitalisasi, spasi, serta penulisan bh/buah disetarakan. Nama yang hanya mirip dan satuan yang berbeda tetap terpisah. Kode asli dapat berbeda antarpekerjaan.</p>
        <p>Penanda kelompok A/B/C yang menyatu dengan baris komponen digunakan untuk memperbaiki kategori dan memisahkan judul kelompok dari nama. Baris gabungan dan satuan tenaga kerja yang tidak sesuai ditahan dari hasil pencarian. Nilai dan satuan pada dokumen sumber tetap dipertahankan; kejanggalan pada sumber masih memerlukan tinjauan.</p>
        {data && <p>{number.format(data.coverage.with_components)} dari {number.format(data.coverage.jobs)} versi pekerjaan pada bidang dan regulasi terpilih memiliki komponen MPTK yang dapat ditampilkan. Hitungan cakupan ini sebelum filter kata kunci, jenis, satuan, dan status analisis; komponen biaya SMKK dikecualikan.</p>}
        <p>Rincian Bina Marga dan arsip SIPASTI belum lengkap. Struktur terekstrak menandai hasil pemeriksaan ekstraksi, bukan pengesahan teknis. Koefisien mengikuti masing-masing pekerjaan dan basis analisis. Harga dasar serta kebutuhan total proyek belum termasuk.</p>
      </details>

      <section className={styles.results} aria-label="Daftar komponen" aria-busy={loading}>
        <div className={base.listHeading}><h2>Komponen MPTK</h2><span role="status">{loading ? 'Memuat komponen…' : error ? 'Katalog belum tersedia' : `${number.format(data?.total ?? 0)} komponen`}</span></div>
        {error ? <div className={base.notice} role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(''); setRetry(n => n + 1) }}>Coba lagi</button></div>
          : loading ? <p className={base.empty}>Memuat katalog komponen…</p>
          : !data?.items.length ? <div className={base.empty}><p>Tidak ada komponen sesuai filter. Pekerjaan tanpa rincian MPTK belum dapat dicari di sini.</p><button type="button" onClick={() => applyFilters(initialFilters)}>Tampilkan semua komponen</button></div>
          : <ul className={styles.list}>{data.items.map(component => <li key={component.key}>
            <button className={styles.component} type="button" aria-haspopup="dialog" aria-controls="mptk-detail" onClick={() => open(component)}>
              <span className={styles.identity}><strong>{component.name}</strong><span>{mptkGroups[component.group]} · {component.unit}</span><small>{component.codes?.length ? `Kode: ${component.codes.join(', ')}` : 'Kode sumber belum tersedia'}</small><CoefficientSummary component={component} /></span>
              <span className={styles.count}><strong>{number.format(component.job_count)} pekerjaan</strong><span>{number.format(component.occurrence_count)} kemunculan</span>{component.review_count > 0 && <small>{number.format(component.review_count)} perlu ditinjau</small>}<span className={styles.disclosure}>Lihat penggunaan</span></span>
            </button>
          </li>)}</ul>}
        {!error && !!data?.total && <nav className={styles.pagination} aria-label="Halaman komponen"><button type="button" disabled={loading || page <= 1} onClick={() => turnPage(page - 1)}>Sebelumnya</button><span>Halaman {page} dari {pages}</span><button type="button" disabled={loading || page >= pages} onClick={() => turnPage(page + 1)}>Berikutnya</button></nav>}
      </section>
    </div>
    <dialog id="mptk-detail" ref={dialog} className={`${base.dialog} ${styles.modal}`} aria-labelledby="mptk-detail-title" aria-describedby="mptk-detail-help" onClose={() => setSelected(null)} onKeyDown={keepModalFocus}>
      {selected && <>
        <header className={`${base.modalHeader} ${styles.modalHeader}`}>
          <div><p>{mptkGroups[selected.group]} · {selected.unit}</p><h2 id="mptk-detail-title">{selected.name}</h2><p>{number.format(selected.job_count)} pekerjaan · {number.format(selected.occurrence_count)} kemunculan</p></div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Tutup rincian komponen">Tutup</button>
        </header>
        <section className={styles.detail} aria-label={`Penggunaan ${selected.name}`}>
              <h3>Pekerjaan yang menggunakan komponen</h3>
              <p id="mptk-detail-help" className={base.searchHelp}>Sesuai filter yang diterapkan. Koefisien berlaku per basis analisis pekerjaan; setiap kemunculan ditampilkan terpisah. Angka dan rumus di bawah mengikuti sumber.</p>
              {detailError ? <div role="alert"><p>{detailError}</p><button type="button" onClick={() => { dialog.current?.querySelector('button')?.focus({ preventScroll: true }); setDetailError(''); setDetailRetry(n => n + 1) }}>Muat ulang rincian</button></div>
                : !detail ? <p role="status">Memuat penggunaan komponen…</p>
                : <><ul className={styles.usages}>{detail.usages.map(usage => <li key={`${usage.item_id}-${usage.position}`}>
                  <div><strong>{usage.item_code || 'Tanpa kode'} · {usage.item_name}</strong><p>{usage.field}{usage.division && ` / ${usage.division}`} · {usage.regulation}</p><p>Komponen asli: {usage.name}{usage.code && ` (${usage.code})`} · {usage.unit}</p></div>
                  <dl><div><dt>{usage.coefficient === null && usage.expression ? 'Rumus koefisien' : 'Koefisien'}</dt><dd>{usage.coefficient !== null ? `${number.format(usage.coefficient)} ${usage.unit}` : usage.expression || 'Belum tersedia'}</dd></div><div><dt>Basis analisis</dt><dd>{number.format(usage.output_quantity)} {usage.item_unit}</dd></div></dl>
                  <p className={usage.analysis_status === 'extracted' ? styles.status : styles.warning}>{analysisLabels[usage.analysis_status]}</p>
                  {usage.category_corrected && <p className={styles.warning}>Kategori sumber terbaca sebagai {mptkGroups[usage.original_group]}; dikoreksi menjadi {mptkGroups[usage.component_group]} berdasarkan penanda kelompok pada baris sumber.</p>}
                  {usage.source_url ? <a className={styles.source} href={`${usage.source_url}${usage.page_from ? `#page=${usage.page_from}` : ''}`} target="_blank" rel="noopener noreferrer">{usage.annex || usage.source_title || 'Lampiran sumber'}{usage.page_from ? ` · Halaman PDF ${usage.page_from}${usage.page_to && usage.page_to !== usage.page_from ? `–${usage.page_to}` : ''}` : ' · Halaman belum terpetakan'}</a> : <p className={styles.warning}>Rujukan lampiran belum tersedia.</p>}
                </li>)}</ul>
                <nav className={styles.pagination} aria-label="Halaman penggunaan"><button type="button" disabled={detailPage <= 1} onClick={() => turnDetailPage(detailPage - 1)}>Penggunaan sebelumnya</button><span role="status">Halaman {detailPage} dari {usagePages} · {number.format(detail.usage_total)} kemunculan</span><button type="button" disabled={detailPage >= usagePages} onClick={() => turnDetailPage(detailPage + 1)}>Penggunaan berikutnya</button></nav></>}
        </section>
      </>}
    </dialog>
  </main>
}

function CoefficientSummary({ component }: { component: MptkComponent }) {
  const summary = component.coefficient_summary
  if (!summary) return <span className={styles.coefficients}>Informasi koefisien belum tersedia.</span>
  return <span className={styles.coefficients}>
    <span className={styles.coefficientHeading}>Koefisien menurut pekerjaan</span>
    {summary.samples.length ? summary.samples.map((sample, index) => <span className={styles.coefficientSample} key={`${sample.item_id}-${index}`}>
      <strong>{sample.coefficient !== null ? `${number.format(sample.coefficient)} ${component.unit}` : `Rumus: ${sample.expression}`} <span>per {number.format(sample.output_quantity)} {sample.item_unit} pekerjaan</span></strong>
      <small>{sample.item_code && `${sample.item_code} · `}{sample.item_name} · {sample.regulation}</small>
    </span>) : <span>Koefisien belum tersedia pada sumber yang cocok.</span>}
    {summary.variant_count > 1 && <small>{number.format(summary.variant_count)} variasi nilai/rumus dan basis analisis{summary.variant_count > summary.samples.length && `; ${summary.samples.length} contoh ditampilkan`}. Selengkapnya di rincian penggunaan.</small>}
    {summary.formula_count > 0 && <small>{number.format(summary.formula_count)} kemunculan menggunakan rumus; nilainya memerlukan parameter dari analisis pekerjaan.</small>}
    {summary.missing_count > 0 && <small>{number.format(summary.missing_count)} kemunculan belum memiliki koefisien.</small>}
  </span>
}
