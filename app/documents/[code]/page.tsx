'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { documentTemplates } from '@/lib/documentTemplates'
import { useParams } from 'next/navigation'
import { ArrowLeft, DownloadSimple, FileText, Plus } from '@phosphor-icons/react'
import styles from '../documents.module.css'
import { generateDateRange, formatTanggalIndo } from '@/lib/dateHelper'
import type { TemplateConfig, GroupField, DateRangeValue, SingleField } from '@/types/templateSurat'

const QuillEditor = dynamic(() => import('./QuillEditor'), { ssr: false })

const LABEL_OVERRIDES: Record<string, string> = {
  sub_agenda: 'Kegiatan',
  keterangan: 'Detail keterangan',
}
const RICH_FIELDS = new Set(['keterangan'])
const SUB_AGENDA_MAX = 50

function htmlToPlainText(html: string): string {
  if (!html) return ''
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim()
  let s = html.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m: string, inner: string) => {
    let i = 0
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_l: string, t: string) => `\n${(i += 1)}. ${t}`)
  })
  s = s.replace(/<li[^>]*>/gi, '\n• ')
  s = s.replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export default function TemplateFormPage() {
  const params = useParams<{ code: string }>()
  const [templateName, setTemplateName] = useState('')
  const [config, setConfig] = useState<TemplateConfig | null>(null)
  const [singleData, setSingleData] = useState<Record<string, string | DateRangeValue>>({})
  const [groupData, setGroupData] = useState<Record<string, Record<string, string>[]>>({})
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [fetchError, setFetchError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    async function fetchTemplate() {
      setFetching(true)
      setNotFound(false)
      setFetchError(false)
      setConfig(null)
      setErrorMsg('')
      setWarnings([])
      setDownloaded(false)
      try {
        const { data, error } = Object.hasOwn(documentTemplates, params.code) ? { data: documentTemplates[params.code], error: null } : await supabase
          .from('templates')
          .select('name, fields')
          .eq('code', params.code)
          .abortSignal(controller.signal)
          .maybeSingle()
        if (controller.signal.aborted) return
        if (error) throw error
        if (!data) {
          setNotFound(true)
          return
        }
        const cfg = data.fields as TemplateConfig
        setTemplateName(data.name)
        setConfig(cfg)
        setSingleData(Object.fromEntries(cfg.single.map(field => [field.key, field.type === 'dateRange' ? { start: '', end: '' } : ''])))
        setGroupData(Object.fromEntries(cfg.groups.map(group => [group.name, group.autoDateFrom ? [] : [Object.fromEntries(group.fields.map(field => [field.key, '']))]])))
      } catch {
        if (!controller.signal.aborted) setFetchError(true)
      } finally {
        if (!controller.signal.aborted) setFetching(false)
      }
    }
    void fetchTemplate()
    return () => controller.abort()
  }, [params.code, attempt])

  function handleDateRangeChange(fieldKey: string, part: 'start' | 'end', value: string) {
    const current = (singleData[fieldKey] as DateRangeValue) || { start: '', end: '' }
    const updated = { ...current, [part]: value }
    setSingleData({ ...singleData, [fieldKey]: updated })

    if (!config) return
    const dates = updated.start && updated.end ? generateDateRange(updated.start, updated.end) : []

    config.groups
      .filter((g) => g.autoDateFrom === fieldKey)
      .forEach((g) => {
        setGroupData((prev) => {
          const existing = prev[g.name] || []
          const n = Math.min(dates.length, g.maxItems)
          const next: Record<string, string>[] = []
          for (let i = 0; i < n; i++) {
            const item = { ...(existing[i] || Object.fromEntries(g.fields.map((f) => [f.key, '']))) }
            if (g.autoDateField) item[g.autoDateField] = dates[i]
            next.push(item)
          }
          return { ...prev, [g.name]: next }
        })
      })
  }

  function addGroupItem(group: GroupField) {
    setGroupData((prev) => {
      const current = prev[group.name] || []
      if (current.length >= group.maxItems) return prev
      const emptyItem = Object.fromEntries(group.fields.map((f) => [f.key, '']))
      return { ...prev, [group.name]: [...current, emptyItem] }
    })
  }

  function removeGroupItem(groupName: string, index: number) {
    setGroupData((prev) => ({
      ...prev,
      [groupName]: prev[groupName].filter((_, i) => i !== index),
    }))
  }

  function updateGroupItem(groupName: string, index: number, key: string, value: string) {
    setGroupData((prev) => {
      const items = [...prev[groupName]]
      items[index] = { ...items[index], [key]: value }
      return { ...prev, [groupName]: items }
    })
  }

  function renderGroupSection(group: GroupField) {
    const items = groupData[group.name] || []
    return (
      <section key={group.name} className={styles.panel} aria-label={group.label}>
        <div className={styles.sectionHeading}>
          <h2>{group.label}</h2>
          <span>{items.length} / {group.maxItems}</span>
        </div>
        <p className={styles.help}>{group.autoDateFrom ? 'Baris mengikuti periode tanggal yang dipilih.' : 'Lengkapi data berikut. Tambahkan baris jika diperlukan.'}</p>
        {group.autoDateFrom && items.length === 0 && <p className={styles.notice}>Isi periode tanggal untuk menampilkan baris otomatis.</p>}
        {items.map((item, index) => (
          <div key={index} className={styles.entry}>
            <div className={styles.entryHeader}>
              <h3>{group.label} {index + 1}</h3>
              {!group.autoDateFrom && items.length > 1 && <button type="button" className={styles.remove} aria-label={`Hapus ${group.label} ${index + 1}`} onClick={() => removeGroupItem(group.name, index)}>Hapus</button>}
            </div>
            {group.fields.map(field => {
              const id = `${group.name}-${index}-${field.key}`
              const isPerjadin = params.code === 'perjadin_2026'
              const label = (isPerjadin && LABEL_OVERRIDES[field.key]) || field.label
              const autoDate = group.autoDateFrom && field.key === group.autoDateField
              const rich = isPerjadin && RICH_FIELDS.has(field.key)
              const capped = isPerjadin && group.name === 'agenda' && field.key === 'sub_agenda' && index === 1
              const value = item[field.key] || ''
              return (
                <div key={field.key} className={styles.field}>
                  <label htmlFor={id} className={styles.label}>{label}</label>
                  {autoDate ? (
                    <input id={id} className={styles.input} value={value ? formatTanggalIndo(value) : ''} disabled />
                  ) : rich ? (
                    <QuillEditor id={id} label={label} value={value} onChange={value => updateGroupItem(group.name, index, field.key, value)} placeholder={`Tulis ${label.toLowerCase()}…`} />
                  ) : field.type === 'textarea' ? (
                    <textarea id={id} required={field.required} className={styles.input} rows={3} value={value} onChange={event => updateGroupItem(group.name, index, field.key, event.target.value)} />
                  ) : (
                    <input id={id} required={field.required} className={styles.input} type={field.type === 'date' ? 'date' : 'text'} value={value} maxLength={capped ? SUB_AGENDA_MAX : undefined} aria-describedby={capped ? `${id}-hint` : undefined} onChange={event => updateGroupItem(group.name, index, field.key, event.target.value)} />
                  )}
                  {capped && <p id={`${id}-hint`} className={styles.counter}>{value.length}/{SUB_AGENDA_MAX} karakter</p>}
                </div>
              )
            })}
          </div>
        ))}
        {!group.autoDateFrom && (items.length < group.maxItems ? (
          <button type="button" className={styles.secondary} onClick={() => addGroupItem(group)}><Plus size={18} aria-hidden="true" /> Tambah {group.label}</button>
        ) : <p className={styles.help}>Maksimal {group.maxItems} baris untuk template ini.</p>)}
      </section>
    )
  }

  const progress = useMemo(() => {
    if (!config) return { filled: 0, total: 1 }
    let filled = 0
    let total = 0
    config.single.forEach((f) => {
      total += 1
      const v = singleData[f.key]
      if (f.type === 'dateRange') {
        const r = v as DateRangeValue
        if (r?.start && r?.end) filled += 1
      } else if (typeof v === 'string' && v.trim()) filled += 1
    })
    config.groups.forEach((g) => {
      ;(groupData[g.name] || []).forEach((item) => {
        g.fields.forEach((f) => {
          if (g.autoDateFrom && f.key === g.autoDateField) return
          total += 1
          const raw = item[f.key] || ''
          if ((params.code === 'perjadin_2026' && RICH_FIELDS.has(f.key) ? htmlToPlainText(raw) : raw).trim()) filled += 1
        })
      })
    })
    return { filled, total: Math.max(total, 1) }
  }, [config, singleData, groupData, params.code])

  async function handleGenerate() {
    setLoading(true)
    setErrorMsg('')
    setWarnings([])
    setDownloaded(false)
    try {
      const plainGroups: Record<string, Record<string, string>[]> = Object.fromEntries(
        Object.entries(groupData).map(([gName, items]) => [
          gName,
          items.map((item) =>
            Object.fromEntries(
              Object.entries(item).map(([k, v]) => [k, params.code === 'perjadin_2026' && RICH_FIELDS.has(k) ? htmlToPlainText(v) : v]),
            ),
          ),
        ]),
      )
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: params.code, single: singleData, groups: plainGroups }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setErrorMsg(err.error || 'Dokumen belum bisa dibuat. Coba lagi.')
        return
      }

      const warningsHeader = res.headers.get('X-Warnings')
      if (warningsHeader) {
        const w: string[] = JSON.parse(decodeURIComponent(warningsHeader))
        if (w.length) setWarnings(w)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disp = res.headers.get('Content-Disposition') || ''
      const m = disp.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/)
      a.download = m?.[1] ? decodeURIComponent(m[1]) : m?.[2] || `${templateName || params.code}.docx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloaded(true)
    } catch {
      setErrorMsg('Terjadi kesalahan, coba lagi')
    } finally {
      setLoading(false)
    }
  }

  function renderSingleField(field: SingleField) {
    const id = `single-${field.key}`
    if (field.type === 'dateRange') {
      const value = (singleData[field.key] as DateRangeValue) || { start: '', end: '' }
      return (
        <fieldset key={field.key} className={styles.field}>
          <legend className={styles.label}>{field.label}</legend>
          <div className={styles.dates}>
            <label htmlFor={`${id}-start`}>Tanggal mulai<input id={`${id}-start`} required={field.required} className={styles.input} type="date" value={value.start} max={value.end || undefined} onChange={event => handleDateRangeChange(field.key, 'start', event.target.value)} /></label>
            <label htmlFor={`${id}-end`}>Tanggal selesai<input id={`${id}-end`} required={field.required} className={styles.input} type="date" value={value.end} min={value.start || undefined} onChange={event => handleDateRangeChange(field.key, 'end', event.target.value)} /></label>
          </div>
        </fieldset>
      )
    }
    return (
      <div key={field.key} className={styles.field}>
        <label htmlFor={id} className={styles.label}>{field.label}</label>
        {field.type === 'select' ? (
          <select id={id} required={field.required} className={styles.input} value={(singleData[field.key] as string) || ''} onChange={event => setSingleData({ ...singleData, [field.key]: event.target.value })}>
            <option value="">Pilih {field.label.toLowerCase()}</option>
            {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea id={id} required={field.required} className={styles.input} rows={3} value={(singleData[field.key] as string) || ''} onChange={event => setSingleData({ ...singleData, [field.key]: event.target.value })} />
        ) : (
          <input id={id} required={field.required} className={styles.input} type={field.type === 'date' ? 'date' : 'text'} value={(singleData[field.key] as string) || ''} onChange={event => setSingleData({ ...singleData, [field.key]: event.target.value })} />
        )}
      </div>
    )
  }

  const pct = Math.round((progress.filled / progress.total) * 100)

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/documents" className={styles.back}><ArrowLeft size={18} aria-hidden="true" /> Pilih template surat</Link>
        {fetching ? (
          <div className={styles.panel} role="status"><div className={styles.skeleton} /><div className={styles.skeleton} /><p className={styles.muted}>Memuat isian template…</p></div>
        ) : fetchError ? (
          <div className={styles.empty} role="alert"><h1>Template belum bisa dimuat</h1><p>Periksa koneksi internet, lalu coba lagi.</p><button className={styles.secondary} onClick={() => setAttempt(value => value + 1)}>Coba lagi</button></div>
        ) : notFound || !config ? (
          <div className={styles.empty}><FileText size={32} aria-hidden="true" /><h1>Template tidak ditemukan</h1><p>Template ini tidak tersedia. Pilih surat lain dari daftar template.</p><Link href="/documents" className={styles.secondary}>Lihat template surat</Link></div>
        ) : (
          <>
            <header className={styles.header}><h1>{templateName}</h1><p>Lengkapi data surat di bawah. Format dokumen mengikuti template yang dipilih.</p></header>
            <form className={styles.workspace} onSubmit={event => { event.preventDefault(); void handleGenerate() }}>
              <div>
                {config.single.length > 0 && <section className={styles.panel}><div className={styles.sectionHeading}><h2>Data surat</h2></div><p className={styles.help}>Isi informasi utama sesuai kebutuhan surat.</p>{config.single.map(renderSingleField)}</section>}
                {config.groups.map(renderGroupSection)}
              </div>
              <aside className={styles.aside}>
                <FileText size={32} aria-hidden="true" />
                <h2>Siapkan dokumen</h2>
                <p>{progress.filled} dari {progress.total} isian terisi. Periksa kembali data sebelum mengunduh.</p>
                <progress className={styles.progress} value={progress.filled} max={progress.total} aria-label="Kelengkapan isian" />
                <p>{pct}% lengkap</p>
                {errorMsg && <div className={styles.error} role="alert">{errorMsg}</div>}
                {warnings.length > 0 && <div className={styles.notice} role="status">{warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
                {downloaded && <div className={styles.success} role="status">Dokumen berhasil dibuat. Unduhan Word telah dimulai.</div>}
                <button type="submit" className={styles.button} disabled={loading} aria-busy={loading}><DownloadSimple size={20} aria-hidden="true" />{loading ? 'Membuat dokumen…' : 'Unduh Word'}</button>
                <Link href="/documents" className={styles.secondary}>Pilih template lain</Link>
                <p>Isian hanya berlaku untuk surat ini. Simpan dokumen sebelum berpindah template.</p>
              </aside>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
