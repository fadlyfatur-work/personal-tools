'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, WarningCircle } from '@phosphor-icons/react'
import { AHSP_CATALOG_REGULATIONS, AHSP_ARCHIVED_REGULATION, AHSP_ARCHIVE_NOTICE, ahspPhraseSearchError, sipastiLabels, calculateAhsp, parseAhspNumber, parseAhspSearch, ahspTypeLabel, formatAhspItemCopy, type AhspSearchStats, type AhspTypeCount, type AhspItem, type AhspSummary, type AhspOptions, type AhspSource } from '@/lib/ahsp'
import styles from './catalog.module.css'
import ManualAnalysis from './manual-analysis'
import SourcePages from './source-pages'
import SearchSummary from './search-summary'
import InitialPreloader from './initial-preloader'

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 5 })
const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 })
const money = (n: number | null) => n === null ? 'Belum dihitung' : rupiah.format(n)
const groupNames = { tenaga: 'Tenaga kerja', bahan: 'Bahan', alat: 'Peralatan', smkk: 'Komponen biaya SMKK' }
const analysisLabels = { extracted: 'Komponen tersedia', needs_review: 'Analisis perlu ditinjau', unavailable: 'Analisis belum tersedia' }
const initialFilters = { q: '', multiple: '', field: '', division: '', unit: '', regulation: '', match: 'like', sipasti: '' }
const fieldOrder = ['Umum', 'Sumber Daya Air', 'Bina Marga', 'Cipta Karya / Perumahan', 'SMKK']

