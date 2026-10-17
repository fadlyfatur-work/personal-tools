'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, DownloadSimple, X } from '@phosphor-icons/react'
import { ahspPhraseSearchError } from '@/lib/ahsp'
import { RAB_FIELDS as fields, RAB_MAX_BYTES, RAB_MAX_ROWS, RAB_MAX_SHEETS, extractRabRows, matchRabRow, includeRabRows, confirmRabNoMatch, groupRabRows, updateRabGroup, rabRowKey, rabPercent, rabMoney, rabRecap, rabPrimary, rabDifferences, rabSuggestions, rabText, rabUnit, rabAmountWarning, type RabSheet, type RabMapping, type RabRow, type RabCandidate } from '@/lib/ahspRab'
import { readRabWorkbook, exportRabWorkbook } from '@/lib/ahspRabExcel'
import base from '../catalog.module.css'
import styles from './reconciliation.module.css'
import swiss from '../swiss-red.module.css'
import AppearancePicker, { useAhspAppearance } from '../appearance'
import SheetMapping from './sheet-mapping'
import ComponentUsage from './component-usage'
import type { RabUsageReport } from '@/lib/ahspRabUsage'
import ItemComponents, { useRabComponents } from './item-components'
import SavedSessions from './saved-sessions'
import type { RabSavedSession } from '@/lib/ahspRabStorage'

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 5 })
const value = (n: number | null) => n === null ? 'Kosong' : number.format(n)
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const paint = () => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
const label = (row: RabRow) => row.noMatch ? 'Tidak ada kecocokan · sudah diperiksa' : ({ pending: 'Belum dicocokkan', review: 'Perlu ditinjau', missing: 'Belum ditemukan', matched: row.manual ? 'Cocok · manual' : 'Cocok · otomatis' })[row.status]
const rowGroup = (row: RabRow) => row.excluded ? 'Dikecualikan' : row.status === 'matched' ? row.candidate && rabPrimary(row.candidate) ? 'Cocok regulasi utama' : 'Cocok regulasi tambahan' : 'Tidak cocok'
type EditDraft = { name: string; code: string; unit: string; volume: string; price: string; total: string; excluded: boolean; exclusion: string; acknowledged: boolean }

