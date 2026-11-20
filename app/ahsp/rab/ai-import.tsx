'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GearSix, LockKey, X } from '@phosphor-icons/react'
import { AI_LIMITS, aiItemsToRows, type AiConfig, type AiItem, type AiProfile } from '@/lib/ahspRabAi'
import { openAiDocument, parseAiPages, type AiDocument, type AiDocumentPage } from '@/lib/ahspRabAiDocument'
import type { AiCallInput } from '@/lib/ahspRabAiServer'
import type { RabRow } from '@/lib/ahspRab'
import AiSettings from './ai-settings'
import AiActivity, { type ActivityTrace } from './ai-activity'
import base from '../catalog.module.css'
import styles from './ai.module.css'

export type AiSourceFile = { file: File; id: string }
type Call = (input: Partial<AiCallInput> & { stage: 'ocr' | 'structure'; pages: number[]; profileId?: string; draft?: AiConfig; apiKey?: string }, signal?: AbortSignal) => Promise<{ text?: string; items?: AiItem[] }>

export default function AiImport({ source, disabled, onAccept, onBusy, onClear }: { source: AiSourceFile | null; disabled: boolean; onAccept: (filename: string, rows: RabRow[]) => void; onBusy: (value: boolean) => void; onClear: () => void }) {
  const [access, setAccess] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [profiles, setProfiles] = useState<AiProfile[]>([])
  const [ocrProfile, setOcrProfile] = useState('')
  const [jsonProfile, setJsonProfile] = useState('')
  const [settings, setSettings] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [traces, setTraces] = useState<ActivityTrace[]>([])
  useEffect(() => { const controller = new AbortController(); void fetch('/api/ahsp/rab/ai/status', { signal: controller.signal }).then(response => response.json()).then(data => setConfigured(data.configured)).catch(() => {}); return () => controller.abort() }, [])
  async function reload() {
    const response = await fetch('/api/ahsp/rab/ai/profiles', { headers: { 'x-ahsp-ai-access': access } })
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Profil gagal dimuat.')
    const list = result.profiles as AiProfile[], defaultId = list.find(item => item.isDefault)?.id || list[0]?.id || ''
    setProfiles(list); setOcrProfile(current => list.some(item => item.id === current) ? current : defaultId); setJsonProfile(current => list.some(item => item.id === current) ? current : defaultId)
  }
  async function unlock(event: React.FormEvent) {
    event.preventDefault(); setError(''); setLoading(true)
    try { await reload(); setUnlocked(true) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Akses gagal dibuka.') } finally { setLoading(false) }
  }
  const activityBusy = useCallback((value: boolean) => { setBusy(value); onBusy(value) }, [onBusy])
  const call: Call = async (input, signal) => {
    if (!unlocked) throw new Error('Buka akses pengelola terlebih dahulu.')
    const profile = input.draft || profiles.find(item => item.id === input.profileId)
    if (!profile) throw new Error('Pilih atau simpan profil API terlebih dahulu.')
    const id = crypto.randomUUID(), started = Date.now()
    const pending: ActivityTrace = { id, stage: input.stage, profile: profile.name, model: profile.model, page: input.page ?? null, startedAt: new Date(started).toISOString(), durationMs: 0, status: null, ok: false, pending: true, request: { note: 'Request upstream tersamarkan akan ditampilkan setelah server mengembalikan hasil.', pages: input.pages }, response: null }
    setTraces(current => [pending, ...current].slice(0, AI_LIMITS.traces))
    try {
      const response = await fetch('/api/ahsp/rab/ai/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ahsp-ai-access': access }, body: JSON.stringify(input), signal })
      const body = await response.json()
      if (signal?.aborted) throw new DOMException('Dibatalkan', 'AbortError')
      if (body.trace) setTraces(current => current.map(item => item.id === id ? body.trace : item))
      if (!response.ok || !body.trace?.ok) throw new Error(body.error || body.trace?.error || 'Permintaan AI gagal.')
      return body
    } catch (cause) {
      const message = signal?.aborted ? 'Proses dibatalkan. Respons upstream tidak diterima oleh halaman ini.' : cause instanceof Error ? cause.message : 'Permintaan gagal.'
      setTraces(current => current.map(item => item.id === id && item.pending ? { ...item, pending: false, cancelled: !!signal?.aborted, durationMs: Date.now() - started, error: message } : item))
      throw new Error(message)
    }
  }
  return <section className={styles.root} data-rab-panel aria-labelledby="ai-import-title">
    <div className={styles.heading}><div><h2 id="ai-import-title">Pembacaan PDF & gambar</h2><p>Halaman sumber → teks → JSON pekerjaan → pencocokan Master AHSP.</p></div><button type="button" disabled={busy || disabled} onClick={() => setSettings(true)}><GearSix size={18} aria-hidden="true" />Pengaturan AI</button></div>
    {!unlocked ? <details className={styles.access} open={!!source}><summary><LockKey size={16} aria-hidden="true" />Akses pengelola untuk API AI</summary>
      <p className={styles.help}>Excel tetap dibaca langsung di browser. Pemanggilan AI dan pengaturan profil memerlukan kunci akses pengelola.</p>
      {configured === false && <p className={styles.error}>Konfigurasi server belum lengkap. Siapkan AHSP_AI_ADMIN_TOKEN, AHSP_AI_ENCRYPTION_KEY, dan migrasi profil AI. Petunjuk tersedia pada dokumentasi OCR RAB.</p>}
      <form className={styles.accessForm} onSubmit={event => { void unlock(event) }}><label>Kunci akses pengelola<input type="password" autoComplete="off" maxLength={256} disabled={loading || busy || disabled} value={access} onChange={event => setAccess(event.target.value)} /></label><button type="submit" disabled={loading || !access || disabled}>{loading && <span className={base.spinner} aria-hidden="true" />}{loading ? 'Membuka akses…' : 'Buka akses AI'}</button></form>
    </details> : <div className={styles.toolbar}><span className={styles.help}>Akses pengelola aktif · {profiles.length} profil</span><button type="button" disabled={busy || disabled} onClick={() => { setAccess(''); setUnlocked(false); setProfiles([]) }}>Kunci akses</button>{!profiles.length && <span className={styles.help}>Tambahkan profil melalui Pengaturan AI.</span>}</div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {source && <AiSource key={source.id} file={source.file} unlocked={unlocked} profiles={profiles} ocrProfile={ocrProfile} jsonProfile={jsonProfile} setOcrProfile={setOcrProfile} setJsonProfile={setJsonProfile} call={call} disabled={disabled} onBusy={activityBusy} onAccept={onAccept} onClear={onClear} />}
    {!source && <p className={styles.help}>Pilih PDF, PNG, JPG, atau WebP pada Unggah dokumen. Maksimal 10 MB dan 10 halaman terpilih per impor; hasil maksimal 1.000 item.</p>}
    <AiActivity traces={traces} />
    {settings && <AiSettings access={access} unlocked={unlocked} profiles={profiles} reload={reload} close={() => setSettings(false)} runSample={async (draft, apiKey, id, signal) => { activityBusy(true); try { await call({ draft, apiKey, profileId: id, stage: 'structure', pages: [1], text: 'HALAMAN 1\nKode | Uraian | Satuan | Volume | Harga Satuan | Jumlah Harga\nA.01 | Galian tanah | m3 | 2 | 100000 | 200000' }, signal) } finally { activityBusy(false) } }} />}
  </section>
}