export default function AhspCatalog() {
  const [theme, setTheme] = useState('system')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useAdvanced, setUseAdvanced] = useState(false)
  const [draftAdvanced, setDraftAdvanced] = useState(false)
  const [searchStats, setSearchStats] = useState<AhspSearchStats | null>(null)
  const [matchedTypes, setMatchedTypes] = useState<AhspTypeCount[]>([])
  const [filters, setFilters] = useState(initialFilters)
  const [searchValidation, setSearchValidation] = useState('')
  const [appliedFilters, setAppliedFilters] = useState(initialFilters)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<AhspSummary[]>([])
  const [options, setOptions] = useState<AhspOptions | null>(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [firstLoadComplete, setFirstLoadComplete] = useState(false)
  const [preloading, setPreloading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [copiedId, setCopiedId] = useState('')
  const [copyNotice, setCopyNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [selected, setSelected] = useState<AhspSummary | null>(null)
  const [itemDetail, setDetail] = useState<AhspItem | null>(null)
  const [referenceTarget, setReferenceTarget] = useState<AhspItem | null>(null)
  const [referenceReady, setReferenceReady] = useState(false)
  const [sourceView, setSourceView] = useState<'analysis' | 'origin'>('analysis')
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
    if (!copyNotice) return
    const timer = setTimeout(() => { setCopyNotice(null); setCopiedId('') }, 3000)
    return () => clearTimeout(timer)
  }, [copyNotice])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const active = appliedFilters
        const multiple = useAdvanced && parseAhspSearch(active.multiple, active.match).length > 0
        const params = new URLSearchParams({
          q: multiple ? active.multiple : active.q,
          mode: multiple ? 'multiple' : 'single',
          scope: useAdvanced && active.match !== 'phrases' ? 'all' : 'jobs',
          match: active.match,
          sipasti: active.sipasti,
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
      } finally { if (!controller.signal.aborted) { setLoading(false); setFirstLoadComplete(true) } }
    }, debounceInput.current ? 200 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [appliedFilters, page, retry, useAdvanced])

  useEffect(() => {
    if (!selected) return
    const controller = new AbortController()
    fetch(`/api/ahsp?id=${selected.id}`, { signal: controller.signal }).then(async response => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      if (!controller.signal.aborted) { setDetail(body.item); setReferenceTarget(body.reference_target ?? null); setReferenceReady(body.reference_ready === true) }
    }).catch(e => { if (!controller.signal.aborted) setDetailError(e instanceof Error ? e.message : 'Analisis gagal dimuat.') })
    if (!dialog.current?.open) dialog.current?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { controller.abort(); document.body.style.overflow = previousOverflow }
  }, [selected, detailRetry])

  const beginList = () => { setLoading(true); setError('') }
  const resetFilters = () => {
    beginList()
    setSearchValidation('')
    debounceInput.current = false
    setFilters({ ...initialFilters })
    setAppliedFilters({ ...initialFilters })
    setPage(1)
    setShowAdvanced(false)
    setUseAdvanced(false)
    setDraftAdvanced(false)
  }
  const openItem = (item: AhspSummary) => { setDetail(null); setReferenceTarget(null); setReferenceReady(false); setSourceView('analysis'); setDetailError(''); setTab('calculation'); setPrices({}); setCoefficients({}); setVolume('1'); setOverhead(''); setSelected(item) }
  const copyText = async (text: string, label: string, id = '') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setCopyNotice({ text: `${label} tersalin.`, error: false })
    } catch {
      setCopiedId('')
      setCopyNotice({ text: 'Data gagal disalin. Periksa izin clipboard browser, lalu coba lagi.', error: true })
    }
  }
  const copyItem = (item: AhspSummary) => {
    const source = options?.sources.find(s => s.id === item.source_id)
    return copyText(formatAhspItemCopy(item, source?.annex), `Data ${item.code || item.name}`, item.id)
  }
  const changeFilter = (key: keyof typeof filters, value: string) => {
    setSearchValidation('')
    const next = { ...filters, [key]: value, ...(key === 'field' ? { division: '' } : {}) }
    setFilters(next)
    if (key === 'q' || (key === 'regulation' && !draftAdvanced && !showAdvanced)) {
      beginList()
      setPage(1)
      debounceInput.current = key === 'q'
      setUseAdvanced(false)
      setDraftAdvanced(false)
      setAppliedFilters({ ...initialFilters, q: next.q, regulation: next.regulation, field: next.field })
    } else {
      setDraftAdvanced(true)
    }
  }
  const changeField = (field: string) => {
    if (field === appliedFilters.field) return
    beginList()
    debounceInput.current = false
    setPage(1)
    setFilters(current => ({ ...current, field, division: '' }))
    setAppliedFilters(current => ({ ...current, field, division: '' }))
  }
  const viewResults = () => {
    resultsAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    resultsAnchor.current?.focus({ preventScroll: true })
  }
  const applySearch = (advanced = draftAdvanced) => {
    if (advanced && filters.match === 'phrases') {
      const validation = ahspPhraseSearchError(filters.multiple)
      if (validation) { setSearchValidation(validation); return }
    }
    setSearchValidation('')
    beginList()
    debounceInput.current = false
    setUseAdvanced(advanced)
    setDraftAdvanced(advanced)
    setAppliedFilters(advanced ? { ...filters } : { ...initialFilters, q: filters.q, regulation: filters.regulation, field: filters.field })
    setPage(1)
    setRetry(n => n + 1)
    setShowAdvanced(false)
    requestAnimationFrame(viewResults)
  }
  const editSearch = () => {
    setShowAdvanced(true)
    setDraftAdvanced(true)
    requestAnimationFrame(() => {
      searchAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      searchAnchor.current?.querySelector('textarea')?.focus({ preventScroll: true })
    })
  }
  const toggleAdvanced = () => {
    setShowAdvanced(!showAdvanced)
    if (!showAdvanced) setDraftAdvanced(true)
    else if (!useAdvanced && JSON.stringify(filters) === JSON.stringify(appliedFilters)) setDraftAdvanced(false)
  }
  const close = () => { dialog.current?.close(); setSelected(null); setDetail(null) }
  const reference = itemDetail?.analysis_reference
  const detail = reference ? (referenceReady && referenceTarget ? referenceTarget : itemDetail ? { ...itemDetail, analysis_status: 'needs_review' as const } : null) : itemDetail
  const documentItem = sourceView === 'origin' && itemDetail && reference
    ? { ...itemDetail, source_id: reference.source_id, page_from: reference.source_page, page_to: reference.source_page, source_text: reference.citation }
    : sourceView === 'origin' ? itemDetail : referenceTarget ?? itemDetail
  const fieldSources: Record<string, string> = { 'Sumber Daya Air': '10901', 'Bina Marga': '10903', 'Cipta Karya / Perumahan': '10904', SMKK: '10899', Umum: 'permen08-2023' }
  const source = options?.sources.find(s => s.id === documentItem?.source_id) ?? (documentItem?.regulation === AHSP_ARCHIVED_REGULATION ? undefined : options?.sources.find(s => s.id === (documentItem?.regulation === 'PERMEN 08/2023' ? 'permen08-2023' : fieldSources[documentItem?.field ?? ''])))
  const result = detail ? calculateAhsp(detail, {
    volume: parseAhspNumber(volume), overhead: detail.field === 'SMKK' ? 0 : parseAhspNumber(overhead),
    prices: Object.fromEntries(Object.entries(prices).map(([id, value]) => [id, parseAhspNumber(value)])),
    coefficients: Object.fromEntries(Object.entries(coefficients).map(([id, value]) => [id, parseAhspNumber(value)])),
  }) : null
  const pages = Math.max(1, Math.ceil(total / 30))
  const divisions = options?.divisions.filter(d => !filters.field || d.field === filters.field) ?? []
  const checkedAt = options?.sources[0]?.checked_at
  const searchTerms = parseAhspSearch(filters.multiple, filters.match)
  const advancedPending = draftAdvanced && (!useAdvanced || JSON.stringify(filters) !== JSON.stringify(appliedFilters))
  const catalogFields = [...(options?.fields ?? [])].sort((a, b) => {
    const rank = (field: string) => fieldOrder.includes(field) ? fieldOrder.indexOf(field) : fieldOrder.length
    return rank(a) - rank(b) || a.localeCompare(b, 'id-ID')
  })

  return <main className={styles.page} data-theme={theme}>
    {preloading && <InitialPreloader pending={!firstLoadComplete} onExit={setPreloading} />}
    <div className={styles.container} inert={preloading} aria-busy={preloading}>
      <header className={styles.header}>
        <div><Link href="/menu" className={styles.back}>Personal Tools / Menu</Link>
          <h1>Katalog AHSP</h1><p>Item pekerjaan, komponen analisis, dan perhitungan biaya.</p></div>
        <div className={styles.regulation}><span>Regulasi aktif dan arsip</span><strong>Edisi 2026</strong><span>SE 47/2026 dan Permen PUPR 8/2023</span><span>Arsip SE 182/2025</span></div>
      </header>

      <div className={styles.context}>
        <Link href="/ahsp/mptk" className={styles.mptkButton}>Rekapitulasi MPTK</Link>
        <span>{options ? `${number.format(options.total)} pekerjaan unik${options.version_total ? ` · ${number.format(options.version_total)} versi/sumber` : ''}` : 'Katalog PostgreSQL'}</span>
        <select aria-label="Tampilan" value={theme} onChange={e => setTheme(e.target.value)}><option value="system">Tema sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select>
        <button type="button" aria-expanded={showSources} onClick={() => setShowSources(v => !v)}>Sumber dan cakupan data</button>
      </div>
      {showSources && <section className={styles.sources} aria-label="Sumber dan cakupan">
        <h2>Dokumen dan hasil inventarisasi</h2>
        <p>Katalog memuat SE 47/2026 serta bidang Umum dan SMKK dari Permen 8/2023. SE 182/2025 tersedia sebagai arsip dari ekspor SIPASTI dan sudah digantikan oleh SE 47/2026. Pilih regulasi arsip untuk melihatnya. Rincian komponen dan halaman lampiran edisi arsip belum tersedia.</p>
        {checkedAt && <p>Dokumen diperiksa: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(checkedAt))}.</p>}
        {options?.analysis.map(a => <p key={a.status}>{analysisLabels[a.status as keyof typeof analysisLabels]}: {number.format(a.count)} item.</p>)}
        {!!options?.types?.length && <><h3 className={styles.typeHeading}>Jenis item dalam katalog</h3><p>{options.types.map(type => `${ahspTypeLabel(type.type)}: ${number.format(type.count)}`).join(' · ')}.</p><p>Normatif dan Informatif mengikuti daftar lampiran untuk item hasil inventarisasi, atau label ekspor untuk item tambahan SIPASTI. SMKK SE 47/2026 mengikuti kelompok A.7 pada daftar isi Lampiran V, halaman PDF 4. Jenis SMKK Permen 8/2023 mengikuti ekspor SIPASTI; rincian lampirannya belum terpetakan. Label yang belum terpetakan ditampilkan sebagai belum teridentifikasi.</p></>}
        <ul>{options?.sources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> ({number.format(s.page_count)} halaman)</li>)}</ul>
        {!options && <p>Informasi cakupan muncul setelah database dan impor tersedia.</p>}
      </section>}

      <div className={styles.workspace}>
      <form ref={searchAnchor} className={styles.filters} onSubmit={e => { e.preventDefault(); applySearch() }} aria-label="Filter katalog">
        <div className={styles.basicFilters}>
          <label>
            Cari satu item
            <input type="search" aria-label="Cari satu item" value={filters.q} onChange={e => changeFilter('q', e.target.value)} placeholder="Nama pekerjaan atau kode AHSP" maxLength={240} />
            {useAdvanced && parseAhspSearch(appliedFilters.multiple).length > 0 && <span className={styles.searchHelp}>Pencarian banyak item aktif.</span>}
          </label>
          <label>
            Regulasi
            <select value={filters.regulation} onChange={e => changeFilter('regulation', e.target.value)}>
              <option value="">Semua regulasi aktif</option>
              {AHSP_CATALOG_REGULATIONS.map(regulation => <option key={regulation} value={regulation}>{regulation}{regulation === AHSP_ARCHIVED_REGULATION && ' (arsip)'}</option>)}
            </select>
          </label>
        </div>
        <fieldset className={styles.fieldFilters}>
          <legend>Bidang</legend>
          <div className={styles.fieldOptions}>
            <button type="button" disabled={!options} aria-pressed={filters.field === ''} onClick={() => changeField('')}>Semua ({options ? number.format(options.total) : '…'})</button>
            {catalogFields.map(field => {
              const count = options?.field_counts?.find(entry => entry.field === field)?.count
              return <button key={field} type="button" aria-pressed={filters.field === field} onClick={() => changeField(field)}>{field} ({typeof count === 'number' ? number.format(count) : '…'})</button>
            })}
          </div>
          <p className={styles.searchHelp}>Jumlah nama pekerjaan unik per bidang, termasuk arsip, sebelum filter pencarian. Nama yang sama ditampilkan dalam satu baris.</p>
        </fieldset>
        {advancedPending && <p className={styles.searchHelp} role="status">Perubahan pencarian lanjutan belum diterapkan. {showAdvanced ? 'Klik Cari' : 'Buka pencarian lanjutan dan klik Cari'} untuk memperbarui hasil.</p>}
        <div className={styles.filterTools}>
          <button type="button" aria-expanded={showAdvanced} aria-controls="ahsp-advanced" onClick={toggleAdvanced}>{showAdvanced ? 'Tutup pencarian lanjutan' : 'Pencarian lanjutan'}{!showAdvanced && useAdvanced && <span className={styles.activeFilter}> Filter aktif</span>}</button>
          <button type="button" className={styles.reset} onClick={resetFilters}>Reset pencarian</button>
        </div>
        {showAdvanced && <section id="ahsp-advanced" className={styles.advanced} aria-label="Pencarian lanjutan">
          <div className={styles.advancedFields}>
            <div className={styles.search}>
              <div className={styles.searchEntryHeader}>
                <label htmlFor="ahsp-multiple">{filters.match === 'phrases' ? 'Cari gabungan frasa dalam nama pekerjaan' : 'Cari banyak item atau komponen'}</label>
                <div className={styles.matchMode} role="group" aria-label="Mode pencocokan">
                  {([['like', 'Like-match'], ['exact', 'Exact-match'], ['phrases', 'Gabungan frasa']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={filters.match === mode} onClick={() => changeFilter('match', mode)}>{label}</button>)}
                </div>
              </div>
              <div className={styles.searchInputRow}>
                <textarea id="ahsp-multiple" value={filters.multiple} onChange={e => changeFilter('multiple', e.target.value)} placeholder={filters.match === 'phrases' ? '"Mobilisasi dan Demobilisasi" "Alat Berat" "Excavator"' : 'Petugas pengatur lalu lintas\nPeralatan P3K\nRambu petunjuk'} rows={4} maxLength={6000} aria-invalid={!!searchValidation} aria-describedby={`ahsp-search-help ahsp-match-help${searchValidation ? ' ahsp-search-validation' : ''}`} />
                <button type="button" className={styles.searchSubmit} onClick={() => applySearch(true)}>Cari{searchTerms.length > 1 ? ` ${searchTerms.length} ${filters.match === 'phrases' ? 'frasa' : 'istilah'}` : ''}</button>
              </div>
              <p id="ahsp-search-help" className={styles.searchHelp}>{filters.match === 'phrases' ? 'Gunakan tanda kutip untuk mengelompokkan frasa. Kata tanpa tanda kutip dihitung terpisah. Maksimal 50 frasa.' : <>Pisahkan dengan baris baru, titik koma, atau {'\\'}. Koma menjadi bagian teks pencarian. Maksimal 50 istilah.</>}</p>
              <p id="ahsp-match-help" className={styles.searchHelp}>{filters.match === 'phrases' ? 'Menampilkan pekerjaan yang namanya mengandung minimal 2 frasa berbeda, tanpa membedakan huruf besar dan kecil. Kecocokan terbanyak ditampilkan lebih dulu.' : filters.match === 'exact' ? 'Nama atau kode harus cocok seluruhnya, tanpa membedakan huruf besar dan kecil.' : 'Mencari sebagian nama atau kode pekerjaan dan komponen.'}{searchTerms.length > 0 && ` ${searchTerms.length} ${filters.match === 'phrases' ? 'frasa' : 'istilah'}.`}</p>
              {searchValidation && <p id="ahsp-search-validation" role="alert">{searchValidation}</p>}
            </div>
            <div className={styles.refinementFields}>
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
            </div>
          </div>
          <fieldset className={styles.sipastiFilters}>
            <legend>Kecocokan dengan SIPASTI PU</legend>
            <div className={styles.fieldOptions}>
              {Object.entries(sipastiLabels).map(([status, label]) => <button key={status} type="button" aria-pressed={filters.sipasti === status} onClick={() => changeFilter('sipasti', filters.sipasti === status ? '' : status)}>{label}</button>)}
            </div>
            <p className={styles.searchHelp}>Verfied berarti item ada di kedua sumber berdasarkan kode, bidang, dan regulasi. Status ini tidak menilai kelengkapan analisis. Klik filter aktif lagi untuk menampilkan semua status, lalu klik Cari.</p>
          </fieldset>
        </section>}
      </form>

      <section ref={resultsAnchor} tabIndex={-1} className={styles.resultsArea} aria-label="Daftar pekerjaan" aria-busy={loading}>
        <div className={styles.listHeading}><div className={styles.listTitle}><h2>Item pekerjaan</h2>{useAdvanced && <button type="button" className={styles.editSearch} onClick={editSearch}>Ubah pencarian</button>}</div><span aria-live="polite">{loading ? 'Memuat katalog…' : error ? 'Katalog belum tersedia' : `${number.format(total)} hasil`}</span></div>
        <div className={styles.resultsLayout} data-summary={!error && useAdvanced && !!searchStats?.input_count}>
        {!error && useAdvanced && searchStats && searchStats.input_count > 0 && <SearchSummary stats={searchStats} total={total} types={matchedTypes} busy={loading} />}
        <div className={styles.catalog}>
        {error ? <div className={styles.notice} role="alert"><p>{error}</p><button type="button" onClick={() => { beginList(); setRetry(n => n + 1) }}>Coba lagi</button></div>
          : loading && items.length === 0 ? <p className={styles.empty} role="status">Memuat pekerjaan dari PostgreSQL…</p>
          : items.length === 0 ? <div className={styles.empty}><p>Tidak ada pekerjaan sesuai filter.</p><button type="button" onClick={resetFilters}>Tampilkan semua pekerjaan</button></div>
          : <><div className={styles.tableHeading} aria-hidden="true"><span>Kode / bidang</span><span>Pekerjaan / divisi</span><span>Satuan</span><span>Sumber regulasi</span><span>Salin</span></div>
            <ul className={styles.itemList}>{items.map(item => <li key={item.id}>
              <div className={styles.item}>
                <button type="button" className={styles.openItem} onClick={() => openItem(item)} aria-label={`Buka analisis ${item.code}: ${item.name}`} />
                <span className={styles.code}>{item.code ? <button type="button" className={styles.textCopy} onClick={() => copyText(item.code, `Kode ${item.code}`)} aria-label={`Salin kode ${item.code}`} title="Salin kode">{item.code}</button> : <strong>Tanpa kode</strong>}<small>{item.field}</small></span>
                <div className={styles.name}><button type="button" className={styles.textCopy} onClick={() => copyText(item.name, `Nama ${item.code || item.name}`)} aria-label={`Salin nama ${item.name}`} title="Salin nama pekerjaan">{item.name}</button>{item.sipasti_status && <small className={styles.sipastiTag} title="Status keberadaan item pada katalog dan ekspor SIPASTI PU">{sipastiLabels[item.sipasti_status]}</small>}{item.analysis_reference && <button type="button" className={styles.referenceLink} onClick={() => openItem(item)}>Analisis mengacu {item.analysis_reference.target_regulation} · {item.analysis_reference.target_code}{item.analysis_reference.status !== 'verified' && ' · Perlu ditinjau'}</button>}<small>{item.division || 'Tanpa klasifikasi divisi'}{` / ${ahspTypeLabel(item.ahsp_type)}`}</small>{!!item.matched_components?.length && <small className={styles.matches}>Komponen cocok: {item.matched_components.slice(0, 4).join('; ')}{item.matched_components.length > 4 && `; +${item.matched_components.length - 4} lainnya`}</small>}
                  {item.versions && item.versions.length > 1 && <details className={styles.versions}>
                    <summary>Versi dan sumber lainnya ({item.versions.length - 1})</summary>
                    <ul className={styles.versionList}>{item.versions.map(version => <li key={version.id}>
                      <strong>{version.regulation}</strong>
                      <small>{version.code || 'Tanpa kode'} · {version.field} · {version.unit || 'Satuan belum tersedia'} · {ahspTypeLabel(version.ahsp_type)}</small>
                      {version.regulation === AHSP_ARCHIVED_REGULATION && <small>{AHSP_ARCHIVE_NOTICE}</small>}
                      {version.id === item.id ? <small>Versi ditampilkan</small> : <button type="button" onClick={() => openItem(version)} aria-label={`Buka versi ${version.regulation} ${version.code || 'tanpa kode'} ${version.field} ${version.unit}: ${version.name}`}>Buka versi</button>}
                    </li>)}</ul>
                  </details>}
                </div>
                <span className={styles.unit}>{item.unit || 'Belum tersedia'}</span>
                <span className={styles.state}><span>{item.regulation}</span>{item.regulation === AHSP_ARCHIVED_REGULATION && <small className={styles.archiveTag}>{AHSP_ARCHIVE_NOTICE}</small>}<small>{options?.sources.find(s => s.id === item.source_id)?.annex || 'Halaman belum terpetakan'}{item.page_from && ` / Hal. ${item.page_from}${item.page_to && item.page_to !== item.page_from ? `–${item.page_to}` : ''}`}</small>{item.analysis_reference && <small>Acuan analisis: {item.analysis_reference.target_regulation}</small>}</span>
              </div>
              <button type="button" className={styles.copyButton} onClick={() => copyItem(item)} aria-label={`Salin data ${item.code}: ${item.name}`} title={copiedId === item.id ? 'Data tersalin' : 'Salin data item'}>{copiedId === item.id ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}</button>
            </li>)}</ul></>}
        {!error && !loading && total > 0 && <nav className={styles.pagination} aria-label="Halaman katalog"><button type="button" disabled={page <= 1} onClick={() => { beginList(); setPage(p => p - 1) }}>Sebelumnya</button><span>Halaman {page} dari {pages}</span><button type="button" disabled={page >= pages} onClick={() => { beginList(); setPage(p => p + 1) }}>Berikutnya</button></nav>}
        </div>
        </div>
      </section>
      </div>
      <div className={styles.copyToastRegion} role="status" aria-live="polite" aria-atomic="true">
        {copyNotice && <div className={styles.copyToast} data-error={copyNotice.error}>
          {copyNotice.error ? <WarningCircle size={20} aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
          <p>{copyNotice.text}</p>
        </div>}
      </div>
      <p className={styles.footnote}>Harga dasar mengikuti wilayah dan periode yang Anda gunakan. Hasil kalkulator belum termasuk PPN dan biaya SMKK terpisah.</p>
    </div>

    <dialog ref={dialog} className={styles.dialog} aria-labelledby="ahsp-dialog-title" onClose={() => { setSelected(null); setDetail(null) }} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close() } }}>
      <div className={styles.modalHeader}><div><span className={styles.eyebrow}>{selected?.code} / {selected?.field}</span><h2 id="ahsp-dialog-title">{selected?.name}</h2><p>{selected?.regulation} / Satuan {selected?.unit || 'belum tersedia'}</p>{selected?.regulation === AHSP_ARCHIVED_REGULATION && <p className={styles.archiveTag}>{AHSP_ARCHIVE_NOTICE}. Data ini merupakan arsip regulasi.</p>}</div><button type="button" autoFocus onClick={close} className={styles.close}>Tutup</button></div>
      {!detail && !detailError && <p className={styles.empty} role="status">Memuat komponen dan lampiran…</p>}
      {detailError && <div className={styles.notice} role="alert"><p>{detailError}</p><button type="button" onClick={() => { setDetailError(''); setDetailRetry(n => n + 1) }}>Muat ulang analisis</button></div>}
      {detail && <>
        {reference && <section className={styles.referencePanel} aria-label="Rujukan analisis">
          <h3>{itemDetail?.code} → {reference.target_code}</h3>
          <p>{referenceReady ? `Komponen dan kalkulator menggunakan ${reference.target_regulation}, kode ${reference.target_code}.` : 'Rujukan ditemukan, tetapi analisis belum lolos pemeriksaan. Kalkulator belum memakai acuan ini.'}</p>
          {!referenceReady && <p>{reference.notes.join(' · ') || 'Data analisis berubah sejak pemeriksaan; perlu diperiksa ulang.'}</p>}
          <details><summary>Teks rujukan dalam SE</summary><p>{reference.citation}</p></details>
          <div>{referenceTarget && <button type="button" onClick={() => openItem(referenceTarget)}>Buka analisis acuan</button>}<button type="button" onClick={() => { setSourceView('origin'); setTab('source') }}>Lihat rujukan dalam SE</button><button type="button" disabled={!referenceTarget} onClick={() => { setSourceView('analysis'); setTab('source') }}>Lampiran analisis Permen</button></div>
        </section>}
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
            {detail.analysis_status !== 'extracted' && detail.field !== 'SMKK' && !reference && <ManualAnalysis key={detail.id} item={detail} />}
          </>}
          {tab === 'source' && <><h3>Cara hitung sesuai lampiran</h3><p>{detail.field === 'SMKK' ? 'Biaya SMKK = kuantitas biaya × harga per unit. Tentukan kuantitas sesuai kebutuhan pengendalian risiko proyek dan gunakan harga yang dapat dipertanggungjawabkan.' : 'Biaya langsung = jumlah (koefisien × harga dasar) seluruh komponen. Tambahkan biaya umum dan keuntungan sesuai tabel, lalu bagi dengan basis volume analisis untuk mendapatkan harga satuan. Total pekerjaan = harga satuan × volume pekerjaan.'}</p>
            {documentItem && <SourceReference source={source} item={documentItem} />}
            {source && documentItem && <SourcePages key={documentItem.id} source={source} item={documentItem} />}
            {documentItem?.source_text ? <details className={styles.sourceText} open><summary>Teks tabel, asumsi, dan catatan sumber</summary><pre>{documentItem.source_text}</pre></details> : <p className={styles.warning}>Halaman analisis belum terpetakan. Pencocokan nama atau kode saja belum membuktikan bahwa koefisiennya sesuai.</p>}
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
