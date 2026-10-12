'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AHSP_ACTIVE_REGULATIONS, calculateAhsp, parseAhspNumber, parseAhspSearch, ahspTypeLabel, type AhspSearchStats, type AhspTypeCount, type AhspItem, type AhspOptions, type AhspSource } from '@/lib/ahsp'
import styles from './catalog.module.css'
import ManualAnalysis from './manual-analysis'
import SourcePages from './source-pages'
import SearchSummary from './search-summary'

type Summary = Pick<AhspItem, 'id' | 'code' | 'name' | 'unit' | 'field' | 'division' | 'regulation' | 'ahsp_type' | 'analysis_status' | 'source_id' | 'page_from' | 'page_to'> & { matched_components?: string[] }
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 5 })
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 })
const money = (n: number | null) => n === null ? 'Belum dihitung' : rupiah.format(n)
const groupNames = { tenaga: 'Tenaga kerja', bahan: 'Bahan', alat: 'Peralatan', smkk: 'Komponen biaya SMKK' }
const analysisLabels = { extracted: 'Komponen tersedia', needs_review: 'Analisis perlu ditinjau', unavailable: 'Analisis belum tersedia' }
const initialFilters = { q: '', multiple: '', field: '', division: '', unit: '', regulation: '', match: 'like' }