export default function RabReconciliation() {
  const appearance = useAhspAppearance()
  const [filename, setFilename] = useState('')
  const [sheets, setSheets] = useState<RabSheet[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [rows, setRows] = useState<RabRow[]>([])
  const [phase, setPhase] = useState<'empty' | 'reading' | 'config' | 'matching' | 'results'>('empty')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [toast, setToast] = useState<{ text: string } | null>(null)
  const [limitedAccepted, setLimitedAccepted] = useState(false)
  const [duplicatesAccepted, setDuplicatesAccepted] = useState(false)
  const [catalog, setCatalog] = useState<RabCandidate[]>([])
  const [catalogAt, setCatalogAt] = useState('')
  const [tab, setTab] = useState<'matched' | 'unmatched'>('unmatched')
  const [page, setPage] = useState(1)
  const [showExcluded, setShowExcluded] = useState(false)
  const [excludedSelection, setExcludedSelection] = useState<string[]>([])
  const [hideChecked, setHideChecked] = useState(false)
  const [editing, setEditing] = useState<RabRow | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [editError, setEditError] = useState('')
  const [searching, setSearching] = useState<RabRow | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'like' | 'phrases'>('phrases')
  const [suggestions, setSuggestions] = useState<RabCandidate[]>([])
  const [searchError, setSearchError] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchUnit, setSearchUnit] = useState('')
  const [suggestionPage, setSuggestionPage] = useState(1)
  const [pending, setPending] = useState<{ row: RabRow; candidate: RabCandidate } | null>(null)
  const [resolution, setResolution] = useState('')
  const [exporting, setExporting] = useState(false)
  const [showUsage, setShowUsage] = useState(false)
  const [usageReport, setUsageReport] = useState<RabUsageReport | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [occurrences, setOccurrences] = useState<RabRow | null>(null)
  const [occurrencePage, setOccurrencePage] = useState(1)
  const [applyReadingGroup, setApplyReadingGroup] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const occurrenceDialog = useRef<HTMLDialogElement>(null)
  const editDialog = useRef<HTMLDialogElement>(null)
  const searchDialog = useRef<HTMLDialogElement>(null)
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const searchGeneration = useRef(0)
  const dirty = useRef(false)
  const usageLoaded = useCallback((report: RabUsageReport | null) => { setUsageReport(report); if (report) dirty.current = true }, [])
  const chosen = sheets.filter(sheet => selected.includes(sheet.name))
  const previewRows = useMemo(() => sheets.filter(sheet => selected.includes(sheet.name)).flatMap(sheet => extractRabRows(sheet, sheet.mapping)), [sheets, selected])
  const recap = rabRecap(phase === 'config' ? previewRows : rows)
  const limited = chosen.filter(sheet => sheet.lastRow > RAB_MAX_ROWS)
  const complete = phase === 'results' && recap.pending === 0 && recap.issues === 0 && recap.excludedReview === 0
  const groups = useMemo(() => groupRabRows(rows), [rows])
  const groupMap = new Map(groups.map(group => [group.key, group]))
  const members = (row: RabRow) => groupMap.get(rabRowKey(row))?.members ?? [row]
  const groupReviewed = (row: RabRow) => members(row).every(item => item.reviewed)
  const openOccurrences = (row: RabRow) => { setOccurrencePage(1); setOccurrences(row) }
  const closeOccurrences = () => { occurrenceDialog.current?.close(); setOccurrences(null) }
  const filtered = groups.filter(group => tab === 'matched' ? group.matched : !group.matched && (!hideChecked || !group.members.every(row => row.noMatch))).map(group => group.row).sort((a, b) => Number(!!a.noMatch) - Number(!!b.noMatch))
  const pages = Math.max(1, Math.ceil(filtered.length / 25))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25)
  const excludedRows = rows.filter(row => row.excluded)
  const selectedExcluded = excludedRows.filter(row => excludedSelection.includes(row.id))
  const inspectedItem = editing?.candidate ?? editing?.candidates[0]
  const componentIds = phase === 'results' && !showUsage ? visible.flatMap(row => row.candidate ? [row.candidate.id] : row.noMatch ? [] : row.candidates.slice(0, 2).map(item => item.id)) : []
  const componentInfo = useRabComponents([...componentIds, ...(inspectedItem ? [inspectedItem.id] : []), ...(pending ? [pending.candidate.id] : [])])
  const itemComponents = (item: RabCandidate, compact = false) => <ItemComponents item={item} data={componentInfo.data[item.id]} loading={componentInfo.loading} error={componentInfo.error} reload={componentInfo.reload} compact={compact} />
  const suggestionUnits = useMemo(() => [...new Set(catalog.map(item => rabUnit(item.unit)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })), [catalog])
  const filteredSuggestions = suggestions.filter(item => !searchUnit || rabUnit(item.unit) === searchUnit)
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
  useEffect(() => { if (occurrences && !occurrenceDialog.current?.open) occurrenceDialog.current?.showModal() }, [occurrences])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => () => { searchGeneration.current++ }, [])

  const closeEdit = () => { editDialog.current?.close(); setEditing(null); setDraft(null) }
  const closeSearch = () => { searchGeneration.current++; searchDialog.current?.close(); setSearching(null); setSearchLoading(false) }
  const closeConfirm = () => { confirmDialog.current?.close(); setPending(null); setResolution('') }
  const replaceRow = (row: RabRow) => {
    const previous = rows.find(item => item.id === row.id)
    setRows(current => current.map(item => item.id === row.id ? row : item)); dirty.current = true
    setUsageReport(null)
    if (previous && rowGroup(previous) !== rowGroup(row)) setToast({ text: `${row.name} dipindahkan ke ${rowGroup(row)}.` })
  }
  const replaceGroup = (row: RabRow, change: (item: RabRow) => RabRow, message: string) => {
    const count = members(row).length
    setRows(current => updateRabGroup(current, row, change)); dirty.current = true; setUsageReport(null)
    setToast({ text: `${message} Diterapkan ke ${count} kemunculan ${row.name}.` })
  }
  const restoreSession = (session: RabSavedSession) => {
    if (dirty.current && !window.confirm('Ada perubahan yang belum disimpan. Buka simpanan dan ganti hasil saat ini?')) return
    generation.current++; searchGeneration.current++; request.current?.abort()
    setSessionId(session.id); setFilename(session.filename); setSheets(session.sheets); setSelected(session.selected); setRows(session.rows); setCatalogAt(session.catalogAt); setUsageReport(session.usageReport); setShowUsage(false)
    setLimitedAccepted(session.limitedAccepted); setDuplicatesAccepted(session.duplicatesAccepted); setPhase('results'); setError(''); setNotice(`Perhitungan “${session.name}” dibuka dari simpanan ${new Date(session.savedAt).toLocaleString('id-ID')}.`); setPage(1); setTab('unmatched'); setHideChecked(false); setExcludedSelection([]); dirty.current = false
    const id = generation.current
    setRestoring(true)
    const controller = new AbortController()
    request.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    void fetch('/api/ahsp/rab', { signal: controller.signal }).then(async response => { const body = await response.json(); if (!response.ok || !Array.isArray(body.items)) throw new Error(); if (id !== generation.current) return
      const reference: RabCandidate[] = body.items; setCatalog(reference); setCatalogAt(body.loadedAt)
      const lookup = new Map(reference.map(item => [item.id, item])); let changed = false
      const restored = session.rows.map(row => {
        const candidates = row.candidates.flatMap(candidate => {
          const fresh = lookup.get(candidate.id)
          return fresh && ['code', 'name', 'unit', 'regulation'].every(key => fresh[key as keyof RabCandidate] === candidate[key as keyof RabCandidate]) ? [fresh] : []
        })
        if (!row.candidate) return { ...row, candidates }
        const fresh = lookup.get(row.candidate.id)
        if (fresh && ['code', 'name', 'unit', 'regulation'].every(key => fresh[key as keyof RabCandidate] === row.candidate![key as keyof RabCandidate])) return { ...row, candidate: fresh, candidates }
        changed = true
        return { ...row, candidate: null, candidates: [], status: 'review' as const, manual: true, noMatch: false, history: [...row.history, `${new Date().toISOString()}: identitas pasangan katalog berubah; perlu ditinjau kembali.`] }
      })
      setRows(restored)
      if (changed) { setUsageReport(null); dirty.current = true; setNotice('Simpanan dibuka. Beberapa identitas katalog berubah dan perlu dipasangkan ulang.'); }
    }).catch(() => { if (id === generation.current) { setCatalog([]); setNotice('Simpanan dibuka. Katalog belum dapat dimuat; hasil tetap bisa dilihat dan diunduh.'); } }).finally(() => { clearTimeout(timeout); if (id === generation.current) setRestoring(false) })
  }
  const reset = () => {
    if (dirty.current && !window.confirm('Hasil dan keputusan manual akan dikosongkan. Lanjutkan? Simpan atau unduh hasil terlebih dahulu jika masih diperlukan.')) return
    generation.current++; searchGeneration.current++; request.current?.abort(); setRows([]); setSheets([]); setSelected([]); setFilename(''); setPhase('empty'); setError(''); setNotice(''); setToast(null); setShowUsage(false); setUsageReport(null); setSessionId(null); dirty.current = false
    setExcludedSelection([]); setHideChecked(false)
    setRestoring(false)
    if (input.current) input.current.value = ''
  }
  async function upload(file?: File) {
    if (!file) return
    const id = ++generation.current
    setSessionId(null)
    setRestoring(false)
    setShowUsage(false); setUsageReport(null)
    setExcludedSelection([]); setHideChecked(false)
    request.current?.abort(); setRows([]); setSheets([]); setSelected([]); setError(''); setNotice(''); setFilename(file.name); setPhase('reading'); setLimitedAccepted(false); setDuplicatesAccepted(false); dirty.current = false
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Pilih file Excel Workbook (.xlsx).')
      if (file.size > RAB_MAX_BYTES) throw new Error('Ukuran file maksimal 10 MB.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      await paint()
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
    setRows(initial); setPhase('matching'); setUsageReport(null); dirty.current = true
    const id = ++generation.current, controller = new AbortController()
    request.current?.abort(); request.current = controller
    try {
      await paint()
      if (id !== generation.current || controller.signal.aborted) return
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
  const openEdit = (row: RabRow, include = false) => {
    setApplyReadingGroup(false)
    setEditing(row); setEditError(''); setDraft({ name: row.name, code: row.code, unit: row.unit, volume: row.volume === null ? '' : String(row.volume), price: row.price === null ? '' : String(row.price), total: row.total === null ? '' : String(row.total), excluded: include ? false : row.excluded, exclusion: row.exclusion, acknowledged: row.reviewed })
  }
  const includeSelected = () => {
    const ids = selectedExcluded.map(row => row.id)
    setRows(current => includeRabRows(current, ids, catalog)); setExcludedSelection([]); setUsageReport(null); dirty.current = true
    setToast({ text: `${ids.length} baris dimasukkan ke daftar pekerjaan. Pembacaan yang belum jelas tetap perlu diperiksa.` })
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
    let next: RabRow = { ...editing, name: draft.name.trim(), code: draft.code.trim(), unit: draft.unit.trim(), volume: numeric[0], price: numeric[1], total: numeric[2], excluded: draft.excluded, exclusion: draft.excluded ? draft.exclusion.trim() : '', reviewed: draft.excluded || draft.acknowledged, noMatch: false, candidate: null, candidates: [], manual: false, status: 'pending', resolution: '', history: [...editing.history, `${new Date().toISOString()}: pembacaan diperiksa/dikoreksi; ${draft.excluded ? `dikecualikan: ${draft.exclusion}` : 'item diikutkan'}.`] }
    if (catalog.length) next = matchRabRow(next, catalog)
    if (applyReadingGroup && !draft.excluded && members(editing).length > 1) {
      replaceGroup(editing, item => {
        if (item.id === editing.id) return next
        const updated: RabRow = { ...item, name: next.name, code: next.code, reviewed: true, noMatch: false, candidate: null, candidates: [], manual: false, status: 'pending', resolution: '', history: [...item.history, `${new Date().toISOString()}: uraian/kode dan konfirmasi pembacaan diterapkan ke grup; satuan dan angka dipertahankan.`] }
        return catalog.length ? matchRabRow(updated, catalog) : updated
      }, 'Pemeriksaan grup disimpan.')
    } else replaceRow(next)
    closeEdit()
  }
  const openSearch = (row: RabRow) => {
    setSearching(row); setQuery(row.name); setMode('phrases'); setSearchUnit(''); void loadSuggestions(row, '', 'phrases')
  }
  const loadSuggestions = async (row: RabRow, text: string, method: 'like' | 'phrases') => {
    const id = ++searchGeneration.current
    setSearchLoading(true); setSearchError(''); setSuggestions([]); setSuggestionPage(1)
    try {
      await paint()
      if (id !== searchGeneration.current) return
      setSuggestions(rabSuggestions(row.name, catalog, method, text, row.unit))
    } catch { if (id === searchGeneration.current) setSearchError('Rekomendasi gagal disiapkan. Coba cari kembali.') }
    finally { if (id === searchGeneration.current) setSearchLoading(false) }
  }
  const runSearch = async () => {
    if (!searching || searchLoading) return
    const validation = mode === 'phrases' ? ahspPhraseSearchError(query) : !query.trim() ? 'Isi kata atau frasa pencarian.' : ''
    if (validation) { setSearchError(validation); return }
    await loadSuggestions(searching, query, mode)
  }
  const selectCandidate = (row: RabRow, candidate: RabCandidate) => { setPending({ row, candidate }); setResolution('') }
  const confirmCandidate = () => {
    if (!pending || !groupReviewed(pending.row)) return
    replaceGroup(pending.row, row => ({ ...row, candidate: pending.candidate, status: 'matched', noMatch: false, manual: true, resolution: resolution.trim(), history: [...row.history, `${new Date().toISOString()}: pasangan manual ${pending.candidate.code} / ${pending.candidate.name} / ${pending.candidate.regulation}. ${resolution.trim()}`] }), `Pasangan digunakan; dipindahkan ke ${rabPrimary(pending.candidate) ? 'Cocok regulasi utama' : 'Cocok regulasi tambahan'}.`)
    setNotice('Pasangan digunakan. Rekap diperbarui; angka sumber tetap dipertahankan.'); closeConfirm(); closeSearch()
  }
  const undo = (row: RabRow) => {
    replaceGroup(row, item => ({ ...item, candidate: null, status: 'review', noMatch: false, manual: true, resolution: '', history: [...item.history, `${new Date().toISOString()}: pasangan dibatalkan.`] }), 'Pasangan dibatalkan; dipindahkan ke Tidak cocok.'); setNotice('Pasangan dibatalkan. Item kembali ke tab Tidak cocok.')
  }
  const download = async () => {
    setExporting(true); setError('')
    try {
      await paint()
      const bytes = exportRabWorkbook(rows, { filename, sheets: chosen.map(sheet => ({ name: sheet.name, lastRow: sheet.lastRow, start: sheet.mapping.start })), catalogAt, completed: complete, usage: usageReport ?? undefined })
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = `Rekap Pencocokan - ${filename}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000)
      setNotice('File hasil disiapkan untuk diunduh. Rekap mencakup seluruh halaman tabel.'); dirty.current = false
    } catch { setError('File hasil gagal dibuat. Data tetap tersedia; coba unduh lagi.') }
    finally { setExporting(false) }
  }
  const candidateList = (list: RabCandidate[], row: RabRow) => list.map(candidate => <div className={styles.recommendation} key={candidate.id}>
    <strong>{candidate.name}</strong><small>{candidate.code || 'Tanpa kode'} · {candidate.unit || 'Satuan kosong'} · {candidate.regulation}{!rabPrimary(candidate) && ` · ${candidate.regulation_status || 'Referensi tambahan'}`}</small>
    {itemComponents(candidate, true)}
    {rabDifferences(row, candidate).length > 0 && <small>{rabDifferences(row, candidate).join(' ')}</small>}
    <button type="button" onClick={() => selectCandidate(row, candidate)} disabled={!groupReviewed(row)}><Check size={17} aria-hidden="true" /> Gunakan</button>
  </div>)
  const table = (list: RabRow[], title: string) => <section className={styles.resultGroup} key={title} aria-label={title} data-rab-tablegroup>
    <h3>{title}</h3><div className={styles.tableScroll} tabIndex={0} role="region" aria-label={`Tabel ${title}`}><table>
      <thead><tr><th scope="col">Pekerjaan dari Excel</th><th scope="col">Volume dan harga sumber</th><th scope="col">Pasangan / rekomendasi AHSP</th><th scope="col">Tindakan</th></tr></thead>
      <tbody>{list.map(row => <tr key={row.id} className={row.noMatch ? styles.checkedRow : undefined}>
        <td data-label="Pekerjaan dari Excel"><strong>{row.name}</strong>{row.name !== row.originalName && <small>Asli: {row.originalName}</small>}<small>{row.code || 'Tanpa kode'}</small><button type="button" className={styles.occurrenceButton} onClick={() => openOccurrences(row)}>{members(row).length} kemunculan</button><span className={styles.state}>{groupMap.get(rabRowKey(row))?.mixed ? 'Keputusan berbeda · periksa grup' : label(row)}</span>{!groupReviewed(row) && <p className={styles.problem}>Pembacaan perlu dikonfirmasi.</p>}</td>
        <td data-label="Volume dan harga sumber">{members(row).length > 1 ? <><p>Angka dipertahankan per kemunculan.</p><button type="button" onClick={() => openOccurrences(row)}>Lihat volume dan harga</button><small>{[...new Set(members(row).map(item => item.unit || 'Satuan kosong'))].join(' · ')}</small></> : <><dl className={styles.numbers}><div><dt>Volume</dt><dd>{value(row.volume)} {row.unit}</dd></div><div><dt>Harga Satuan (Rupiah)</dt><dd>{row.price === null ? 'Kosong' : rabMoney(row.price)}</dd></div><div><dt>Total (Rupiah)</dt><dd>{row.total === null ? 'Kosong' : rabMoney(row.total)}</dd></div></dl>{rabAmountWarning(row) && <small>{rabAmountWarning(row)}</small>}</>}</td>
        <td data-label="Pasangan / rekomendasi AHSP">{row.noMatch ? <p>Sudah diperiksa tanpa pasangan. Item tetap masuk Final RAB dengan data sumber.</p> : row.candidate ? <><strong>{row.candidate.name}</strong><small>{row.candidate.code || 'Tanpa kode'} · {row.candidate.unit} · {row.candidate.regulation}</small>{itemComponents(row.candidate, true)}{!rabPrimary(row.candidate) && <p className={styles.problem}>{row.candidate.regulation_status || 'Referensi tambahan'}</p>}{rabDifferences(row, row.candidate).map(text => <small key={text}>{text}</small>)}{row.resolution && <small>Catatan manual: {row.resolution}</small>}</> : row.candidates.length ? candidateList(row.candidates.slice(0, 2), row) : <p>{row.status === 'pending' ? 'Menunggu pencocokan.' : 'Belum ada rekomendasi. Coba kata kunci atau gabungan frasa lain.'}</p>}</td>
        <td data-label="Tindakan"><div className={styles.rowActions}><button type="button" onClick={() => openEdit(row)}>Periksa data</button><button type="button" onClick={() => openSearch(row)} disabled={!catalog.length || !groupReviewed(row)}>Cari pasangan</button>{row.candidate ? <button type="button" onClick={() => undo(row)}>Batalkan pasangan</button> : row.noMatch ? <button type="button" onClick={() => replaceGroup(row, item => ({ ...item, noMatch: false, manual: true, status: 'review', history: [...item.history, `${new Date().toISOString()}: pemeriksaan kecocokan dibuka kembali.`] }), 'Pemeriksaan dibuka kembali.')}>Periksa kembali</button> : <button type="button" onClick={() => replaceGroup(row, confirmRabNoMatch, 'Ditandai tidak ada kecocokan dan dapat dilewati.')}>Tidak ada kecocokan</button>}</div></td>
      </tr>)}</tbody>
    </table></div></section>

  return <main className={`${base.page} ${styles.app} ${swiss.page}`} data-theme={appearance.mode} data-palette={appearance.palette}><div className={base.container}>
    <header className={base.header} data-ahsp-header><Link href="/ahsp" onClick={e => { if (dirty.current && !window.confirm('Perubahan terakhir belum disimpan atau diunduh. Tinggalkan halaman?')) e.preventDefault() }}>Kembali ke katalog AHSP</Link>
      <AppearancePicker appearance={appearance} />
      <div data-ahsp-heading><h1>Pencocokan RAB</h1><p>Cocokkan pekerjaan Excel dengan SE 47/2026 dan Permen 08/2023. Referensi tambahan ditampilkan terpisah.</p></div>
    </header>
    <section className={styles.summary} aria-label="Rekapitulasi pencocokan" data-rab-summary aria-live="polite" aria-busy={phase === 'reading' || phase === 'matching'}>
      <div className={styles.summaryHeading}><div className={styles.headingHelp}><h2>Rekapitulasi</h2><button type="button" className={`${base.helpButton} ${styles.recapHelpButton}`} popoverTarget="rab-recap-help" aria-label="Tentang rekapitulasi"><span aria-hidden="true">?</span></button></div><span className={base.loadingIndicator}>{(phase === 'reading' || phase === 'matching') && <span className={base.spinner} aria-hidden="true" />}{phase === 'reading' ? 'Membaca workbook…' : phase === 'matching' ? 'Sementara · pencocokan berjalan…' : phase === 'config' ? 'Pilih sheet dan periksa kolom' : rows.length ? complete ? 'Pencocokan selesai' : 'Hasil sementara' : 'Belum ada dokumen'}</span></div>
      <div id="rab-recap-help" popover="auto" className={`${base.helpPopover} ${styles.recapHelp}`} role="note" aria-labelledby="rab-recap-help-title"><h3 id="rab-recap-help-title">Arti angka rekapitulasi</h3><dl>
        <div><dt>Item diperiksa</dt><dd>Seluruh pekerjaan yang diikutkan dari sheet terpilih. Baris yang dikecualikan tidak dihitung.</dd></div>
        <div><dt>Cocok utama</dt><dd>Item dengan pasangan pada SE 47/2026 atau Permen 08/2023, termasuk keputusan manual.</dd></div>
        <div><dt>Cocok tambahan</dt><dd>Item dengan pasangan pada regulasi lain. Jumlah dan persentasenya terpisah dari sumber utama.</dd></div>
        <div><dt>Perlu ditinjau</dt><dd>Ada rekomendasi yang perlu dipilih atau pembacaan sumber yang belum dikonfirmasi.</dd></div>
        <div><dt>Belum ditemukan</dt><dd>Pencocokan telah dijalankan tetapi belum menghasilkan kandidat. Termasuk item yang sudah ditandai tidak ada kecocokan; item tersebut tetap masuk penyebut persentase dan Final RAB.</dd></div>
        <div><dt>Belum dicocokkan</dt><dd>Item yang masih menunggu proses, misalnya ketika pencocokan dihentikan.</dd></div>
        <div><dt>Persentase kecocokan</dt><dd>Jumlah item cocok pada setiap kelompok dibagi seluruh item diperiksa, dikali 100%. Item belum selesai tetap masuk penyebut.</dd></div>
        <div><dt>Baris dikecualikan dan konfirmasi pembacaan</dt><dd>Baris di luar daftar pekerjaan dihitung terpisah. Pembacaan ambigu tetap memerlukan pemeriksaan sebelum memilih pasangan.</dd></div>
        <div><dt>Total item cocok</dt><dd>Jumlah seluruh kemunculan yang cocok pada regulasi utama dan tambahan. Pengelompokan tabel tidak mengurangi jumlah item atau hitungan penggunaan komponen.</dd></div>
        <div><dt>Total harga (Rp)</dt><dd>Penjumlahan total yang tersedia dari Excel, ditampilkan dengan dua angka desimal. Nilai kosong tetap kosong pada rincian dan ekspor.</dd></div>
      </dl><button type="button" popoverTarget="rab-recap-help" popoverTargetAction="hide">Tutup penjelasan</button></div>
      <div className={styles.summaryMain}><dl className={styles.recapLead}><dt>Total item cocok</dt><dd>{number.format(recap.primary + recap.additional)}<span>{rabPercent(recap.percent + recap.additionalPercent)}%</span></dd><dd className={styles.recapContext}>dari {number.format(recap.total)} item diperiksa</dd></dl><dl className={styles.recap}>{[['Item diperiksa', number.format(recap.total)], ['Cocok utama', `${number.format(recap.primary)} (${rabPercent(recap.percent)}%)`], ['Cocok tambahan', `${number.format(recap.additional)} (${rabPercent(recap.additionalPercent)}%)`], ['Perlu ditinjau', number.format(recap.review)], ['Belum ditemukan', number.format(recap.missing)], ['Belum dicocokkan', number.format(recap.pending)]].map(([text, n]) => <div key={text}><dt>{text}</dt><dd>{n}</dd></div>)}</dl></div>
      {(rows.length > 0 || phase === 'config') && <dl className={styles.summaryPrice}><dt>Total harga (Rp)</dt><dd>{rabMoney(recap.amount)}</dd></dl>}{limited.length > 0 && <p className={styles.help}>Cakupan terbatas hingga baris Excel 1–1.000 per sheet terpilih.</p>}
    </section>
    {error && <div className={styles.problem} role="alert">{error}</div>}<p className={styles.notice} role="status">{notice}</p>
    <div className={swiss.workspace} data-stage={phase}>
    {(phase === 'empty' || phase === 'reading') && <section className={styles.panel} data-rab-panel aria-labelledby="upload-title"><h2 id="upload-title">Unggah workbook</h2><p>Hanya .xlsx, maksimal 10 MB. Pilih 1–3 sheet; setiap sheet dibatasi baris Excel 1–1.000, termasuk header dan baris kosong.</p><p>Isi sel dibaca di browser. File RAB tidak dikirim ke server. Simpan perhitungan atau unduh hasil sebelum meninggalkan halaman.</p><label>Dokumen Excel<input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={phase === 'reading'} onChange={e => { void upload(e.target.files?.[0]) }} /></label>{phase === 'reading' && <button type="button" onClick={reset}>Batalkan</button>}</section>}
    <SavedSessions activeId={sessionId} disabled={phase === 'reading' || phase === 'matching' || restoring} current={phase === 'results' ? { filename, sheets: chosen, selected, rows, catalogAt, limitedAccepted, duplicatesAccepted, usageReport } : null} onRestore={restoreSession} onSaved={session => { setSessionId(session.id); dirty.current = false }} />
    </div>
    {restoring && <p className={base.loadingIndicator} role="status"><span className={base.spinner} aria-hidden="true" />Memeriksa katalog untuk simpanan ini…</p>}
    {phase === 'config' && <section className={styles.panel} data-rab-panel aria-label="Pengaturan pembacaan"><h2>Sheet dan kolom sumber</h2><p>{filename} · Pilih maksimal 3 sheet. Periksa posisi kolom pada setiap sheet.</p>
      <fieldset className={styles.sheetChoices}><legend>Sheet yang diproses ({selected.length}/3)</legend>{sheets.map(sheet => <label key={sheet.name}><input type="checkbox" checked={selected.includes(sheet.name)} disabled={!selected.includes(sheet.name) && selected.length >= 3} onChange={e => { setSelected(current => e.target.checked ? [...current, sheet.name] : current.filter(name => name !== sheet.name)); setLimitedAccepted(false); setDuplicatesAccepted(false) }} /><span>{sheet.name}{sheet.hidden ? ' (tersembunyi)' : ''} · baris terakhir berisi: {sheet.lastRow}{sheet.lastRow > RAB_MAX_ROWS ? ' · melewati batas' : ''}</span></label>)}</fieldset>
      {chosen.map(sheet => <SheetMapping key={sheet.name} sheet={sheet} onChange={mapping => changeMapping(sheet.name, mapping)} />)}
      {limited.length > 0 && <div className={styles.problem}><strong>Bagian dokumen akan dibatasi.</strong>{limited.map(sheet => <p key={sheet.name}>{sheet.name}: isi melewati baris 1.000. Hanya baris Excel 1–1.000 diproses. Bagian setelahnya tidak masuk rekap.</p>)}<label className={styles.checkbox}><input type="checkbox" checked={limitedAccepted} onChange={e => setLimitedAccepted(e.target.checked)} />Saya memahami dan menyetujui cakupan terbatas ini.</label></div>}
      {duplicates.length > 0 && <div className={styles.problem}><strong>Periksa kemungkinan rincian dan rekap terhitung ganda.</strong>{duplicates.map(text => <p key={text}>{text}</p>)}<label className={styles.checkbox}><input type="checkbox" checked={duplicatesAccepted} onChange={e => setDuplicatesAccepted(e.target.checked)} />Saya sudah memeriksa dan tetap memakai sheet yang dipilih.</label></div>}
      <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => { void process() }}>Baca dan cocokkan</button><button type="button" onClick={reset}>Batalkan</button></div>
    </section>}
    {phase === 'results' && showUsage && <ComponentUsage rows={rows} onLoaded={usageLoaded} onBack={() => setShowUsage(false)} onDownload={() => { void download() }} exporting={exporting} />}
    {(phase === 'results' || phase === 'matching') && !showUsage && <div inert={restoring} aria-busy={restoring}>
      <div className={styles.actions}><strong>{filename}</strong>{phase === 'matching' ? <button type="button" onClick={stop}><span className={base.spinner} aria-hidden="true" />Hentikan pencocokan</button> : <><button type="button" onClick={() => { void download() }} disabled={exporting || !rows.length}>{exporting ? <span className={base.spinner} aria-hidden="true" /> : <DownloadSimple size={18} aria-hidden="true" />}{exporting ? 'Menyiapkan Excel…' : 'Unduh Excel'}</button>{recap.pending > 0 && <button type="button" onClick={() => { void process(true) }}>Lanjutkan pencocokan</button>}<button type="button" onClick={() => { if (!dirty.current || window.confirm('Ubah pemetaan akan mengosongkan hasil dan keputusan manual. Lanjutkan?')) { setRows([]); setPhase('config'); dirty.current = false } }}>Ubah pemetaan</button><button type="button" onClick={reset}>Ganti file</button></>}</div>
      {phase === 'results' && <section className={styles.panel} data-rab-panel aria-label="Langkah setelah rekonsiliasi"><h2>Lanjutkan hasil rekonsiliasi</h2><p>Unduh hasil saat ini atau lihat penggunaan komponen dari pekerjaan yang cocok.</p><div className={styles.actions}><button type="button" onClick={() => { void download() }} disabled={exporting || !rows.length}>Selesai dan unduh Excel</button><button type="button" className={styles.primary} disabled={recap.primary + recap.additional === 0} onClick={() => setShowUsage(true)}>Lanjut ke rekap penggunaan komponen</button></div>{recap.primary + recap.additional === 0 && <p className={styles.help}>Tetapkan minimal satu pekerjaan cocok untuk membuka rekap penggunaan komponen.</p>}{usageReport && <p className={styles.help}>Rekap penggunaan komponen sudah disertakan pada unduhan. Perubahan rekonsiliasi memerlukan rekap penggunaan ulang.</p>}</section>}
      {recap.excluded > 0 && <section className={styles.excluded} aria-label="Baris dikecualikan"><button type="button" aria-expanded={showExcluded} onClick={() => setShowExcluded(!showExcluded)}>{showExcluded ? 'Tutup' : 'Periksa'} {recap.excluded} baris dikecualikan ({recap.excludedReview} perlu diperiksa)</button>{showExcluded && <><div className={styles.actions}><label className={styles.checkbox}><input type="checkbox" aria-label="Pilih semua baris dikecualikan" checked={selectedExcluded.length === excludedRows.length} disabled={phase === 'matching'} ref={el => { if (el) el.indeterminate = selectedExcluded.length > 0 && selectedExcluded.length < excludedRows.length }} onChange={e => setExcludedSelection(e.target.checked ? excludedRows.map(row => row.id) : [])} />Pilih semua</label><button type="button" disabled={!selectedExcluded.length || phase === 'matching'} onClick={includeSelected}>Masukkan {selectedExcluded.length} baris ke daftar pekerjaan</button></div><ul>{excludedRows.map(row => <li key={row.id}><label className={styles.excludeCheck}><input type="checkbox" aria-label={`Pilih ${row.name}, baris ${row.row}`} checked={excludedSelection.includes(row.id)} disabled={phase === 'matching'} onChange={e => setExcludedSelection(current => e.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} /></label><div><strong>{row.name}</strong><small>{row.sheet}!{row.source} · {row.exclusion}</small></div><button type="button" disabled={phase === 'matching'} onClick={() => openEdit(row, true)}>Ubah pengecualian</button></li>)}</ul></>}</section>}
      <div className={styles.tabs} aria-label="Kelompok hasil"><button type="button" aria-pressed={tab === 'matched'} onClick={() => { setTab('matched'); setPage(1) }}>Cocok ({recap.primary + recap.additional})</button><button type="button" aria-pressed={tab === 'unmatched'} onClick={() => { setTab('unmatched'); setPage(1) }}>Tidak cocok ({recap.total - recap.primary - recap.additional})</button></div>
      {tab === 'unmatched' && recap.checkedMissing > 0 && <label className={styles.checkbox}><input type="checkbox" checked={hideChecked} onChange={e => { setHideChecked(e.target.checked); setPage(1) }} />Sembunyikan yang sudah diperiksa tanpa kecocokan ({recap.checkedMissing})</label>}
      <p className={styles.help}>Nama dan kode yang sama persis ditampilkan sebagai satu grup. Keputusan pasangan berlaku untuk semua kemunculan; rekap dan ekspor tetap menghitung setiap baris sumber.</p>
      <div aria-busy={phase === 'matching' || restoring} className={phase === 'matching' || restoring ? styles.busy : ''} inert={phase === 'matching' || restoring}>
        {!visible.length ? <p className={styles.empty}>{tab === 'matched' ? 'Belum ada pasangan yang ditetapkan cocok.' : 'Tidak ada item pada kelompok ini.'}</p> : tab === 'matched' ? <>{visible.some(r => r.candidate && rabPrimary(r.candidate)) && table(visible.filter(r => r.candidate && rabPrimary(r.candidate)), 'Regulasi utama · SE 47/2026 dan Permen 08/2023')}{visible.some(r => r.candidate && !rabPrimary(r.candidate)) && table(visible.filter(r => r.candidate && !rabPrimary(r.candidate)), 'Regulasi tambahan · terpisah dari persentase utama')}</> : table(visible, 'Perlu ditinjau dan belum ditemukan')}
      </div>
      <nav className={styles.pagination} aria-label="Halaman hasil"><button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button><span>Halaman {currentPage} / {pages} · {filtered.length} grup · {filtered.reduce((sum, row) => sum + members(row).length, 0)} kemunculan</span><button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Berikutnya</button></nav>
    </div>}
    <dialog ref={editDialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="edit-title" onCancel={closeEdit}>
      <div className={styles.modalHeader}><h2 id="edit-title">Periksa pembacaan item</h2><button type="button" onClick={closeEdit}>Tutup</button></div>
      {editing && draft && <form className={styles.modalBody} onSubmit={e => { e.preventDefault(); saveEdit() }}><p>{editing.sheet}!{editing.source} · Asli: {editing.originalName}</p>{editing.issues.length > 0 && <ul className={styles.problem}>{editing.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
        {inspectedItem ? <>{!editing.candidate && <p className={styles.help}>Komponen berikut milik kandidat terdekat; belum ditetapkan sebagai pasangan pekerjaan.</p>}{itemComponents(inspectedItem)}</> : <p className={styles.help}>Belum ada pasangan atau kandidat AHSP untuk menampilkan rincian MPTK.</p>}
        <div className={styles.editFields}>{Object.entries(fields).map(([key, text]) => <label key={key}>{text}<input aria-label={text} type={['volume', 'price', 'total'].includes(key) ? 'number' : 'text'} step="any" value={draft[key as keyof typeof fields]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} />{key !== 'name' && <small>Sumber {editing.refs[key] || 'tidak dipetakan'}: {editing.raw[key] || 'Kosong'}</small>}</label>)}</div>
        <p className={styles.help}>Angka koreksi memakai titik untuk desimal, tanpa pemisah ribuan. Kosong tetap kosong. Menyimpan pemeriksaan membatalkan pasangan sebelumnya agar dicocokkan ulang.</p>
        <button type="button" onClick={restoreReading}>Pulihkan isian dari sumber</button>
        {!draft.excluded && members(editing).length > 1 && <><button type="button" onClick={() => openOccurrences(editing)}>Lihat {members(editing).length} kemunculan sebelum konfirmasi grup</button><label className={styles.checkbox}><input type="checkbox" checked={applyReadingGroup} onChange={e => setApplyReadingGroup(e.target.checked)} />Terapkan uraian, kode, dan konfirmasi pembacaan ke semua {members(editing).length} kemunculan. Satuan dan angka kemunculan lain tetap.</label></>}
        <label className={styles.checkbox}><input type="checkbox" checked={draft.excluded} onChange={e => setDraft({ ...draft, excluded: e.target.checked })} />Kecualikan dari daftar pekerjaan</label>{draft.excluded && <label>Alasan pengecualian<textarea aria-label="Alasan pengecualian" value={draft.exclusion} onChange={e => setDraft({ ...draft, exclusion: e.target.value })} required /></label>}
        <label className={styles.checkbox}><input type="checkbox" checked={draft.acknowledged} onChange={e => setDraft({ ...draft, acknowledged: e.target.checked })} />Saya telah memeriksa uraian, satuan, dan hubungan angka dengan sel sumber. Nilai kosong memang belum tersedia.</label>
        {editError && <p role="alert" className={styles.problem}>{editError}</p>}<button type="submit" className={styles.primary}>Simpan pemeriksaan</button>
      </form>}
    </dialog>
    <dialog ref={searchDialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="search-title" onCancel={closeSearch}>
      <div className={styles.modalHeader}><h2 id="search-title">Cari pasangan pekerjaan</h2><button type="button" onClick={closeSearch}>Tutup</button></div>
      {searching && <div className={styles.modalBody}><p>Uraian sumber: <strong>{searching.name}</strong></p><form onSubmit={e => { e.preventDefault(); void runSearch() }}><div className={styles.searchOptions}><label>Metode<select aria-label="Metode" value={mode} disabled={searchLoading} onChange={e => setMode(e.target.value as typeof mode)}><option value="like">Like-match</option><option value="phrases">Gabungan frasa</option></select></label><label>Filter satuan<select aria-label="Filter satuan" value={searchUnit} disabled={searchLoading} onChange={e => { setSearchUnit(e.target.value); setSuggestionPage(1) }}><option value="">Semua satuan</option>{suggestionUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}</select></label></div><label>Kata kunci<textarea aria-label="Kata kunci" maxLength={1000} value={query} disabled={searchLoading} onChange={e => setQuery(e.target.value)} /></label><p className={styles.help}>Gabungan frasa mencari minimal dua frasa berbeda. Gunakan tanda kutip untuk menggabungkan beberapa kata menjadi satu frasa. Filter satuan langsung menyaring hasil pencarian; satuan sumber: {searching.unit || 'kosong'}.</p><button type="submit" disabled={searchLoading}>{searchLoading && <span className={base.spinner} aria-hidden="true" />}Cari rekomendasi</button></form>{searchError && <p role="alert" className={styles.problem}>{searchError}</p>}
        <p className={base.loadingIndicator} role="status" aria-atomic="true">{searchLoading ? <><span className={base.spinner} aria-hidden="true" />Menyiapkan rekomendasi pekerjaan…</> : `${filteredSuggestions.length} kandidat${searchUnit ? ` dengan satuan ${searchUnit}` : ''}.`}</p>
        {!searchLoading && <div aria-label="Rekomendasi pekerjaan"><p className={styles.help}>Sumber utama diprioritaskan; sumber tambahan ditampilkan terpisah pada rekap.</p>{candidateList(filteredSuggestions.slice((suggestionPage - 1) * 10, suggestionPage * 10), searching)}{!filteredSuggestions.length && <p className={styles.empty}>Belum ada kandidat. Ubah kata kunci, metode pencarian, atau filter satuan.</p>}
        {filteredSuggestions.length > 10 && <nav className={styles.pagination} aria-label="Halaman rekomendasi"><button type="button" disabled={suggestionPage <= 1} onClick={() => setSuggestionPage(n => n - 1)}>Sebelumnya</button><span>{suggestionPage} / {Math.ceil(filteredSuggestions.length / 10)}</span><button type="button" disabled={suggestionPage * 10 >= filteredSuggestions.length} onClick={() => setSuggestionPage(n => n + 1)}>Berikutnya</button></nav>}</div>}
      </div>}
    </dialog>
    <dialog ref={confirmDialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="confirm-title" onCancel={closeConfirm}>
      <div className={styles.modalHeader}><h2 id="confirm-title">Gunakan pasangan ini?</h2><button type="button" onClick={closeConfirm}>Tutup</button></div>
      {pending && <div className={styles.modalBody}><dl className={styles.comparison}><div><dt>Pekerjaan dari Excel</dt><dd>{pending.row.name}<small>Satuan: {pending.row.unit || 'Kosong'}</small></dd></div><div><dt>Hasil rekonsiliasi</dt><dd>{pending.candidate.name}<small>{pending.candidate.code || 'Tanpa kode'} · {pending.candidate.unit} · {pending.candidate.regulation}</small></dd></div></dl>
        <p>Pasangan ini akan diterapkan ke <strong>{members(pending.row).length} kemunculan</strong> dengan nama dan kode yang sama persis. Volume, satuan, harga, dan total setiap kemunculan tetap mengikuti data sumber.</p>
        {!rabPrimary(pending.candidate) && <p className={styles.problem}>{pending.candidate.regulation_status || 'Referensi tambahan'}. Pilihan ini masuk tabel dan persentase tambahan.</p>}
        {members(pending.row).some(row => rabDifferences(row, pending.candidate).length > 0) && <><ul className={styles.problem}>{[...new Set(members(pending.row).flatMap(row => rabDifferences(row, pending.candidate)))].map(text => <li key={text}>{text}</li>)}</ul><label>Penyelesaian perbedaan dan alasan memilih (opsional)<textarea aria-label="Penyelesaian perbedaan dan alasan memilih" value={resolution} onChange={e => setResolution(e.target.value)} /></label><p className={styles.help}>Catatan boleh dikosongkan. Perbedaan satuan dan spesifikasi tetap dicatat pada hasil; sistem tidak mengonversi volume atau harga.</p></>}
        <div className={styles.actions}><button type="button" onClick={closeConfirm}>Batalkan</button><button type="button" className={styles.primary} disabled={!groupReviewed(pending.row)} onClick={confirmCandidate}><Check size={18} aria-hidden="true" />Konfirmasi dan gunakan</button></div>
      </div>}
    </dialog>
    <dialog ref={occurrenceDialog} className={`${base.dialog} ${styles.dialog}`} aria-labelledby="occurrence-title" onCancel={closeOccurrences}>
      <div className={styles.modalHeader}><h2 id="occurrence-title">Kemunculan item pekerjaan</h2><button type="button" onClick={closeOccurrences}>Tutup</button></div>
      {occurrences && <div className={styles.modalBody}><p><strong>{occurrences.name}</strong> · {occurrences.code || 'Tanpa kode'} · {members(occurrences).length} kemunculan</p><p className={styles.help}>Nama dan kode sama persis. Satuan dan angka tetap mengikuti masing-masing baris sumber.</p><ul className={styles.occurrenceList}>{members(occurrences).slice((occurrencePage-1)*25, occurrencePage*25).map(row => <li key={row.id}><strong>{row.sheet}!{row.source} · baris {row.row}</strong><small>{label(row)}</small><dl className={styles.numbers}><div><dt>Volume / satuan</dt><dd>{value(row.volume)} {row.unit}</dd></div><div><dt>Harga Satuan (Rupiah)</dt><dd>{row.price === null ? 'Kosong' : rabMoney(row.price)}</dd></div><div><dt>Total harga (Rp)</dt><dd>{row.total === null ? 'Kosong' : rabMoney(row.total)}</dd></div></dl>{row.candidate && <p>{row.candidate.code} · {row.candidate.name} · {row.candidate.regulation}</p>}<button type="button" onClick={() => { closeOccurrences(); closeEdit(); openEdit(row) }}>Periksa baris {row.row}</button></li>)}</ul><nav className={styles.pagination} aria-label="Halaman kemunculan"><button type="button" disabled={occurrencePage <= 1} onClick={() => setOccurrencePage(page => page-1)}>Sebelumnya</button><span>{occurrencePage} / {Math.max(1, Math.ceil(members(occurrences).length/25))}</span><button type="button" disabled={occurrencePage*25 >= members(occurrences).length} onClick={() => setOccurrencePage(page => page+1)}>Berikutnya</button></nav></div>}
    </dialog>
    <div className={base.copyToastRegion} role="status" aria-live="polite" aria-atomic="true">{toast && <div className={`${base.copyToast} ${styles.toast}`}><Check size={20} aria-hidden="true" /><p>{toast.text}</p><button type="button" aria-label="Tutup notifikasi" onClick={() => setToast(null)}><X size={18} aria-hidden="true" /></button></div>}</div>
  </div></main>
}
