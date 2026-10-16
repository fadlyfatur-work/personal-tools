'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, DownloadSimple } from '@phosphor-icons/react'
import { ahspPhraseSearchError } from '@/lib/ahsp'
import { RAB_FIELDS as fields, RAB_MAX_BYTES, RAB_MAX_ROWS, RAB_MAX_SHEETS, extractRabRows, matchRabRow, rabRecap, rabPrimary, rabDifferences, rabSuggestions, rabText, rabAmountWarning, type RabSheet, type RabMapping, type RabRow, type RabCandidate } from '@/lib/ahspRab'
import { readRabWorkbook, exportRabWorkbook } from '@/lib/ahspRabExcel'
import base from '../catalog.module.css'
import styles from './reconciliation.module.css'
import SheetMapping from './sheet-mapping'

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 5 })
const value = (n: number | null) => n === null ? 'Kosong' : number.format(n)
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const label = (row: RabRow) => ({ pending: 'Belum dicocokkan', review: 'Perlu ditinjau', missing: 'Belum ditemukan', matched: row.manual ? 'Cocok · manual' : 'Cocok · otomatis' })[row.status]
type EditDraft = { name: string; code: string; unit: string; volume: string; price: string; total: string; excluded: boolean; exclusion: string; acknowledged: boolean }

