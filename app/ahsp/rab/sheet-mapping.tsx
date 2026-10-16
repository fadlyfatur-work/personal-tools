'use client'

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CaretDown, Check, X } from '@phosphor-icons/react'
import { RAB_FIELDS, RAB_MAX_ROWS, detectRabMapping, extractRabRows, rabColumnIndex, rabText, type RabMapping, type RabSheet } from '@/lib/ahspRab'
import base from '../catalog.module.css'
import styles from './sheet-mapping.module.css'

type Field = keyof typeof RAB_FIELDS
const order: Field[] = ['code', 'name', 'unit', 'volume', 'price', 'total']
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 10 })
const countPerPage = 5

function pickerPosition(button: HTMLButtonElement): CSSProperties {
  const rect = button.getBoundingClientRect()
  const width = Math.min(430, window.innerWidth - 32)
  const below = window.innerHeight - rect.bottom - 24
  const above = rect.top - 24
  const openBelow = below >= 250 || below >= above
  const available = openBelow ? below : above
  const maxHeight = Math.min(480, window.innerHeight - 32, available >= 200 ? available : window.innerHeight - 32)
  const desiredTop = openBelow ? rect.bottom + 8 : rect.top - maxHeight - 8
  return { left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), top: Math.max(16, Math.min(desiredTop, window.innerHeight - maxHeight - 16)), width, maxHeight }
}

function headerText(sheet: RabSheet, column: string) {
  const labels: string[] = []
  for (let row = 1; row < Math.min(sheet.mapping.start, 61); row++) {
    const merge = sheet.merges.find(m => m.from <= row && m.to >= row && m.left <= rabColumnIndex(column) && m.right >= rabColumnIndex(column))
    const text = (sheet.cells[`${column}${row}`]?.text || (merge ? sheet.cells[`${sheet.columns.find(col => rabColumnIndex(col) === merge.left)}${merge.from}`]?.text : '') || '').replace(/\s+/g, ' ').trim()
    if (text.length < 100 && /uraian|jenis pekerjaan|kode|satuan|kuantitas|volume|^vol$|harga|biaya|mata pembayaran|^no\.?$/i.test(text) && !labels.includes(text)) labels.push(text)
  }
  return labels.slice(-2).join(' / ') || 'Tanpa header'
}

