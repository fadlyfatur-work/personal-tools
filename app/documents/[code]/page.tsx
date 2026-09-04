'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { generateDateRange, formatTanggalIndo } from '@/lib/dateHelper'
import type { TemplateConfig, GroupField, DateRangeValue, SingleField } from '@/types/templateSurat'

const QuillEditor = dynamic(() => import('./QuillEditor'), { ssr: false })

const inputStyle = {
  width: '100%',
  border: '1px solid #dadce0',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box' as const,
  color: '#202124',
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#3c4043',
  marginBottom: 6,
} as const

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

  useEffect(() => {
    async function fetchTemplate() {
      setFetching(true)
      setNotFound(false)
      const { data } = await supabase
        .from('templates')
        .select('name, fields')
        .eq('code', params.code)
        .single()

      if (!data) {
        setNotFound(true)
        setFetching(false)
        return
      }
      const cfg = data.fields as TemplateConfig
      setTemplateName(data.name)
      setConfig(cfg)

      const initSingle: Record<string, string | DateRangeValue> = {}
      cfg.single.forEach((f) => {
        initSingle[f.key] = f.type === 'dateRange' ? { start: '', end: '' } : ''
      })
      setSingleData(initSingle)

      const initGroups: Record<string, Record<string, string>[]> = {}
      cfg.groups.forEach((g) => {
        initGroups[g.name] = g.autoDateFrom
          ? []
          : [Object.fromEntries(g.fields.map((f) => [f.key, '']))]
      })
      setGroupData(initGroups)
      setFetching(false)
    }
    fetchTemplate()
  }, [params.code])

  function handleDateRangeChange(fieldKey: string, part: 'start' | 'end', value: string) {
    const current = (singleData[fieldKey] as DateRangeValue) || { start: '', end: '' }
    const updated = { ...current, [part]: value }
    setSingleData({ ...singleData, [fieldKey]: updated })

    if (!config || !updated.start || !updated.end) return
    const dates = generateDateRange(updated.start, updated.end)

    config.groups
      .filter((g) => g.autoDateFrom === fieldKey)
      .forEach((g) => {
        setGroupData((prev) => {
          const existing = prev[g.name] || []
          const n = Math.min(dates.length, g.maxItems)
          const next: Record<string, string>[] = []
          for (let i = 0; i < n; i++) {
            next.push(existing[i] || Object.fromEntries(g.fields.map((f) => [f.key, ''])))
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

  function renderGroupSection(group: GroupField, stepNo: number) {
    return (
      <section
        key={group.name}
        style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            <span style={{ color: '#80868b', fontWeight: 500, marginRight: 6 }}>{stepNo}.</span>
            {group.label}
          </h2>
          <span style={{ fontSize: 12, color: '#80868b' }}>
            {(groupData[group.name] || []).length}/{group.maxItems}
          </span>
        </div>
        <p style={{ fontSize: 12, color: '#80868b', margin: '0 0 14px' }}>
          {group.name === 'peserta'
            ? 'Isi nama & jabatan dulu sebelum lanjut ke bawah.'
            : group.autoDateFrom
              ? 'Baris mengikuti periode tanggal otomatis.'
              : 'Tambah baris sesuai kebutuhan.'}
        </p>

        {group.autoDateFrom && (groupData[group.name] || []).length === 0 && (
          <div style={{ background: '#f8f9fa', border: '1px dashed #dadce0', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#5f6368' }}>
            Isi periode tanggal di atas dulu — baris agenda muncul otomatis di sini.
          </div>
        )}

        {(groupData[group.name] || []).map((item, index) => {
          const autoVal = group.autoDateField ? item[group.autoDateField] : ''
          let autoLabel = `#${index + 1}`
          if (autoVal) {
            try {
              autoLabel = `#${index + 1} · ${formatTanggalIndo(autoVal)}`
            } catch {
              autoLabel = `#${index + 1}`
            }
          }
          return (
            <div
              key={index}
              style={{ border: '1px solid #e8eaed', borderRadius: 10, padding: 14, marginBottom: 10, background: '#fff' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>{autoLabel}</strong>
                {!group.autoDateFrom && (groupData[group.name]?.length || 0) > 1 && (
                  <button
                    onClick={() => removeGroupItem(group.name, index)}
                    style={{ border: 'none', background: 'none', color: '#d93025', fontSize: 12, cursor: 'pointer', padding: '2px 4px' }}
                  >
                    Hapus
                  </button>
                )}
              </div>
              {group.fields.map((f) => {
                const isAutoDate = group.autoDateFrom && f.key === group.autoDateField
                const label = LABEL_OVERRIDES[f.key] ?? f.label
                const isRich = RICH_FIELDS.has(f.key)
                const isCapped = group.name === 'agenda' && f.key === 'sub_agenda' && index === 1
                const val = item[f.key] || ''
                return (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <label style={{ ...labelStyle, fontSize: 12, color: '#5f6368' }}>{label}</label>
                    {isAutoDate ? (
                      <input
                        type="text"
                        value={item[f.key] || `Otomatis dari periode (hari ke-${index + 1})`}
                        disabled
                        style={{ ...inputStyle, background: '#f8f9fa', color: '#80868b' }}
                      />
                    ) : isRich ? (
                      <QuillEditor
                        value={val}
                        onChange={(v) => updateGroupItem(group.name, index, f.key, v)}
                        placeholder={`Tulis ${label.toLowerCase()}…`}
                      />
                    ) : (
                      <input
                        type={f.type === 'date' ? 'date' : 'text'}
                        value={val}
                        maxLength={isCapped ? SUB_AGENDA_MAX : undefined}
                        onChange={(e) => updateGroupItem(group.name, index, f.key, e.target.value)}
                        style={inputStyle}
                      />
                    )}
                    {isCapped && (
                      <div
                        style={{
                          textAlign: 'right',
                          fontSize: 11,
                          color: val.length >= SUB_AGENDA_MAX ? '#d93025' : '#80868b',
                          marginTop: 4,
                        }}
                      >
                        Hari kedua · {val.length}/{SUB_AGENDA_MAX}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {!group.autoDateFrom &&
          ((groupData[group.name]?.length || 0) < group.maxItems ? (
            <button
              onClick={() => addGroupItem(group)}
              style={{
                width: '100%',
                border: '1px dashed #dadce0',
                background: '#fff',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 13,
                color: '#1a73e8',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + Tambah {group.label}
            </button>
          ) : (
            <p style={{ fontSize: 12, color: '#80868b', margin: '4px 0 0' }}>
              Batas maksimal {group.maxItems} tercapai.
            </p>
          ))}
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
          if ((RICH_FIELDS.has(f.key) ? htmlToPlainText(raw) : raw).trim()) filled += 1
        })
      })
    })
    return { filled, total: Math.max(total, 1) }
  }, [config, singleData, groupData])

  async function handleGenerate() {
    setLoading(true)
    setErrorMsg('')
    setWarnings([])
    try {
      const plainGroups: Record<string, Record<string, string>[]> = Object.fromEntries(
        Object.entries(groupData).map(([gName, items]) => [
          gName,
          items.map((item) =>
            Object.fromEntries(
              Object.entries(item).map(([k, v]) => [k, RICH_FIELDS.has(k) ? htmlToPlainText(v) : v]),
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
        setErrorMsg(err.error || 'Gagal generate dokumen')
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
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setErrorMsg('Terjadi kesalahan, coba lagi')
    } finally {
      setLoading(false)
    }
  }

  function renderSingleField(f: SingleField) {
    if (f.type === 'dateRange') {
      const val = (singleData[f.key] as DateRangeValue) || { start: '', end: '' }
      return (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{f.label}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={val.start}
              onChange={(e) => handleDateRangeChange(f.key, 'start', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ fontSize: 12, color: '#80868b', whiteSpace: 'nowrap' }}>s.d.</span>
            <input
              type="date"
              value={val.end}
              onChange={(e) => handleDateRangeChange(f.key, 'end', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      )
    }
    if (f.type === 'textarea') {
      return (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{f.label}</label>
          <textarea
            value={(singleData[f.key] as string) || ''}
            onChange={(e) => setSingleData({ ...singleData, [f.key]: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>
      )
    }
    return (
      <div key={f.key} style={{ marginBottom: 14 }}>
        <label style={labelStyle}>{f.label}</label>
        <input
          type={f.type === 'date' ? 'date' : 'text'}
          value={(singleData[f.key] as string) || ''}
          onChange={(e) => setSingleData({ ...singleData, [f.key]: e.target.value })}
          style={inputStyle}
        />
      </div>
    )
  }

  const pct = Math.round((progress.filled / progress.total) * 100)

  const leadGroups = useMemo(() => config?.groups.filter((g) => g.name === 'peserta') ?? [], [config])
  const tailGroups = useMemo(() => config?.groups.filter((g) => g.name !== 'peserta') ?? [], [config])
  const singleNo = leadGroups.length + 1

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8f9fa',
        padding: '32px 16px 120px',
        fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
        color: '#202124',
      }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link
          href="/"
          style={{ fontSize: 13, color: '#1a73e8', textDecoration: 'none', display: 'inline-block', marginBottom: 16 }}
        >
          ← Semua tools
        </Link>

        {fetching ? (
          <div style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 12, padding: 24 }}>
            <div style={{ height: 18, width: '55%', background: '#eef0f2', borderRadius: 6, marginBottom: 12 }} />
            <div style={{ height: 12, width: '35%', background: '#f1f3f4', borderRadius: 6, marginBottom: 20 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 38, background: '#f1f3f4', borderRadius: 8, marginBottom: 10 }} />
            ))}
            <p style={{ fontSize: 13, color: '#80868b', margin: '8px 0 0' }}>Memuat template…</p>
          </div>
        ) : notFound || !config ? (
          <div style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
            <h1 style={{ fontSize: 17, fontWeight: 500, margin: '0 0 6px' }}>Template tidak ditemukan</h1>
            <p style={{ fontSize: 13, color: '#5f6368', margin: '0 0 16px' }}>
              Kode “{params.code}” tidak ada di database.
            </p>
            <Link href="/" style={{ fontSize: 13, color: '#1a73e8', textDecoration: 'none' }}>
              ← Kembali ke beranda
            </Link>
          </div>
        ) : (
          <>
            <header
              style={{
                background: '#fff',
                border: '1px solid #dadce0',
                borderRadius: 12,
                padding: '20px 22px',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: '#e8f0fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  📝
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0, letterSpacing: '-0.2px' }}>
                    {templateName}
                  </h1>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: 1,
                        background: '#f1f3f4',
                        color: '#5f6368',
                        borderRadius: 6,
                        padding: '3px 8px',
                      }}
                    >
                      {params.code}
                    </span>
                    <span style={{ fontSize: 12, color: '#80868b' }}>
                      {progress.filled}/{progress.total} terisi
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ height: 6, background: '#f1f3f4', borderRadius: 4, marginTop: 14, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: '#1a73e8',
                    borderRadius: 4,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </header>

            {errorMsg && (
              <div style={{ background: '#fce8e6', color: '#b3261e', fontSize: 13, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                {errorMsg}
              </div>
            )}
            {warnings.length > 0 && (
              <div style={{ background: '#fef7e0', color: '#7a4b00', fontSize: 13, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{ marginTop: i ? 4 : 0 }}>⚠ {w}</div>
                ))}
              </div>
            )}

            {leadGroups.map((group, i) => renderGroupSection(group, i + 1))}

            <section style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>
                <span style={{ color: '#80868b', fontWeight: 500, marginRight: 6 }}>{singleNo}.</span>
                Data perjalanan
              </h2>
              <p style={{ fontSize: 12, color: '#80868b', margin: '0 0 16px' }}>Lengkapi info utama surat.</p>
              {config.single.map(renderSingleField)}
            </section>

            {tailGroups.map((group, gi) => renderGroupSection(group, singleNo + 1 + gi))}

            <div
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(255,255,255,0.96)',
                borderTop: '1px solid #dadce0',
                padding: '12px 16px',
                backdropFilter: 'blur(6px)',
              }}
            >
              <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#5f6368', flex: 1 }}>{pct}% lengkap</span>
                <button
                  onClick={handleGenerate}
                  disabled={loading || fetching}
                  style={{
                    border: 'none',
                    borderRadius: 20,
                    padding: '10px 24px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: '#1a73e8',
                    color: '#fff',
                    fontFamily: 'inherit',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Membuat…' : '⬇ Generate & Download'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