export default function AhspCatalog() {
  const [theme, setTheme] = useState('system')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useAdvanced, setUseAdvanced] = useState(false)
  const [searchStats, setSearchStats] = useState<AhspSearchStats | null>(null)
  const [matchedTypes, setMatchedTypes] = useState<AhspTypeCount[]>([])
  const [filters, setFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Summary[]>([])
  const [options, setOptions] = useState<AhspOptions | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<Summary | null>(null)
  const [detail, setDetail] = useState<AhspItem | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailRetry, setDetailRetry] = useState(0)
  const [tab, setTab] = useState<'calculation' | 'source'>('calculation')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [coefficients, setCoefficients] = useState<Record<string, string>>({})
  const [volume, setVolume] = useState('1')
  const [overhead, setOverhead] = useState('')
  const [showSources, setShowSources] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const resultsAnchor = useRef<HTMLElement>(null)
  const searchAnchor = useRef<HTMLFormElement>(null)
  const debounceInput = useRef(false)
  const optionsRef = useRef<AhspOptions | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const active = useAdvanced ? filters : { ...initialFilters, q: filters.q, regulation: filters.regulation }
        const multiple = useAdvanced && parseAhspSearch(active.multiple).length > 0
        const params = new URLSearchParams({
          q: multiple ? active.multiple : active.q,
          mode: multiple ? 'multiple' : 'single',
          scope: useAdvanced ? 'all' : 'jobs',
          match: active.match,
          field: active.field,
          division: active.division,
          unit: active.unit,
          regulation: active.regulation,
          page: String(page),
          options: optionsRef.current ? '0' : '1',
        })
        const response = await fetch(`/api/ahsp?${params}`, { signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        if (controller.signal.aborted) return
        setItems(body.items)
        setTotal(body.total)
        setSearchStats(body.search_stats ?? null)
        setMatchedTypes(body.matched_types ?? [])
        if (body.options) {
          setOptions(body.options)
          optionsRef.current = body.options
        }
      } catch (e) {
        if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Katalog gagal dimuat.'); setItems([]) }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, debounceInput.current ? 200 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [filters, page, retry, useAdvanced])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    fetch(`/api/ahsp?id=${selected.id}`, { signal: controller.signal }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      if (!controller.signal.aborted) setDetail(body.item)
    }).catch(e => { if (!controller.signal.aborted) setDetailError(e instanceof Error ? e.message : 'Analisis gagal dimuat.') })
    if (!dialog.current?.open) dialog.current?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { controller.abort(); document.body.style.overflow = previousOverflow }
  }, [selected, detailRetry])

  const beginList = () => { setLoading(true); setError('') }
  const resetFilters = () => {
    beginList()
    debounceInput.current = false
    setFilters({ ...initialFilters })
    setPage(1)
    setShowAdvanced(false)
    setUseAdvanced(false)
  }
  const openItem = (item: Summary) => { setDetail(null); setDetailError(''); setTab('calculation'); setPrices({}); setCoefficients({}); setVolume('1'); setOverhead(''); setSelected(item) }
  const changeFilter = (key: keyof typeof filters, value: string) => {
    beginList()
    setPage(1)
    debounceInput.current = key === 'q' || key === 'multiple'
    if (key === 'q') setUseAdvanced(false)
    else if (key !== 'regulation') setUseAdvanced(true)
    setFilters(current => ({ ...current, [key]: value, ...(key === 'field' ? { division: '' } : {}) }))
  }
  const viewResults = () => {
    resultsAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    resultsAnchor.current?.focus({ preventScroll: true })
  }
  const applyAdvanced = () => {
    beginList()
    debounceInput.current = false
    setUseAdvanced(true)
    setPage(1)
    setRetry(n => n + 1)
    if (window.matchMedia('(max-width: 1099px)').matches) setShowAdvanced(false)
    requestAnimationFrame(viewResults)
  }
  const editSearch = () => {
    setShowAdvanced(true)
    requestAnimationFrame(() => {
      searchAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      searchAnchor.current?.querySelector('textarea')?.focus({ preventScroll: true })
    })
  }
  const close = () => { dialog.current?.close(); setSelected(null); setDetail(null) }
  const fieldSources: Record<string, string> = { 'Sumber Daya Air': '10901', 'Bina Marga': '10903', 'Cipta Karya / Perumahan': '10904', SMKK: '10899', Umum: 'permen08-2023' }
  const source = options?.sources.find(s => s.id === detail?.source_id) ?? options?.sources.find(s => s.id === fieldSources[detail?.field ?? ''])
  const result = detail ? calculateAhsp(detail, {
    volume: parseAhspNumber(volume), overhead: detail.field === 'SMKK' ? 0 : parseAhspNumber(overhead),
    prices: Object.fromEntries(Object.entries(prices).map(([id, value]) => [id, parseAhspNumber(value)])),
    coefficients: Object.fromEntries(Object.entries(coefficients).map(([id, value]) => [id, parseAhspNumber(value)])),
  }) : null
  const pages = Math.max(1, Math.ceil(total / 30))
  const divisions = options?.divisions.filter(d => !filters.field || d.field === filters.field) ?? []
  const checkedAt = options?.sources[0]?.checked_at
  const searchTerms = parseAhspSearch(filters.multiple)

  return <main className={styles.page} data-theme={theme}>
    <div className={styles.container}>
      <header className={styles.header}>
        <div><Link href="/menu" className={styles.back}>Personal Tools / Menu</Link>
          <h1>Katalog AHSP</h1><p>Item pekerjaan, komponen analisis, dan perhitungan biaya.</p></div>
        <div className={styles.regulation}><span>Katalog aktif</span><strong>Edisi 2026</strong><span>SE 47/2026 dan Permen PUPR 8/2023</span></div>
      </header>

      <div className={styles.context}>
        <span>{options ? `${number.format(options.total)} item dalam database` : 'Katalog PostgreSQL'}</span>
        <select aria-label="Tampilan" value={theme} onChange={e => setTheme(e.target.value)}><option value="system">Tema sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select>
        <button type="button" aria-expanded={showSources} onClick={() => setShowSources(v => !v)}>Sumber dan cakupan data</button>
      </div>
      {showSources && <section className={styles.sources} aria-label="Sumber dan cakupan">
        <h2>Dokumen dan hasil inventarisasi</h2>
        <p>Katalog memakai SE 47/2026 serta bidang Umum dari Permen 8/2023. Ketersediaan rincian komponen dicatat per pekerjaan. Sumber dan halaman lampiran ditampilkan pada setiap item.</p>
        {checkedAt && <p>Dokumen diperiksa: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(checkedAt))}.</p>}
        {options?.analysis.map(a => <p key={a.status}>{analysisLabels[a.status as keyof typeof analysisLabels]}: {number.format(a.count)} item.</p>)}
        {!!options?.types?.length && <><h3 className={styles.typeHeading}>Jenis item dalam katalog</h3><p>{options.types.map(type => `${ahspTypeLabel(type.type)}: ${number.format(type.count)}`).join(' · ')}.</p><p>Normatif dan Informatif mengikuti label daftar AHSP pada lampiran. Item SMKK mengikuti kelompok A.7 pada daftar isi Lampiran V, halaman PDF 4. Label yang belum terpetakan ditampilkan sebagai belum teridentifikasi.</p></>}
        <ul>{options?.sources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> ({number.format(s.page_count)} halaman)</li>)}</ul>
        {!options && <p>Informasi cakupan muncul setelah database dan impor tersedia.</p>}
      </section>}

      <div className={styles.workspace}>
      <form ref={searchAnchor} className={styles.filters} onSubmit={e => { e.preventDefault(); viewResults() }} aria-label="Filter katalog">
        <div className={styles.basicFilters}>
          <label>
            Cari satu item
            <input type="search" aria-label="Cari satu item" value={filters.q} onChange={e => changeFilter('q', e.target.value)} placeholder="Nama pekerjaan atau kode AHSP" maxLength={240} />
            {useAdvanced && searchTerms.length > 0 && <span className={styles.searchHelp}>Pencarian banyak item aktif.</span>}
          </label>
          <label>
            Regulasi
            <select value={filters.regulation} onChange={e => changeFilter('regulation', e.target.value)}>
              <option value="">Semua regulasi aktif</option>
              {AHSP_ACTIVE_REGULATIONS.map(regulation => <option key={regulation}>{regulation}</option>)}
            </select>
          </label>
        </div>
        <details className={styles.advanced} open={showAdvanced} onToggle={e => setShowAdvanced(e.currentTarget.open)}>
          <summary>Pencarian lanjutan</summary>
          <div className={styles.advancedFields}>
            <label className={styles.search}>
              <span id="ahsp-search-label">Cari banyak item atau komponen</span>
              <textarea value={filters.multiple} onChange={e => changeFilter('multiple', e.target.value)} placeholder={'Petugas pengatur lalu lintas,\nPeralatan P3K,\nRambu petunjuk'} rows={4} maxLength={6000} aria-labelledby="ahsp-search-label" aria-describedby="ahsp-search-help" />
              <span id="ahsp-search-help" className={styles.searchHelp}>Pisahkan dengan baris baru, koma, titik koma, atau {'\\'}. Hasil mencakup salah satu istilah. Maksimal 50 istilah.</span>
              {searchTerms.length > 1 && <span className={styles.searchHelp}>{searchTerms.length} istilah pencarian. Komponen dicari pada rincian yang sudah diinventarisasi.</span>}
            </label>
            <label>
              Bidang
              <select value={filters.field} onChange={e => changeFilter('field', e.target.value)}>
                <option value="">Semua bidang</option>
                {options?.fields.map(field => <option key={field}>{field}</option>)}
              </select>
            </label>
            <label>
              Divisi
              <select value={filters.division} onChange={e => changeFilter('division', e.target.value)}>
                <option value="">Semua divisi</option>
                {Array.from(new Set(divisions.map(entry => entry.division))).map(division => <option key={division}>{division}</option>)}
              </select>
            </label>
            <label>
              Satuan
              <select value={filters.unit} onChange={e => changeFilter('unit', e.target.value)}>
                <option value="">Semua satuan</option>
                {options?.units.map(unit => <option key={unit}>{unit}</option>)}
              </select>
            </label>
            <div className={styles.matchMode} role="group" aria-label="Mode pencocokan">
              <span>Mode pencocokan</span>
              <div>{([['like', 'Like-match'], ['exact', 'Exact-match']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={filters.match === mode} onClick={() => changeFilter('match', mode)}>{label}</button>)}</div>
              <p>{filters.match === 'exact' ? 'Nama atau kode harus cocok seluruhnya. Huruf besar dan kecil dianggap sama.' : 'Mencari istilah yang terdapat di dalam nama atau kode item dan komponen.'}</p>
            </div>
          </div>
          <button type="button" className={styles.showResults} onClick={applyAdvanced}>Tampilkan hasil</button>
        </details>
        <button type="button" className={styles.reset} onClick={resetFilters}>Reset pencarian</button>
      </form>

      <section ref={resultsAnchor} tabIndex={-1} className={styles.catalog} aria-label="Daftar pekerjaan" aria-busy={loading}>
        <div className={styles.listHeading}><h2>Item pekerjaan</h2>{useAdvanced && <button type="button" className={styles.editSearch} onClick={editSearch}>Ubah pencarian</button>}<span aria-live="polite">{loading ? 'Memuat katalog…' : error ? 'Katalog belum tersedia' : `${number.format(total)} hasil`}</span></div>
        {!error && !loading && useAdvanced && searchStats && searchStats.input_count > 0 && <SearchSummary stats={searchStats} total={total} types={matchedTypes} />}
        {error ? <div className={styles.notice} role="alert"><p>{error}</p><button type="button" onClick={() => { beginList(); setRetry(n => n + 1) }}>Coba lagi</button></div>
          : loading && items.length === 0 ? <p className={styles.empty} role="status">Memuat pekerjaan dari PostgreSQL…</p>
          : items.length === 0 ? <div className={styles.empty}><p>Tidak ada pekerjaan sesuai filter.</p><button type="button" onClick={resetFilters}>Tampilkan semua pekerjaan</button></div>
          : <><div className={styles.tableHeading} aria-hidden="true"><span>Kode / bidang</span><span>Pekerjaan / divisi</span><span>Satuan</span><span>Sumber regulasi</span></div>
            <ul className={styles.itemList}>{items.map(item => <li key={item.id}>
              <button type="button" className={styles.item} onClick={() => openItem(item)} aria-label={`Buka analisis ${item.code}: ${item.name}`}>
                <span className={styles.code}><strong>{item.code || 'Tanpa kode'}</strong><small>{item.field}</small></span>
                <span className={styles.name}><strong>{item.name}</strong><small>{item.division || 'Tanpa klasifikasi divisi'}{` / ${ahspTypeLabel(item.ahsp_type)}`}</small>{!!item.matched_components?.length && <small className={styles.matches}>Komponen cocok: {item.matched_components.slice(0, 4).join('; ')}{item.matched_components.length > 4 && `; +${item.matched_components.length - 4} lainnya`}</small>}</span>
                <span className={styles.unit}>{item.unit || 'Belum tersedia'}</span>
                <span className={styles.state}><span>{item.regulation}</span><small>{options?.sources.find(s => s.id === item.source_id)?.annex || 'Halaman belum terpetakan'}{item.page_from && ` / Hal. ${item.page_from}${item.page_to && item.page_to !== item.page_from ? `–${item.page_to}` : ''}`}</small></span>
              </button>
            </li>)}</ul></>}
        {!error && !loading && total > 0 && <nav className={styles.pagination} aria-label="Halaman katalog"><button type="button" disabled={page <= 1} onClick={() => { beginList(); setPage(p => p - 1) }}>Sebelumnya</button><span>Halaman {page} dari {pages}</span><button type="button" disabled={page >= pages} onClick={() => { beginList(); setPage(p => p + 1) }}>Berikutnya</button></nav>}
      </section>
      </div>
      <p className={styles.footnote}>Harga dasar mengikuti wilayah dan periode yang Anda gunakan. Hasil kalkulator belum termasuk PPN dan biaya SMKK terpisah.</p>
    </div>

    <dialog ref={dialog} className={styles.dialog} aria-labelledby="ahsp-dialog-title" onClose={() => { setSelected(null); setDetail(null) }} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close() } }}>
      <div className={styles.modalHeader}><div><span className={styles.eyebrow}>{selected?.code} / {selected?.field}</span><h2 id="ahsp-dialog-title">{selected?.name}</h2><p>{selected?.regulation} / Satuan {selected?.unit || 'belum tersedia'}</p></div><button type="button" autoFocus onClick={close} className={styles.close}>Tutup</button></div>
      {!detail && !detailError && <p className={styles.empty} role="status">Memuat komponen dan lampiran…</p>}
      {detailError && <div className={styles.notice} role="alert"><p>{detailError}</p><button type="button" onClick={() => { setDetailError(''); setDetailRetry(n => n + 1) }}>Muat ulang analisis</button></div>}
      {detail && <>
        <nav className={styles.tabs} aria-label="Rincian pekerjaan">{([['calculation', 'Komponen dan kalkulator'], ['source', 'Cara hitung dan lampiran']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</nav>
        <div className={styles.modalBody}>
          {tab === 'calculation' && <>
            <div className={styles.analysisInfo}><strong>{analysisLabels[detail.analysis_status]}</strong><span>{ahspTypeLabel(detail.ahsp_type)}{detail.regulation_status && ` / ${detail.regulation_status}`}</span></div>
            {detail.analysis_status !== 'extracted' && <p className={styles.warning}>Komponen hasil ekstraksi perlu dilengkapi atau diperiksa terhadap lampiran. Total biaya belum dapat dihitung.</p>}
            <div className={styles.calculatorInputs}><label>{detail.field === 'SMKK' ? 'Kuantitas biaya' : 'Volume pekerjaan'} ({detail.unit})<input inputMode="decimal" value={volume} onChange={e => setVolume(e.target.value)} /></label>{detail.field !== 'SMKK' && <label>Biaya umum dan keuntungan (%)<input inputMode="decimal" value={overhead} onChange={e => setOverhead(e.target.value)} placeholder={detail.overhead_min === null ? 'Isi sesuai ketentuan sumber' : `${detail.overhead_min} sampai ${detail.overhead_max}`} /></label>}</div>
            <p className={styles.help}>{detail.field === 'SMKK' ? 'Biaya SMKK = kuantitas × harga per unit. Harga contoh dalam PDF tidak digunakan.' : `Koefisien berlaku untuk ${number.format(detail.output_quantity)} ${detail.unit} hasil pekerjaan.`} Masukkan harga tanpa pemisah ribuan, misalnya 125000 atau 125000,50. Harga nol harus diisi sebagai 0.</p>
            {detail.components.length === 0 ? <p className={styles.empty}>Rincian komponen belum berhasil diinventarisasi. Periksa tab lampiran.</p> : <div className={styles.components}>{(['tenaga', 'bahan', 'alat', 'smkk'] as const).filter(group => detail.field === 'SMKK' ? group === 'smkk' : group !== 'smkk').map(group => <section key={group}><h3>{groupNames[group]}</h3>{result?.rows.filter(row => row.group === group).map(row => <div className={styles.component} key={row.id}>
              <div><strong>{row.name}</strong><small>{row.code || 'Tanpa kode komponen'} / {row.unit}</small>{row.expression && <small>Rumus sumber: {row.expression}</small>}</div>
              <label>{detail.field === 'SMKK' ? 'Basis per unit biaya' : 'Koefisien'}{row.coefficient !== null ? <span className={styles.fixedValue}>{number.format(row.coefficient)}</span> : <input inputMode="decimal" value={coefficients[row.id] ?? ''} onChange={e => setCoefficients(c => ({ ...c, [row.id]: e.target.value }))} aria-label={`Koefisien ${row.name}`} />}</label>
              <label>Harga dasar (Rp/{row.unit})<input inputMode="decimal" value={prices[row.id] ?? ''} onChange={e => setPrices(p => ({ ...p, [row.id]: e.target.value }))} aria-label={`Harga dasar ${row.name}`} /></label>
              <span className={styles.amount}>{money(row.amount)}</span>
            </div>)}{!detail.components.some(c => c.group === group) && <p className={styles.help}>Tidak ada komponen {groupNames[group].toLowerCase()} yang tercatat pada tabel ini.</p>}</section>)}</div>}
            <section className={styles.result} aria-label="Hasil kalkulator" aria-live="polite"><h3>Perhitungan biaya</h3><dl>{detail.field !== 'SMKK' && <><div><dt>Biaya langsung (A + B + C)</dt><dd>{money(result?.direct ?? null)}</dd></div><div><dt>Biaya umum dan keuntungan</dt><dd>{money(result?.overheadAmount ?? null)}</dd></div></>}<div><dt>Harga satuan per {detail.unit}</dt><dd>{money(result?.unitPrice ?? null)}</dd></div><div className={styles.total}><dt>Total × {detail.field === 'SMKK' ? 'kuantitas' : 'volume'}</dt><dd>{money(result?.total ?? null)}</dd></div></dl>{!!result?.errors.length && <p>{Array.from(new Set(result.errors)).slice(0, 3).join(' ')}{result.errors.length > 3 && ' Lengkapi harga dan koefisien komponen lainnya.'}</p>}</section>
            {detail.analysis_status !== 'extracted' && detail.field !== 'SMKK' && <ManualAnalysis key={detail.id} item={detail} />}
          </>}
          {tab === 'source' && <><h3>Cara hitung sesuai lampiran</h3><p>{detail.field === 'SMKK' ? 'Biaya SMKK = kuantitas biaya × harga per unit. Tentukan kuantitas sesuai kebutuhan pengendalian risiko proyek dan gunakan harga yang dapat dipertanggungjawabkan.' : 'Biaya langsung = jumlah (koefisien × harga dasar) seluruh komponen. Tambahkan biaya umum dan keuntungan sesuai tabel, lalu bagi dengan basis volume analisis untuk mendapatkan harga satuan. Total pekerjaan = harga satuan × volume pekerjaan.'}</p>
            <SourceReference source={source} item={detail} />
            {source && <SourcePages key={detail.id} source={source} item={detail} />}
            {detail.source_text ? <details className={styles.sourceText} open><summary>Teks tabel, asumsi, dan catatan sumber</summary><pre>{detail.source_text}</pre></details> : <p className={styles.warning}>Halaman analisis belum terpetakan. Pencocokan nama atau kode saja belum membuktikan bahwa koefisiennya sesuai.</p>}
          </>}
        </div>
      </>}
    </dialog>
  </main>
}

function SourceReference({ source, item }: { source: AhspSource | undefined; item: AhspItem }) {
  if (!source) return <p className={styles.warning}>Rujukan lampiran item ini belum ditemukan.</p>
  const url = `${source.url}#page=${item.page_from ?? 1}`
  return <div className={styles.reference}><div><strong>{source.title}</strong><p>{item.page_from ? `Halaman PDF ${item.page_from}${item.page_to && item.page_to !== item.page_from ? ` sampai ${item.page_to}` : ''}` : 'Halaman belum terpetakan'}{item.printed_page && ` / Nomor tercetak ${item.printed_page}`}</p></div><a href={url} target="_blank" rel="noopener noreferrer">Buka lampiran asli</a></div>
}