export default function RabReconciliation() {
  const [theme, setTheme] = useState('system')
  const [filename, setFilename] = useState('')
  const [sheets, setSheets] = useState<RabSheet[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [rows, setRows] = useState<RabRow[]>([])
  const [phase, setPhase] = useState<'empty' | 'reading' | 'config' | 'matching' | 'results'>('empty')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [limitedAccepted, setLimitedAccepted] = useState(false)
  const [duplicatesAccepted, setDuplicatesAccepted] = useState(false)
  const [catalog, setCatalog] = useState<RabCandidate[]>([])
  const [catalogAt, setCatalogAt] = useState('')
  const [tab, setTab] = useState<'matched' | 'unmatched'>('unmatched')
  const [page, setPage] = useState(1)
  const [showExcluded, setShowExcluded] = useState(false)
  const [editing, setEditing] = useState<RabRow | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [editError, setEditError] = useState('')
  const [searching, setSearching] = useState<RabRow | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'like' | 'phrases'>('phrases')
  const [suggestions, setSuggestions] = useState<RabCandidate[]>([])
  const [searchError, setSearchError] = useState('')
  const [suggestionPage, setSuggestionPage] = useState(1)
  const [pending, setPending] = useState<{ row: RabRow; candidate: RabCandidate } | null>(null)
  const [resolution, setResolution] = useState('')
  const [exporting, setExporting] = useState(false)
  const editDialog = useRef<HTMLDialogElement>(null)
  const searchDialog = useRef<HTMLDialogElement>(null)
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const dirty = useRef(false)
  const chosen = sheets.filter(sheet => selected.includes(sheet.name))
  const previewRows = useMemo(() => sheets.filter(sheet => selected.includes(sheet.name)).flatMap(sheet => extractRabRows(sheet, sheet.mapping)), [sheets, selected])
  const recap = rabRecap(phase === 'config' ? previewRows : rows)
  const limited = chosen.filter(sheet => sheet.lastRow > RAB_MAX_ROWS)
  const complete = phase === 'results' && recap.pending === 0 && recap.issues === 0 && recap.excludedReview === 0
  const filtered = rows.filter(row => !row.excluded && (tab === 'matched' ? row.status === 'matched' : row.status !== 'matched'))
  const pages = Math.max(1, Math.ceil(filtered.length / 25))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25)
  const duplicates = chosen.flatMap((sheet, i) => chosen.slice(i + 1).flatMap(other => {
    const a = new Set(extractRabRows(sheet, sheet.mapping).filter(r => !r.excluded).map(r => rabText(r.name)))
    const b = new Set(extractRabRows(other, other.mapping).filter(r => !r.excluded).map(r => rabText(r.name)))
    const overlap = [...a].filter(name => b.has(name)).length
    return overlap >= 2 && overlap / Math.max(1, Math.min(a.size, b.size)) > .5 ? [`${sheet.name} dan ${other.name}: ${overlap} uraian sama.`] : []
  }))

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', before)
    const activeRequest = request
    return () => { activeRequest.current?.abort(); window.removeEventListener('beforeunload', before) }
  }, [])
  useEffect(() => { if (editing && !editDialog.current?.open) editDialog.current?.showModal() }, [editing])
  useEffect(() => { if (searching && !searchDialog.current?.open) searchDialog.current?.showModal() }, [searching])
  useEffect(() => { if (pending && !confirmDialog.current?.open) confirmDialog.current?.showModal() }, [pending])

  const closeEdit = () => { editDialog.current?.close(); setEditing(null); setDraft(null) }
  const closeSearch = () => { searchDialog.current?.close(); setSearching(null) }
  const closeConfirm = () => { confirmDialog.current?.close(); setPending(null); setResolution('') }
  const replaceRow = (row: RabRow) => { setRows(current => current.map(item => item.id === row.id ? row : item)); dirty.current = true }
  const reset = () => {
    if (dirty.current && !window.confirm('Hasil dan keputusan manual akan dikosongkan. Lanjutkan? Unduh hasil terlebih dahulu jika masih diperlukan.')) return
    generation.current++; request.current?.abort(); setRows([]); setSheets([]); setSelected([]); setFilename(''); setPhase('empty'); setError(''); setNotice(''); dirty.current = false
    if (input.current) input.current.value = ''
  }
  async function upload(file?: File) {
    if (!file) return
    const id = ++generation.current
    request.current?.abort(); setRows([]); setSheets([]); setSelected([]); setError(''); setNotice(''); setFilename(file.name); setPhase('reading'); setLimitedAccepted(false); setDuplicatesAccepted(false); dirty.current = false
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Pilih file Excel Workbook (.xlsx).')
      if (file.size > RAB_MAX_BYTES) throw new Error('Ukuran file maksimal 10 MB.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      await tick()
      if (id !== generation.current) return
      const data = readRabWorkbook(bytes)
      if (!data.some(sheet => Object.keys(sheet.cells).length)) throw new Error('Tidak ada isi sel yang dapat dibaca. Workbook gambar tidak didukung.')
      setSheets(data); setSelected(data.filter(sheet => !sheet.hidden && sheet.lastRow > 0).slice(0, 1).map(sheet => sheet.name)); setPhase('config')
    } catch (e) { if (id === generation.current) { setError(e instanceof Error ? e.message : 'Workbook gagal dibaca.'); setPhase('empty') } }
  }
  const changeMapping = (name: string, mapping: RabMapping) => {
    setSheets(current => current.map(sheet => sheet.name === name ? { ...sheet, mapping } : sheet)); setError(''); setDuplicatesAccepted(false)
  }
  async function process(resume = false) {
    setError(''); setNotice(''); setPage(1)
    if (!selected.length || selected.length > RAB_MAX_SHEETS) { setError('Pilih minimal 1 dan maksimal 3 sheet.'); return }
    if (limited.length && !limitedAccepted) { setError('Konfirmasikan batas 1.000 baris atau batalkan proses.'); return }
    if (duplicates.length && !duplicatesAccepted) { setError('Periksa potensi penghitungan ganda antar-sheet terlebih dahulu.'); return }
    for (const sheet of chosen) {
      const mapping = sheet.mapping
      if (!mapping.name || !Number.isInteger(mapping.start) || mapping.start < 1 || mapping.start > RAB_MAX_ROWS) { setError(`Periksa kolom uraian dan awal data pada ${sheet.name}.`); return }
      const cols = Object.entries(mapping).filter(([key, val]) => key !== 'start' && val).map(([, val]) => val)
      if (new Set(cols).size !== cols.length) { setError(`Kolom pada ${sheet.name} tidak boleh dipakai untuk dua jenis data.`); return }
    }
    const initial = resume ? rows : chosen.flatMap(sheet => extractRabRows(sheet, sheet.mapping))
    if (!initial.some(row => !row.excluded)) { setError('Belum ada item pekerjaan. Periksa kolom, awal data, dan baris yang dikecualikan.'); setRows(initial); setPhase('results'); return }
    setRows(initial); setPhase('matching'); dirty.current = true
    const id = ++generation.current, controller = new AbortController()
    request.current?.abort(); request.current = controller
    try {
      let reference = catalog
      if (!reference.length) {
        const response = await fetch('/api/ahsp/rab', { signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Katalog gagal dimuat.')
        if (!Array.isArray(body.items) || !body.items.length) throw new Error('Katalog pekerjaan belum tersedia.')
        if (id !== generation.current || controller.signal.aborted) return
        reference = body.items; setCatalog(reference); setCatalogAt(body.loadedAt)
      }
      const result = [...initial]
      const memo = new Map<string, Pick<RabRow, 'candidates' | 'candidate' | 'status'>>()
      for (let i = 0; i < result.length; i++) {
        if (id !== generation.current || controller.signal.aborted) return
        const row = result[i]
        if (!row.excluded && !row.manual) {
          const key = JSON.stringify([row.name, row.unit, row.reviewed])
          const cached = memo.get(key)
          const next = cached ? { ...row, ...cached } : matchRabRow(row, reference)
          if (!cached) memo.set(key, { candidates: next.candidates, candidate: next.candidate, status: next.status })
          result[i] = next
        }
        if (i % 20 === 0) { setRows([...result]); await tick() }
      }
      setRows(result); setPhase('results'); setNotice('Pencocokan selesai. Periksa hasil otomatis, rekomendasi, dan baris yang dikecualikan.')
    } catch (e) { if (id === generation.current) { setError(e instanceof Error ? e.message : 'Pencocokan gagal.'); setPhase('results') } }
  }
  const stop = () => { generation.current++; request.current?.abort(); setPhase('results'); setNotice('Proses dihentikan. Rekap sementara mencakup item yang sudah dibaca; sebagian belum dicocokkan.') }
  const openEdit = (row: RabRow) => {
    setEditing(row); setEditError(''); setDraft({ name: row.name, code: row.code, unit: row.unit, volume: row.volume === null ? '' : String(row.volume), price: row.price === null ? '' : String(row.price), total: row.total === null ? '' : String(row.total), excluded: row.excluded, exclusion: row.exclusion, acknowledged: row.reviewed })
  }
  const restoreReading = () => {
    if (!editing) return
    const sheet = chosen.find(sheet => sheet.name === editing.sheet)
    const original = sheet && extractRabRows(sheet, sheet.mapping).find(row => row.id === editing.id)
    if (!original) return
    setDraft({ name: original.name, code: original.code, unit: original.unit, volume: original.volume === null ? '' : String(original.volume), price: original.price === null ? '' : String(original.price), total: original.total === null ? '' : String(original.total), excluded: original.excluded, exclusion: original.exclusion, acknowledged: original.reviewed }); setEditError('')
  }
  const saveEdit = () => {
    if (!editing || !draft) return
    if (!draft.name.trim() || draft.name.trim() === 'Uraian belum terbaca') { setEditError('Isi uraian pekerjaan yang terbaca.'); return }
    if (draft.excluded && !draft.exclusion.trim()) { setEditError('Isi alasan pengecualian.'); return }
    if (!draft.excluded && !draft.acknowledged) { setEditError('Konfirmasikan pemeriksaan uraian dan pasangan angka.'); return }
    const numeric = [draft.volume, draft.price, draft.total].map(text => text === '' ? null : Number(text))
    if (numeric.some(n => n !== null && !Number.isFinite(n))) { setEditError('Angka berada di luar batas yang dapat dibaca.'); return }
    let next: RabRow = { ...editing, name: draft.name.trim(), code: draft.code.trim(), unit: draft.unit.trim(), volume: numeric[0], price: numeric[1], total: numeric[2], excluded: draft.excluded, exclusion: draft.exclusion.trim(), reviewed: draft.excluded || draft.acknowledged, candidate: null, candidates: [], manual: false, status: 'pending', resolution: '', history: [...editing.history, `${new Date().toISOString()}: pembacaan diperiksa/dikoreksi; ${draft.excluded ? `dikecualikan: ${draft.exclusion}` : 'item diikutkan'}.`] }
    if (catalog.length) next = matchRabRow(next, catalog)
    replaceRow(next); closeEdit()
  }
  const openSearch = (row: RabRow) => {
    setSearching(row); setQuery(row.name); setMode('phrases'); setSuggestions(row.candidates.length ? row.candidates : rabSuggestions(row.name, catalog, 'phrases', '', row.unit)); setSearchError(''); setSuggestionPage(1)
  }
  const runSearch = () => {
    if (!searching) return
    const validation = mode === 'phrases' ? ahspPhraseSearchError(query) : !query.trim() ? 'Isi kata atau frasa pencarian.' : ''
    if (validation) { setSearchError(validation); return }
    const found = rabSuggestions(searching.name, catalog, mode, query, searching.unit)
    setSuggestions(found); setSuggestionPage(1); setSearchError('')
  }
  const selectCandidate = (row: RabRow, candidate: RabCandidate) => { setPending({ row, candidate }); setResolution('') }
  const confirmCandidate = () => {
    if (!pending || !pending.row.reviewed) return
    const differences = rabDifferences(pending.row, pending.candidate)
    if (differences.length && !resolution.trim()) return
    replaceRow({ ...pending.row, candidate: pending.candidate, status: 'matched', manual: true, resolution: resolution.trim(), history: [...pending.row.history, `${new Date().toISOString()}: pasangan manual ${pending.candidate.code} / ${pending.candidate.name} / ${pending.candidate.regulation}. ${resolution.trim()}`] })
    setNotice('Pasangan digunakan. Rekap diperbarui; angka sumber tetap dipertahankan.'); closeConfirm(); closeSearch()
  }
  const undo = (row: RabRow) => {
    replaceRow({ ...row, candidate: null, status: 'review', manual: true, resolution: '', history: [...row.history, `${new Date().toISOString()}: pasangan dibatalkan.`] }); setNotice('Pasangan dibatalkan. Item kembali ke tab Tidak cocok.')
  }
  const download = async () => {
    setExporting(true); setError('')
    try {
      await tick()
      const bytes = exportRabWorkbook(rows, { filename, sheets: chosen.map(sheet => ({ name: sheet.name, lastRow: sheet.lastRow, start: sheet.mapping.start })), catalogAt, completed: complete })
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = `Rekap Pencocokan - ${filename}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000)
      setNotice('File hasil disiapkan untuk diunduh. Rekap mencakup seluruh halaman tabel.'); dirty.current = false
    } catch { setError('File hasil gagal dibuat. Data tetap tersedia; coba unduh lagi.') }
    finally { setExporting(false) }
  }
  const candidateList = (list: RabCandidate[], row: RabRow) => list.map(candidate => <div className={styles.recommendation} key={candidate.id}>
    <strong>{candidate.name}</strong><small>{candidate.code || 'Tanpa kode'} · {candidate.unit || 'Satuan kosong'} · {candidate.regulation}{!rabPrimary(candidate) && ` · ${candidate.regulation_status || 'Referensi tambahan'}`}</small>
    {rabDifferences(row, candidate).length > 0 && <small>{rabDifferences(row, candidate).join(' ')}</small>}
    <button type="button" onClick={() => selectCandidate(row, candidate)} disabled={!row.reviewed}><Check size={17} aria-hidden="true" /> Gunakan</button>
  </div>)
  const table = (list: RabRow[], title: string) => <section className={styles.resultGroup} key={title} aria-label={title}>
    <h3>{title}</h3><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`Tabel ${title}`}><table>
      <thead><tr><th scope="col">Pekerjaan dari Excel</th><th scope="col">Volume dan harga sumber</th><th scope="col">Pasangan / rekomendasi AHSP</th><th scope="col">Tindakan</th></tr></thead>
      <tbody>{list.map(row => <tr key={row.id}>
        <td data-label="Pekerjaan dari Excel"><strong>{row.name}</strong>{row.name !== row.originalName && <small>Asli: {row.originalName}</small>}<small>{row.code || 'Tanpa kode'} · {row.sheet}!{row.source} · baris {row.row}</small><span className={styles.state}>{label(row)}</span>{!row.reviewed && <p className={styles.problem}>Pembacaan perlu dikonfirmasi.</p>}</td>
        <td data-label="Volume dan harga sumber"><dl className={styles.numbers}><div><dt>Volume</dt><dd>{value(row.volume)} {row.unit}</dd></div><div><dt>Harga Satuan (Rupiah)</dt><dd>{value(row.price)}</dd></div><div><dt>Total (Rupiah)</dt><dd>{value(row.total)}</dd></div></dl>{rabAmountWarning(row) && <small>{rabAmountWarning(row)}</small>}</td>
        <td data-label="Pasangan / rekomendasi AHSP">{row.candidate ? <><strong>{row.candidate.name}</strong><small>{row.candidate.code || 'Tanpa kode'} · {row.candidate.unit} · {row.candidate.regulation}</small>{!rabPrimary(row.candidate) && <p className={styles.problem}>{row.candidate.regulation_status || 'Referensi tambahan'}</p>}{row.resolution && <small>Catatan manual: {row.resolution}</small>}</> : row.candidates.length ? candidateList(row.candidates.slice(0, 2), row) : <p>{row.status === 'pending' ? 'Menunggu pencocokan.' : 'Belum ada rekomendasi. Coba kata kunci atau gabungan frasa lain.'}</p>}</td>
        <td data-label="Tindakan"><div className={styles.rowActions}><button type="button" onClick={() => openEdit(row)}>Periksa data</button><button type="button" onClick={() => openSearch(row)} disabled={!catalog.length || !row.reviewed}>Cari pasangan</button>{row.candidate && <button type="button" onClick={() => undo(row)}>Batalkan pasangan</button>}</div></td>
      </tr>)}</tbody>
    </table></div></section>

  return <main className={`${base.page} ${styles.app}`} data-theme={theme}><div className={base.container}>
    <header className={base.header}><div><Link href="/ahsp" onClick={e => { if (dirty.current && !window.confirm('Hasil belum diunduh setelah perubahan terakhir. Tinggalkan halaman?')) e.preventDefault() }}>Kembali ke katalog AHSP</Link><h1>Pencocokan RAB</h1><p>Cocokkan pekerjaan Excel dengan SE 47/2026 dan Permen 08/2023. Referensi tambahan ditampilkan terpisah.</p></div>
      <select aria-label="Tampilan" value={theme} onChange={e => setTheme(e.target.value)}><option value="system">Tema sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select>
    </header>
    <section className={styles.summary} aria-label="Rekapitulasi pencocokan" aria-live="polite" aria-busy={phase === 'reading' || phase === 'matching'}>
      <div className={styles.summaryHeading}><h2>Rekapitulasi</h2><span>{phase === 'reading' ? 'Membaca workbook' : phase === 'matching' ? 'Sementara · pencocokan berjalan' : phase === 'config' ? 'Pilih sheet dan periksa kolom' : rows.length ? complete ? 'Pencocokan selesai' : 'Hasil sementara' : 'Belum ada dokumen'}</span></div>
      <dl className={styles.recap}>{[['Item diperiksa', recap.total], ['Cocok utama', `${recap.primary} (${number.format(recap.percent)}%)`], ['Cocok tambahan', `${recap.additional} (${number.format(recap.additionalPercent)}%)`], ['Perlu ditinjau', recap.review], ['Belum ditemukan', recap.missing], ['Belum dicocokkan', recap.pending]].map(([text, n]) => <div key={text}><dt>{text}</dt><dd>{n}</dd></div>)}</dl>
      <p>Persentase menggunakan seluruh item yang diperiksa, termasuk yang belum selesai. {recap.excluded} baris dikecualikan ({recap.excludedReview} perlu diperiksa). {recap.issues} item menunggu konfirmasi pembacaan.</p>
      {rows.length > 0 && <p>Jumlah total sumber tersedia: Rp {value(recap.amount)}. {recap.missingAmounts} item tanpa total. {limited.length > 0 && <strong>Cakupan terbatas hingga baris Excel 1–1.000 per sheet terpilih.</strong>}</p>}
    </section>
    {error && <div className={styles.problem} role="alert">{error}</div>}<p className={styles.notice} role="status">{notice}</p>
    {(phase === 'empty' || phase === 'reading') && <section className={styles.panel} aria-labelledby="upload-title"><h2 id="upload-title">Unggah workbook</h2><p>Hanya .xlsx, maksimal 10 MB. Pilih 1–3 sheet; setiap sheet dibatasi baris Excel 1–1.000, termasuk header dan baris kosong.</p><p>Isi sel dibaca di browser. File RAB tidak dikirim ke server. Unduh hasil sebelum meninggalkan halaman.</p><label>Dokumen Excel<input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={phase === 'reading'} onChange={e => { void upload(e.target.files?.[0]) }} /></label>{phase === 'reading' && <button type="button" onClick={reset}>Batalkan</button>}</section>}
    {phase === 'config' && <section className={styles.panel} aria-label="Pengaturan pembacaan"><h2>Sheet dan kolom sumber</h2><p>{filename} · Pilih maksimal 3 sheet. Periksa posisi kolom pada setiap sheet.</p>
      <fieldset className={styles.sheetChoices}><legend>Sheet yang diproses ({selected.length}/3)</legend>{sheets.map(sheet => <label key={sheet.name}><input type="checkbox" checked={selected.includes(sheet.name)} disabled={!selected.includes(sheet.name) && selected.length >= 3} onChange={e => { setSelected(current => e.target.checked ? [...current, sheet.name] : current.filter(name => name !== sheet.name)); setLimitedAccepted(false); setDuplicatesAccepted(false) }} /><span>{sheet.name}{sheet.hidden ? ' (tersembunyi)' : ''} · baris terakhir berisi: {sheet.lastRow}{sheet.lastRow > RAB_MAX_ROWS ? ' · melewati batas' : ''}</span></label>)}</fieldset>
      {chosen.map(sheet => <SheetMapping key={sheet.name} sheet={sheet} onChange={mapping => changeMapping(sheet.name, mapping)} />)}
      {limited.length > 0 && <div className={styles.problem}><strong>Bagian dokumen akan dibatasi.</strong>{limited.map(sheet => <p key={sheet.name}>{sheet.name}: isi melewati baris 1.000. Hanya baris Excel 1–1.000 diproses. Bagian setelahnya tidak masuk rekap.</p>)}<label className={styles.checkbox}><input type="checkbox" checked={limitedAccepted} onChange={e => setLimitedAccepted(e.target.checked)} />Saya memahami dan menyetujui cakupan terbatas ini.</label></div>}
      {duplicates.length > 0 && <div className={styles.problem}><strong>Periksa kemungkinan rincian dan rekap terhitung ganda.</strong>{duplicates.map(text => <p key={text}>{text}</p>)}<label className={styles.checkbox}><input type="checkbox" checked={duplicatesAccepted} onChange={e => setDuplicatesAccepted(e.target.checked)} />Saya sudah memeriksa dan tetap memakai sheet yang dipilih.</label></div>}
      <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => { void process() }}>Baca dan cocokkan</button><button type="button" onClick={reset}>Batalkan</button></div>
    </section>}
    {(phase === 'results' || phase === 'matching') && <>
      <div className={styles.actions}><strong>{filename}</strong>{phase === 'matching' ? <button type="button" onClick={stop}>Hentikan pencocokan</button> : <><button type="button" onClick={() => { void download() }} disabled={exporting || !rows.length}><DownloadSimple size={18} aria-hidden="true" />{exporting ? 'Menyiapkan Excel' : 'Unduh Excel'}</button>{recap.pending > 0 && <button type="button" onClick={() => { void process(true) }}>Lanjutkan pencocokan</button>}<button type="button" onClick={() => { if (!dirty.current || window.confirm('Ubah pemetaan akan mengosongkan hasil dan keputusan manual. Lanjutkan?')) { setRows([]); setPhase('config'); dirty.current = false } }}>Ubah pemetaan</button><button type="button" onClick={reset}>Ganti file</button></>}</div>
      {catalogAt && <p className={styles.help}>Katalog dimuat {new Date(catalogAt).toLocaleString('id-ID')}. Referensi utama diprioritaskan; rekomendasi tambahan disertakan bila belum ada uraian yang sama pada sumber utama. Unduhan mempertahankan angka sumber dan lokasi sel.</p>}
      {recap.excluded > 0 && <section className={styles.excluded}><button type="button" aria-expanded={showExcluded} onClick={() => setShowExcluded(!showExcluded)}>{showExcluded ? 'Tutup' : 'Periksa'} {recap.excluded} baris dikecualikan</button>{showExcluded && <ul>{rows.filter(row => row.excluded).map(row => <li key={row.id}><div><strong>{row.name}</strong><small>{row.sheet}!{row.source} · {row.exclusion}</small></div><button type="button" disabled={phase === 'matching'} onClick={() => openEdit(row)}>Ubah pengecualian</button></li>)}</ul>}</section>}
      <div className={styles.tabs} aria-label="Kelompok hasil"><button type="button" aria-pressed={tab === 'matched'} onClick={() => { setTab('matched'); setPage(1) }}>Cocok ({recap.primary + recap.additional})</button><button type="button" aria-pressed={tab === 'unmatched'} onClick={() => { setTab('unmatched'); setPage(1) }}>Tidak cocok ({recap.total - recap.primary - recap.additional})</button></div>
      <div aria-busy={phase === 'matching'} className={phase === 'matching' ? styles.busy : ''} inert={phase === 'matching'}>
        {!visible.length ? <p className={styles.empty}>{tab === 'matched' ? 'Belum ada pasangan yang ditetapkan cocok.' : 'Tidak ada item pada kelompok ini.'}</p> : tab === 'matched' ? <>{visible.some(r => r.candidate && rabPrimary(r.candidate)) && table(visible.filter(r => r.candidate && rabPrimary(r.candidate)), 'Regulasi utama · SE 47/2026 dan Permen 08/2023')}{visible.some(r => r.candidate && !rabPrimary(r.candidate)) && table(visible.filter(r => r.candidate && !rabPrimary(r.candidate)), 'Regulasi tambahan · terpisah dari persentase utama')}</> : table(visible, 'Perlu ditinjau dan belum ditemukan')}
      </div>
      <nav className={styles.pagination} aria-label="Halaman hasil"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button><span>Halaman {currentPage} / {pages} · {filtered.length} item</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Berikutnya</button></nav>
    </>}
    <dialog ref={editDialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="edit-title" onCancel={closeEdit}>
      <div className={styles.modalHeader}><h2 id="edit-title">Periksa pembacaan item</h2><button type="button" onClick={closeEdit}>Tutup</button></div>
      {editing && draft && <form className={styles.modalBody} onSubmit={e => { e.preventDefault(); saveEdit() }}><p>{editing.sheet}!{editing.source} · Asli: {editing.originalName}</p>{editing.issues.length > 0 && <ul className={styles.problem}>{editing.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
        <div className={styles.editFields}>{Object.entries(fields).map(([key, text]) => <label key={key}>{text}<input aria-label={text} type={['volume', 'price', 'total'].includes(key) ? 'number' : 'text'} step="any" value={draft[key as keyof typeof fields]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />{key !== 'name' && <small>Sumber {editing.refs[key] || 'tidak dipetakan'}: {editing.raw[key] || 'Kosong'}</small>}</label>)}</div>
        <p className={styles.help}>Angka koreksi memakai titik untuk desimal, tanpa pemisah ribuan. Kosong tetap kosong. Menyimpan pemeriksaan membatalkan pasangan sebelumnya agar dicocokkan ulang.</p>
        <button type="button" onClick={restoreReading}>Pulihkan isian dari sumber</button>
        <label className={styles.checkbox}><input type="checkbox" checked={draft.excluded} onChange={e => setDraft({ ...draft, excluded: e.target.checked })} />Kecualikan dari daftar pekerjaan</label>{draft.excluded && <label>Alasan pengecualian<textarea aria-label="Alasan pengecualian" value={draft.exclusion} onChange={e => setDraft({ ...draft, exclusion: e.target.value })} required /></label>}
        <label className={styles.checkbox}><input type="checkbox" checked={draft.acknowledged} onChange={e => setDraft({ ...draft, acknowledged: e.target.checked })} />Saya telah memeriksa uraian, satuan, dan hubungan angka dengan sel sumber. Nilai kosong memang belum tersedia.</label>
        {editError && <p role="alert" className={styles.problem}>{editError}</p>}<button type="submit" className={styles.primary}>Simpan pemeriksaan</button>
      </form>}
    </dialog>
    <dialog ref={searchDialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="search-title" onCancel={closeSearch}>
      <div className={styles.modalHeader}><h2 id="search-title">Cari pasangan pekerjaan</h2><button type="button" onClick={closeSearch}>Tutup</button></div>
      {searching && <div className={styles.modalBody}><p>Uraian sumber: <strong>{searching.name}</strong></p><form onSubmit={e => { e.preventDefault(); runSearch() }}><label>Metode<select aria-label="Metode" value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="like">Like-match</option><option value="phrases">Gabungan frasa</option></select></label><label>Kata kunci<textarea aria-label="Kata kunci" maxLength={1000} value={query} onChange={e => setQuery(e.target.value)} /></label><p className={styles.help}>Gabungan frasa mencari minimal dua frasa berbeda. Gunakan tanda kutip untuk menggabungkan beberapa kata menjadi satu frasa.</p><button type="submit">Cari rekomendasi</button></form>{searchError && <p role="alert" className={styles.problem}>{searchError}</p>}<p>{suggestions.length} kandidat. Sumber utama diprioritaskan; sumber tambahan ditampilkan terpisah pada rekap.</p>
        {candidateList(suggestions.slice((suggestionPage - 1) * 10, suggestionPage * 10), searching)}{!suggestions.length && <p className={styles.empty}>Belum ada kandidat. Ubah kata kunci atau metode pencarian.</p>}
        {suggestions.length > 10 && <nav className={styles.pagination} aria-label="Halaman rekomendasi"><button type="button" disabled={suggestionPage <= 1} onClick={() => setSuggestionPage(n => n - 1)}>Sebelumnya</button><span>{suggestionPage} / {Math.ceil(suggestions.length / 10)}</span><button type="button" disabled={suggestionPage * 10 >= suggestions.length} onClick={() => setSuggestionPage(n => n + 1)}>Berikutnya</button></nav>}
      </div>}
    </dialog>
    <dialog ref={confirmDialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="confirm-title" onCancel={closeConfirm}>
      <div className={styles.modalHeader}><h2 id="confirm-title">Gunakan pasangan ini?</h2><button type="button" onClick={closeConfirm}>Tutup</button></div>
      {pending && <div className={styles.modalBody}><dl className={styles.comparison}><div><dt>Pekerjaan dari Excel</dt><dd>{pending.row.name}<small>Satuan: {pending.row.unit || 'Kosong'}</small></dd></div><div><dt>Hasil rekonsiliasi</dt><dd>{pending.candidate.name}<small>{pending.candidate.code || 'Tanpa kode'} · {pending.candidate.unit} · {pending.candidate.regulation}</small></dd></div></dl>
        <p>Volume {value(pending.row.volume)}, Harga Satuan (Rupiah) {value(pending.row.price)}, dan Total (Rupiah) {value(pending.row.total)} tetap mengikuti data sumber. Uraian asli tetap disimpan.</p>
        {!rabPrimary(pending.candidate) && <p className={styles.problem}>{pending.candidate.regulation_status || 'Referensi tambahan'}. Pilihan ini masuk tabel dan persentase tambahan.</p>}
        {rabDifferences(pending.row, pending.candidate).length > 0 && <><ul className={styles.problem}>{rabDifferences(pending.row, pending.candidate).map(text => <li key={text}>{text}</li>)}</ul><label>Penyelesaian perbedaan dan alasan memilih<textarea aria-label="Penyelesaian perbedaan dan alasan memilih" value={resolution} onChange={e => setResolution(e.target.value)} required /></label><p className={styles.help}>Selesaikan perbedaan satuan/spesifikasi sebelum menetapkan cocok. Sistem tidak mengonversi volume atau harga.</p></>}
        <div className={styles.actions}><button type="button" onClick={closeConfirm}>Batalkan</button><button type="button" className={styles.primary} disabled={!pending.row.reviewed || (rabDifferences(pending.row, pending.candidate).length > 0 && !resolution.trim())} onClick={confirmCandidate}><Check size={18} aria-hidden="true" />Konfirmasi dan gunakan</button></div>
      </div>}
    </dialog>
  </div></main>
}