export default function SheetMapping({ sheet, onChange }: { sheet: RabSheet; onChange: (mapping: RabMapping) => void }) {
  const [view, setView] = useState<'read' | 'source'>('read')
  const [page, setPage] = useState(1)
  const [showExcluded, setShowExcluded] = useState(false)
  const [sourceStart, setSourceStart] = useState(Math.max(1, sheet.mapping.start - 1))
  const [startDraft, setStartDraft] = useState(String(sheet.mapping.start))
  const [active, setActive] = useState<Field | null>(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [previous, setPrevious] = useState<RabMapping | null>(null)
  const [position, setPosition] = useState<CSSProperties>({ left: 16, top: 16 })
  const [cell, setCell] = useState<{ address: string; text: string } | null>(null)
  const picker = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const cellDialog = useRef<HTMLDialogElement>(null)
  const pickerId = useId()
  const rows = useMemo(() => extractRabRows(sheet, sheet.mapping), [sheet])
  const activeRows = rows.filter(row => !row.excluded)
  const excluded = rows.length - activeRows.length
  const displayed = showExcluded ? rows : activeRows
  const pages = Math.max(1, Math.ceil(displayed.length / countPerPage))
  const currentPage = Math.min(page, pages)
  const preview = displayed.slice((currentPage - 1) * countPerPage, currentPage * countPerPage)
  const columns = useMemo(() => sheet.columns.map(column => {
    const samples: string[] = []
    for (let row = sheet.mapping.start; row <= Math.min(sheet.lastRow, sheet.mapping.start + 50, RAB_MAX_ROWS) && samples.length < 2; row++) {
      const cell = sheet.cells[`${column}${row}`]
      const value = cell?.value !== null && cell?.value !== undefined ? number.format(cell.value) : cell?.text.replace(/\s+/g, ' ').trim()
      if (value && !samples.includes(value)) samples.push(value)
    }
    return { column, header: headerText(sheet, column), samples }
  }), [sheet])
  const options = columns.filter(col => rabText(`${col.column} ${col.header} ${col.samples.join(' ')}`).includes(rabText(query)))
  const sourceColumns = sheet.columns.filter(col => Object.values(sheet.mapping).includes(col)).sort((a, b) => rabColumnIndex(a) - rabColumnIndex(b))
  const last = Math.min(RAB_MAX_ROWS, sheet.lastRow)
  const sourceFirst = Math.min(Math.max(1, sourceStart), Math.max(1, last))
  const sourceRows = Array.from({ length: Math.min(5, Math.max(0, last - sourceFirst + 1)) }, (_, i) => sourceFirst + i)

  useEffect(() => {
    if (!active) return
    const place = () => {
      if (trigger.current) setPosition(pickerPosition(trigger.current))
    }
    place(); search.current?.focus({ preventScroll: true })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [active])
  useEffect(() => { if (cell) cellDialog.current?.showModal() }, [cell])

  const closePicker = (restoreFocus = true) => {
    picker.current?.hidePopover(); setActive(null)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }
  const openPicker = (field: Field, button: HTMLButtonElement) => {
    trigger.current = button; setPosition(pickerPosition(button)); setActive(field); setQuery('')
    picker.current?.showPopover()
  }
  const apply = (column: string) => {
    if (!active) return
    const oldColumn = sheet.mapping[active]
    if (column === oldColumn) { closePicker(); return }
    const next = { ...sheet.mapping, [active]: column }
    const moved = order.find(field => field !== active && column && sheet.mapping[field] === column)
    if (moved) next[moved] = oldColumn
    setPrevious({ ...sheet.mapping }); onChange(next); setPage(1)
    setMessage(`${RAB_FIELDS[active]} memakai ${column ? `kolom ${column}` : 'Tidak tersedia'}.${moved ? ` ${RAB_FIELDS[moved]} berpindah ke ${oldColumn ? `kolom ${oldColumn}` : 'Tidak tersedia'}.` : ''}`)
    closePicker()
  }
  const startAt = (start: number) => {
    if (!Number.isInteger(start) || start < 1 || start > Math.min(Math.max(sheet.lastRow, 1), RAB_MAX_ROWS)) return
    setStartDraft(String(start)); setPrevious({ ...sheet.mapping }); onChange({ ...sheet.mapping, start }); setPage(1); setMessage(`Pembacaan dimulai pada baris ${start}.`)
  }
  const reset = () => { const mapping = detectRabMapping(sheet); setPrevious({ ...sheet.mapping }); onChange(mapping); setStartDraft(String(mapping.start)); setPage(1); setMessage('Deteksi otomatis diterapkan kembali.') }
  const closeCell = () => { cellDialog.current?.close(); setCell(null) }
  const fieldButton = (field: Field) => <button type="button" className={styles.columnButton} aria-label={`Ubah kolom ${RAB_FIELDS[field]}`} aria-haspopup="dialog" aria-expanded={active === field} aria-controls={pickerId} onClick={e => openPicker(field, e.currentTarget)}>
    <span>{RAB_FIELDS[field]}</span><small>{sheet.mapping[field] ? `Kolom ${sheet.mapping[field]}` : 'Tidak tersedia'}<CaretDown size={14} aria-hidden="true" /></small>
  </button>

  return <fieldset className={styles.mapping}><legend>{sheet.name}</legend>
    <div className={styles.heading}><div><h3>Periksa hasil pembacaan</h3><p>{activeRows.length} pekerjaan · {excluded} baris dikecualikan. Belum dicocokkan dengan AHSP.</p></div><button type="button" onClick={reset}>Deteksi ulang kolom</button></div>
    <div className={styles.toolbar}>
      <div className={styles.views} aria-label={`Tampilan pratinjau ${sheet.name}`}><button type="button" aria-pressed={view === 'read'} onClick={() => setView('read')}>Hasil pembacaan</button><button type="button" aria-pressed={view === 'source'} onClick={() => setView('source')}>Sel Excel asli</button></div>
      <label className={styles.start}>Mulai dari baris<input aria-label={`Baris awal data ${sheet.name}`} type="number" min="1" max={Math.min(Math.max(sheet.lastRow, 1), RAB_MAX_ROWS)} value={startDraft} onChange={e => { setStartDraft(e.target.value); if (e.target.value) startAt(Number(e.target.value)) }} onBlur={() => setStartDraft(String(sheet.mapping.start))} /></label>
    </div>
    <p className={styles.instruction}>{view === 'read' ? 'Klik header kolom untuk mengganti sumbernya. Perubahan langsung terlihat pada lima pekerjaan di bawah.' : 'Kolom mengikuti urutan Excel. Klik nomor baris untuk menentukan awal data; buka sel untuk membaca teks panjang.'}</p>
    <div className={styles.feedback} role="status"><span>{message}</span>{previous && <button type="button" onClick={() => { onChange(previous); setStartDraft(String(previous.start)); setPrevious(null); setPage(1); setMessage('Perubahan terakhir diurungkan.') }}>Urungkan</button>}</div>
    {view === 'read' ? <>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={`Hasil pembacaan ${sheet.name}`}><table className={styles.previewTable}>
        <colgroup><col className={styles.rowColumn} />{order.map(field => <col key={field} className={field === 'name' ? styles.nameColumn : field === 'price' || field === 'total' ? styles.moneyColumn : styles.shortColumn} />)}</colgroup>
        <thead><tr><th scope="col" className={styles.rowHeading}>Baris</th>{order.map(field => <th key={field} scope="col" data-active={active === field}>{fieldButton(field)}</th>)}</tr></thead>
        <tbody>{preview.map(row => <tr key={row.id} data-excluded={row.excluded}>
          <td className={styles.rowNumber} data-label="Baris sumber">{row.row}</td>
          {order.map(field => <td key={field} data-field={field} data-label={RAB_FIELDS[field]} className={['volume', 'price', 'total'].includes(field) ? styles.numeric : undefined}>{field === 'name' ? <><strong>{row.name}</strong><small>{row.source}{row.excluded ? ` · ${row.exclusion}` : !row.reviewed ? ' · Perlu konfirmasi pembacaan' : ''}</small></> : typeof row[field] === 'number' ? number.format(row[field] as number) : row[field] || <span className={styles.blank}>Kosong</span>}</td>)}
        </tr>)}</tbody>
      </table>{!preview.length && <p className={styles.empty}>Belum ada pekerjaan terbaca. Periksa kolom uraian, baris awal, atau tampilkan baris yang dikecualikan.</p>}</div>
      <div className={styles.footer}><label className={styles.excluded}><input type="checkbox" checked={showExcluded} onChange={e => { setShowExcluded(e.target.checked); setPage(1) }} />Tampilkan {excluded} baris dikecualikan</label><div className={styles.paging}><button type="button" aria-label={`Pekerjaan sebelumnya ${sheet.name}`} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Sebelumnya</button><span>{displayed.length ? (currentPage - 1) * countPerPage + 1 : 0}–{Math.min(currentPage * countPerPage, displayed.length)} dari {displayed.length}</span><button type="button" aria-label={`Pekerjaan berikutnya ${sheet.name}`} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Berikutnya</button></div></div>
    </> : <>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={`Sel Excel asli ${sheet.name}`}><table className={styles.sourceTable}><colgroup><col className={styles.rowColumn} />{sourceColumns.map(col => <col key={col} className={col === sheet.mapping.name ? styles.nameColumn : styles.moneyColumn} />)}</colgroup><thead><tr><th scope="col">Baris</th>{sourceColumns.map(col => <th key={col} scope="col">{col}<small>{order.filter(field => sheet.mapping[field] === col).map(field => RAB_FIELDS[field]).join(', ')}</small></th>)}</tr></thead><tbody>{sourceRows.map(row => <tr key={row} data-start={row === sheet.mapping.start}><th scope="row"><button type="button" aria-label={`Mulai data dari baris ${row}`} aria-pressed={sheet.mapping.start === row} onClick={() => startAt(row)}>{row}</button></th>{sourceColumns.map(col => {
        const cell = sheet.cells[`${col}${row}`]
        const text = cell?.text ?? ''
        return <td key={col}><div className={styles.sourceText}>{cell?.value !== null && cell?.value !== undefined ? number.format(cell.value) : text || <span className={styles.blank}>Kosong</span>}</div>{(text.length > 120 || text.split(/\r?\n/).length > 2) && <button type="button" className={styles.openCell} onClick={() => setCell({ address: `${col}${row}`, text })}>Lihat sel {col}{row}</button>}</td>
      })}</tr>)}</tbody></table></div>
      <div className={styles.footer}><span>Kolom terpakai, berurutan seperti Excel.</span><div className={styles.paging}><button type="button" aria-label={`Baris sebelumnya ${sheet.name}`} disabled={sourceFirst <= 1} onClick={() => setSourceStart(Math.max(1, sourceFirst - 5))}>Sebelumnya</button><label>Ke baris<input type="number" min="1" max={Math.max(1, last)} aria-label={`Tampilkan baris sumber ${sheet.name}`} value={sourceFirst} onChange={e => setSourceStart(Number(e.target.value))} /></label><span>/ {last}</span><button type="button" aria-label={`Baris berikutnya ${sheet.name}`} disabled={sourceFirst + 4 >= last} onClick={() => setSourceStart(sourceFirst + 5)}>Berikutnya</button></div></div>
    </>}
    {activeRows.some(row => !row.reviewed) && <p className={styles.readingNote}>Ada sel gabungan atau angka yang perlu diperiksa. Hasil pemisahan tetap harus dikonfirmasi pada tahap rekonsiliasi.</p>}
    <div ref={picker} id={pickerId} popover="auto" className={styles.picker} style={position} role="dialog" aria-label={active ? `Pilih kolom ${RAB_FIELDS[active]}` : 'Pilih kolom sumber'} onToggle={e => { if (!e.currentTarget.matches(':popover-open')) setActive(null) }} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); closePicker() } }}>
      <div className={styles.pickerHeading}><div><strong>{active ? RAB_FIELDS[active] : 'Kolom sumber'}</strong><small>Pilih berdasarkan header dan contoh isi.</small></div><button type="button" aria-label="Tutup pilihan kolom" onClick={() => closePicker()}><X size={18} aria-hidden="true" /></button></div>
      <label className={styles.searchLabel}>Cari kolom<input ref={search} type="search" aria-label="Cari kolom sumber" value={query} onChange={e => setQuery(e.target.value)} placeholder="Huruf, header, atau contoh isi" /></label>
      <div className={styles.options}>{active && active !== 'name' && <button type="button" className={styles.option} aria-pressed={!sheet.mapping[active]} onClick={() => apply('')}><span className={styles.letter}>-</span><span><strong>Tidak tersedia</strong><small>Biarkan data ini kosong.</small></span></button>}{options.map(col => {
        const used = order.find(field => field !== active && sheet.mapping[field] === col.column)
        const selected = active ? sheet.mapping[active] === col.column : false
        return <button type="button" key={col.column} className={styles.option} aria-label={`Gunakan kolom ${col.column}: ${col.header}`} aria-pressed={selected} onClick={() => apply(col.column)}><span className={styles.letter}>{col.column}</span><span><strong>{col.header}</strong><small className={styles.sample}>{col.samples.join(' · ') || 'Tidak ada contoh isi pada awal data.'}</small>{used && <small>Saat ini untuk {RAB_FIELDS[used]}. Sumber akan ditukar.</small>}</span>{selected && <Check size={18} aria-hidden="true" />}</button>
      })}{!options.length && <p className={styles.empty}>Kolom tidak ditemukan. Coba huruf kolom atau kata dari header.</p>}</div>
    </div>
    <dialog ref={cellDialog} className={`${base.dialog} ${styles.cellDialog}`} aria-labelledby={`${pickerId}-cell-title`} onCancel={closeCell}><div className={styles.cellHeading}><h2 id={`${pickerId}-cell-title`}>Sel {sheet.name}!{cell?.address}</h2><button type="button" onClick={closeCell}>Tutup</button></div><div className={styles.fullCell}>{cell?.text}</div></dialog>
  </fieldset>
}
