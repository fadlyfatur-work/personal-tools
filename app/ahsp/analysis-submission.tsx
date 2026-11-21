'use client'

import { useEffect, useRef, useState } from 'react'
import type { AhspItem } from '@/lib/ahsp'
import styles from './catalog.module.css'

type Draft = { group: 'tenaga' | 'bahan' | 'alat'; name: string; code: string; unit: string; coefficient: string; expression: string }
type Suggestion = { group: Draft['group']; name: string; unit: string; codes?: string[] }
const empty = (): Draft => ({ group: 'tenaga', name: '', code: '', unit: '', coefficient: '', expression: '' })

export default function AnalysisSubmission({ item, expanded }: { item: AhspItem; expanded: boolean }) {
  const section = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [components, setComponents] = useState<Draft[]>(() => item.components.filter(c => c.group !== 'smkk').map(c => ({ group: c.group as Draft['group'], name: c.name, code: c.code ?? '', unit: c.unit, coefficient: c.coefficient === null ? '' : String(c.coefficient), expression: c.expression === '0' ? '' : c.expression ?? '' })).concat(item.components.length ? [] : [empty()]))
  const [sourceReference, setSourceReference] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<number, Suggestion[]>>({})
  const [loadingSuggestions, setLoadingSuggestions] = useState<Record<number, boolean>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  useEffect(() => {
    if (!expanded) return
    const frame = requestAnimationFrame(() => {
      section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      heading.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [expanded])
  const update = (index: number, key: keyof Draft, value: string) => setComponents(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row))
  const search = (index: number, query: string, group: Draft['group']) => {
    clearTimeout(timers.current[index])
    if (query.trim().length < 2) { setSuggestions(current => ({ ...current, [index]: [] })); return }
    timers.current[index] = setTimeout(async () => {
      setLoadingSuggestions(current => ({ ...current, [index]: true }))
      try {
        const params = new URLSearchParams({ q: query.trim(), group, regulation: item.regulation })
        const response = await fetch(`/api/ahsp/mptk?${params}`, { cache: 'no-store' })
        const body = await response.json()
        if (response.ok) setSuggestions(current => ({ ...current, [index]: (body.items ?? []).slice(0, 5) }))
      } catch { /* free-text entry stays available */ }
      finally { setLoadingSuggestions(current => ({ ...current, [index]: false })) }
    }, 250)
  }
  const choose = (index: number, suggestion: Suggestion) => {
    setComponents(rows => rows.map((row, i) => i === index ? { ...row, group: suggestion.group, name: suggestion.name, code: suggestion.codes?.[0] ?? '', unit: suggestion.unit } : row))
    setSuggestions(current => ({ ...current, [index]: [] }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage('')
    const rows = components.map(row => ({ ...row, coefficient: row.coefficient.trim() === '' ? null : Number(row.coefficient.replace(',', '.')) }))
    if (rows.some(row => row.coefficient !== null && (!Number.isFinite(row.coefficient) || row.coefficient < 0))) { setMessage('Koefisien harus angka nol atau lebih.'); setSaving(false); return }
    try {
      const response = await fetch('/api/ahsp/analysis-submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id, sourceReference, components: rows }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error)
      setMessage('Usulan terkirim dan menunggu pemeriksaan admin. Katalog belum berubah.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Usulan gagal dikirim.') }
    finally { setSaving(false) }
  }

  return <section ref={section} className={styles.manual} aria-labelledby={`submission-title-${item.id}`}>
    <div id={`submission-${item.id}`} hidden={!expanded}>
    <h3 ref={heading} tabIndex={-1} id={`submission-title-${item.id}`}>Usulkan rincian analisis</h3>
    <p>Isi komponen berdasarkan dokumen sumber. Usulan baru masuk antrean; isi katalog berubah setelah disetujui admin.</p>
    <form onSubmit={submit}>
      <label>Sumber dan lokasi rujukan<input required maxLength={500} value={sourceReference} onChange={e => setSourceReference(e.target.value)} placeholder="Contoh: Lampiran II, halaman 18, tabel 2" /></label>
      {components.map((row, index) => <fieldset key={index} className={styles.manualRow}>
        <legend>Komponen {index + 1}</legend>
        <label>Kelompok<select value={row.group} onChange={e => { update(index, 'group', e.target.value); search(index, row.name, e.target.value as Draft['group']) }}><option value="tenaga">Tenaga kerja</option><option value="bahan">Bahan</option><option value="alat">Peralatan</option></select></label>
        <label>Nama komponen<input required maxLength={240} value={row.name} onChange={e => { update(index, 'name', e.target.value); search(index, e.target.value, row.group) }} /></label>
        {(loadingSuggestions[index] || suggestions[index]?.length > 0) && <div className={styles.componentSuggestions} aria-label="Komponen master yang cocok">{loadingSuggestions[index] ? <small>Mencari di master komponen…</small> : suggestions[index]?.map((suggestion, suggestionIndex) => <button type="button" key={`${suggestion.group}-${suggestion.name}-${suggestion.unit}-${suggestionIndex}`} onClick={() => choose(index, suggestion)}>{suggestion.name} · {suggestion.unit}</button>)}</div>}
        <label>Kode (opsional)<input maxLength={120} value={row.code} onChange={e => update(index, 'code', e.target.value)} /></label>
        <label>Satuan<input required maxLength={40} value={row.unit} onChange={e => update(index, 'unit', e.target.value)} placeholder="OJ, kg, m³, unit" /></label>
        <label>Koefisien<input inputMode="decimal" value={row.coefficient} onChange={e => update(index, 'coefficient', e.target.value)} placeholder="0 atau kosong bila rumus tersedia" /></label>
        <label>Rumus sumber (opsional)<input maxLength={500} value={row.expression} onChange={e => update(index, 'expression', e.target.value)} placeholder="Rumus sesuai dokumen" /></label>
        {components.length > 1 && <button type="button" onClick={() => setComponents(rows => rows.filter((_, i) => i !== index))}>Hapus komponen</button>}
      </fieldset>)}
      <div><button type="button" onClick={() => setComponents(rows => [...rows, empty()])}>Tambah komponen</button> <button type="submit" disabled={saving}>{saving ? 'Mengirim…' : 'Kirim untuk approval'}</button></div>
      <p role="status" aria-live="polite">{message}</p>
    </form>
    </div>
  </section>
}