function AiSource({ file, unlocked, profiles, ocrProfile, jsonProfile, setOcrProfile, setJsonProfile, call, disabled, onBusy, onAccept, onClear }: { file: File; unlocked: boolean; profiles: AiProfile[]; ocrProfile: string; jsonProfile: string; setOcrProfile: (value: string) => void; setJsonProfile: (value: string) => void; call: Call; disabled: boolean; onBusy: (value: boolean) => void; onAccept: (filename: string, rows: RabRow[]) => void; onClear: () => void }) {
  const documentRef = useRef<AiDocument | null>(null)
  const cache = useRef(new Map<number, AiDocumentPage & { ocrText?: string; profile?: string }>())
  const controller = useRef<AbortController | null>(null)
  const [count, setCount] = useState(0)
  const [range, setRange] = useState('1')
  const [previewPage, setPreviewPage] = useState(1)
  const [preview, setPreview] = useState<AiDocumentPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Memuat dokumen…')
  const [forceOcr, setForceOcr] = useState(false)
  const [text, setText] = useState('')
  const [readComplete, setReadComplete] = useState(false)
  const [items, setItems] = useState<AiItem[]>([])
  const [excluded, setExcluded] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    onBusy(true)
    void openAiDocument(file).then(async doc => {
      if (!alive) { doc.destroy(); return }
      documentRef.current = doc; setCount(doc.count)
      const first = await doc.page(1)
      if (alive) { cache.current.set(1, first); setPreview(first); setStatus('Dokumen siap. Pilih halaman dan profil API.') }
    }).catch(cause => { if (alive) { setError(cause instanceof Error ? cause.message : 'Dokumen gagal dibaca.'); setStatus('Dokumen gagal dibuka.') } }).finally(() => { if (alive) { setLoading(false); onBusy(false) } })
    return () => { alive = false; const active = controller.current; controller.current = null; active?.abort(); documentRef.current?.destroy(); documentRef.current = null; onBusy(false) }
  }, [file, onBusy])
  let selected: number[] = [], rangeError = ''
  try { if (count) selected = parseAiPages(range, count) } catch (cause) { rangeError = cause instanceof Error ? cause.message : 'Periksa halaman.' }
  async function getPage(n: number): Promise<AiDocumentPage & { ocrText?: string; profile?: string }> {
    const existing = cache.current.get(n); if (existing) return existing
    const result = await documentRef.current!.page(n)
    if (cache.current.size >= AI_LIMITS.pages + 1) cache.current.delete(cache.current.keys().next().value!)
    cache.current.set(n, result); return result
  }
  async function showPage(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > count) return
    setLoading(true); setError(''); onBusy(true)
    try { setPreview(await getPage(n)); setPreviewPage(n) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pratinjau gagal dimuat.') } finally { setLoading(false); onBusy(false) }
  }
  async function readPages() {
    setError(''); setBusy(true); onBusy(true); setReadComplete(false); setItems([]); setConfirmed(false)
    const current = new AbortController(); controller.current = current
    const parts: string[] = []
    try {
      for (const n of selected) {
        setStatus(`Membaca halaman ${n} · ${parts.length + 1}/${selected.length}`)
        const data = await getPage(n)
        if (current.signal.aborted) return
        let result = data.text
        if (forceOcr || result.trim().length < 40) {
          if (!ocrProfile) throw new Error('Pilih profil OCR untuk halaman gambar/scan.')
          if (data.ocrText && data.profile === ocrProfile) result = data.ocrText
          else { const response = await call({ stage: 'ocr', profileId: ocrProfile, image: data.image, mime: data.mime, page: n, pages: selected }, current.signal); result = response.text || ''; cache.current.set(n, { ...data, ocrText: result, profile: ocrProfile }) }
        }
        if (current.signal.aborted) return
        parts.push(`HALAMAN ${n}\n${result}`)
        const collected = parts.join('\n\n')
        if (collected.length > AI_LIMITS.text) throw new Error('Gabungan teks melebihi 120.000 karakter. Pilih lebih sedikit halaman.')
        setText(collected)
      }
      setReadComplete(true); setStatus('Teks tersedia. Periksa atau koreksi teks sebelum membentuk daftar pekerjaan.')
    } catch (cause) { if (!current.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Pembacaan gagal.'); setStatus('Pembacaan belum selesai. Hasil halaman yang sudah dibaca tetap tersedia.') } } finally { if (controller.current === current) { setBusy(false); onBusy(false) } }
  }
  async function structure() {
    setError(''); setBusy(true); onBusy(true); setStatus('Menunggu model menyusun dan memvalidasi JSON pekerjaan…')
    const current = new AbortController(); controller.current = current
    try {
      const result = await call({ stage: 'structure', profileId: jsonProfile, text, pages: selected }, current.signal)
      if (current.signal.aborted) return
      setItems(result.items || []); setExcluded([]); setPage(1); setConfirmed(false); setStatus(`${result.items?.length || 0} item terbaca. Periksa uraian dan pasangan angka sebelum pencocokan.`)
    } catch (cause) { if (!current.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Daftar pekerjaan gagal dibentuk.'); setStatus('JSON belum dapat digunakan. Periksa Aktivitas API AI.') } } finally { if (controller.current === current) { setBusy(false); onBusy(false) } }
  }
  function stop() { controller.current?.abort(); setBusy(false); onBusy(false); setStatus('Proses dibatalkan. Hasil yang sudah diterima dan aktivitas tetap tersedia.') }
  const locked = busy || loading || disabled
  const pages = Math.max(1, Math.ceil(items.length / 10))
  function changeItem(index: number, update: Partial<AiItem>) { setItems(current => current.map((item, n) => n === index ? { ...item, ...update } : item)); setConfirmed(false) }
  function accept() {
    const rows = aiItemsToRows(items, file.name, documentRef.current!.kind).map((row, index) => ({ ...row, reviewed: true, excluded: excluded.includes(index), exclusion: excluded.includes(index) ? 'Dikecualikan pengguna pada pratinjau AI.' : '', history: [...row.history, `${new Date().toISOString()}: pembacaan AI dikonfirmasi pengguna sebelum pencocokan.`] }))
    onAccept(file.name, rows)
  }
  return <div className={styles.source}>
    <div className={styles.heading}><div><h3>{file.name}</h3><p>{count || '…'} halaman · maksimal 10 halaman diproses · 1.000 item</p></div><button type="button" disabled={locked} onClick={onClear}><X size={16} aria-hidden="true" />Tutup dokumen</button></div>
    <div className={styles.progress} role="status" aria-live="polite">{(busy || loading) && <span className={base.spinner} aria-hidden="true" />}{status}{busy && <button type="button" onClick={stop}>Batalkan proses</button>}</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.sourceGrid}>
      <div className={styles.documentPreview}><div className={styles.toolbar}><label>Pratinjau halaman<input type="number" min={1} max={count || 1} value={previewPage} disabled={locked} onChange={event => setPreviewPage(Number(event.target.value))} /></label><button type="button" disabled={locked || !count} onClick={() => { void showPage(previewPage) }}>Lihat halaman</button></div>
        {/* Browser-generated document previews cannot use Next image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <a href={preview.imageUrl} target="_blank" rel="noopener noreferrer" aria-label={`Buka gambar halaman ${preview.page} dalam tab baru`}><img src={preview.imageUrl} alt={`Halaman sumber ${preview.page} dari ${file.name}`} /></a> : <p className={styles.empty}>Pratinjau halaman akan tampil di sini.</p>}
      </div>
      <div className={styles.sourceControls}>
        <h3>1. Pilih sumber pembacaan</h3>
        <label>Halaman yang diproses<input value={range} disabled={locked || readComplete} onChange={event => setRange(event.target.value)} placeholder="1-3, 5" /></label>
        {rangeError && <p className={styles.error}>{rangeError}</p>}
        <p className={styles.help}>{selected.length} halaman terpilih. PDF berteks dibaca di browser; halaman gambar/scan dikirim ke API OCR sebagai gambar JPEG.</p>
        <div className={styles.formGrid}><label>Profil OCR<select value={ocrProfile} disabled={locked || !unlocked} onChange={event => setOcrProfile(event.target.value)}><option value="">Pilih profil</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Profil Teks → JSON<select value={jsonProfile} disabled={locked || !unlocked} onChange={event => setJsonProfile(event.target.value)}><option value="">Pilih profil</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        <label className={styles.check}><input type="checkbox" checked={forceOcr} disabled={locked || readComplete} onChange={event => setForceOcr(event.target.checked)} />Gunakan OCR juga pada PDF berteks</label>
        <div className={styles.toolbar}><button type="button" className={styles.primary} disabled={locked || !unlocked || !selected.length || !jsonProfile} onClick={() => { void readPages() }}>{busy ? 'Memproses…' : readComplete ? 'Baca ulang halaman' : 'Mulai pembacaan'}</button>{readComplete && <button type="button" disabled={locked} onClick={() => { if (window.confirm('Ubah pilihan halaman dan kosongkan pratinjau pekerjaan? Aktivitas API tetap tersedia.')) { setReadComplete(false); setText(''); setItems([]); setConfirmed(false) } }}>Ubah pilihan halaman</button>}</div>
        {!unlocked && <p className={styles.help}>Buka akses pengelola untuk memulai pembacaan AI.</p>}
        <h3>2. Periksa teks hasil pembacaan</h3><label>Teks sumber<textarea rows={12} value={text} disabled={locked || !readComplete} onChange={event => { setText(event.target.value); setItems([]); setConfirmed(false) }} maxLength={AI_LIMITS.text} placeholder="Teks setiap halaman akan ditampilkan di sini." /></label>
        <p className={styles.help}>Penanda HALAMAN dipakai untuk menghubungkan item dengan sumbernya. Teks ini dikirim ke profil Teks → JSON saat Anda melanjutkan.</p>
        <button type="button" disabled={locked || !unlocked || !readComplete || !text.trim() || !jsonProfile} onClick={() => { void structure() }}>{busy ? 'Memproses…' : 'Bentuk daftar pekerjaan'}</button>
      </div>
    </div>
    {items.length > 0 && <section className={styles.items} aria-label="Pratinjau pekerjaan AI"><h3>3. Periksa {items.length} item pekerjaan</h3><p className={styles.help}>Angka kosong tetap kosong. Koreksi nilai dengan membandingkan halaman sumber; semua kemunculan tetap dipertahankan.</p>
      <ol start={(page - 1) * 10 + 1}>{items.slice((page - 1) * 10, page * 10).map((item, offset) => { const index = (page - 1) * 10 + offset; return <li key={index} data-excluded={excluded.includes(index)}><div className={styles.heading}><strong>{index + 1}. {item.name || 'Uraian belum diisi'}</strong><button type="button" disabled={locked} onClick={() => { void showPage(item.source_page) }}>Halaman {item.source_page}</button></div><p className={styles.help}>{item.unit || 'Satuan kosong'} · Volume {item.volume ?? '—'} · Harga satuan {item.price?.toLocaleString('id-ID') ?? '—'} · Jumlah {item.total?.toLocaleString('id-ID') ?? '—'}</p>{item.issues.length > 0 && <p className={styles.warning}>{item.issues.join(' · ')}</p>}
        <details><summary>Periksa atau koreksi item</summary><fieldset className={styles.editorFields} disabled={locked}><label>Uraian item {index + 1}<textarea rows={2} value={item.name} onChange={event => changeItem(index, { name: event.target.value })} /></label><div className={styles.formGrid}>{(['code', 'unit'] as const).map(field => <label key={field}>{field === 'code' ? 'Kode' : 'Satuan'} item {index + 1}<input value={item[field]} onChange={event => changeItem(index, { [field]: event.target.value })} /></label>)}</div><div className={styles.formGrid}>{(['volume', 'price', 'total'] as const).map(field => <label key={field}>{field === 'volume' ? 'Volume' : field === 'price' ? 'Harga satuan (Rupiah)' : 'Jumlah harga (Rupiah)'} item {index + 1}<input type="number" step="any" value={item[field] ?? ''} onChange={event => changeItem(index, { [field]: event.target.value === '' ? null : Number(event.target.value) })} /></label>)}</div><p className={styles.help}>Angka asli: {JSON.stringify(item.raw)}</p><label className={styles.check}><input type="checkbox" checked={excluded.includes(index)} onChange={event => { setExcluded(current => event.target.checked ? [...current, index] : current.filter(n => n !== index)); setConfirmed(false) }} />Kecualikan item ini dari pekerjaan</label></fieldset></details></li> })}</ol>
      <nav className={styles.toolbar} aria-label="Halaman pratinjau AI"><button type="button" disabled={locked || page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button><span>{page} / {pages}</span><button type="button" disabled={locked || page >= pages} onClick={() => setPage(page + 1)}>Berikutnya</button></nav>
      <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={locked} onChange={event => setConfirmed(event.target.checked)} />Saya telah memeriksa uraian, satuan, dan pasangan angka pada seluruh item.</label>
      <button type="button" className={styles.primary} disabled={locked || !confirmed || items.every((item, index) => excluded.includes(index) || !item.name.trim()) || items.some((item, index) => !excluded.includes(index) && (!item.name.trim() || [item.volume, item.price, item.total].some(n => n !== null && !Number.isFinite(n))))} onClick={accept}>Gunakan {items.length - excluded.length} item dan mulai pencocokan</button>
    </section>}
  </div>
}
