'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from '@phosphor-icons/react'
import { aiPreset, aiProfileSchema, renderAiTemplate, type AiConfig, type AiJson, type AiProfile } from '@/lib/ahspRabAi'
import base from '../catalog.module.css'
import styles from './ai.module.css'

export default function AiSettings({ access, unlocked, profiles, reload, close, runSample }: { access: string; unlocked: boolean; profiles: AiProfile[]; reload: () => Promise<void>; close: () => void; runSample: (draft: AiConfig, apiKey: string, id?: string, signal?: AbortSignal) => Promise<void> }) {
  const modal = useRef<HTMLDialogElement>(null)
  const sampleController = useRef<AbortController | null>(null)
  const [config, setConfig] = useState<AiConfig>(() => aiPreset('chat'))
  const [id, setId] = useState<string>()
  const [key, setKey] = useState('')
  const [preset, setPreset] = useState<'chat' | 'gemini' | 'claude'>('chat')
  const [stage, setStage] = useState<'ocr' | 'structure'>('ocr')
  const [headers, setHeaders] = useState(JSON.stringify(config.headers, null, 2))
  const [bodies, setBodies] = useState({ ocr: JSON.stringify(config.ocr.body, null, 2), structure: JSON.stringify(config.structure.body, null, 2) })
  const [mapping, setMapping] = useState('{}')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<AiJson | null>(null)
  useEffect(() => { const dialog = modal.current; dialog?.showModal(); return () => { sampleController.current?.abort(); dialog?.close() } }, [])
  function load(value: AiConfig, profileId?: string) {
    setConfig(value); setId(profileId); setKey(''); setHeaders(JSON.stringify(value.headers, null, 2)); setBodies({ ocr: JSON.stringify(value.ocr.body, null, 2), structure: JSON.stringify(value.structure.body, null, 2) }); setMapping(JSON.stringify(value.fieldMap, null, 2)); setPreview(null); setError(''); setNotice('')
  }
  function parsed() {
    let name = 'Headers'
    try {
      const h = JSON.parse(headers); name = 'Body OCR'; const ocr = JSON.parse(bodies.ocr); name = 'Body Teks → JSON'; const structure = JSON.parse(bodies.structure); name = 'Pemetaan field'; const fieldMap = JSON.parse(mapping)
      const result = aiProfileSchema.safeParse({ ...config, headers: h, ocr: { ...config.ocr, body: ocr }, structure: { ...config.structure, body: structure }, fieldMap })
      if (!result.success) throw new Error('Lengkapi nama profil, URL, model, prompt, dan format pemetaan.')
      return result.data
    } catch (cause) { throw new Error(cause instanceof SyntaxError ? `${name} bukan JSON yang valid.` : cause instanceof Error ? cause.message : 'Periksa JSON profil.') }
  }
  async function save() {
    setError(''); setNotice('')
    try {
      const draft = parsed(); setBusy(true)
      const response = await fetch('/api/ahsp/rab/ai/profiles', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ahsp-ai-access': access }, body: JSON.stringify({ id, config: draft, apiKey: key || undefined }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Profil gagal disimpan.')
      setId(result.id); setKey(''); await reload(); setNotice('Profil disimpan ke database. API key tersamarkan setelah disimpan.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profil gagal disimpan.') } finally { setBusy(false) }
  }
  async function remove() {
    if (!id || !window.confirm('Hapus profil API ini dari database? Hasil rekonsiliasi tetap tersedia.')) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/ahsp/rab/ai/profiles', { method: 'DELETE', headers: { 'content-type': 'application/json', 'x-ahsp-ai-access': access }, body: JSON.stringify({ id }) })
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Profil gagal dihapus.')
      await reload(); load(aiPreset(preset)); setNotice('Profil dihapus.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Profil gagal dihapus.') } finally { setBusy(false) }
  }
  function showPreview() {
    setError('')
    try {
      const draft = parsed(), value = renderAiTemplate(draft[stage].body as AiJson, { model: draft.model, prompt: draft[stage].prompt, api_key: '[RAHASIA]', page: 1, pages: [1], ocr_text: 'HALAMAN 1\nA.01 | Galian tanah | m3 | 2 | 100000 | 200000', image_mime: 'image/jpeg', image_base64: '[LAMPIRAN]', image_data_url: '[LAMPIRAN image/jpeg]' })
      setPreview({ url: draft.endpoint.replaceAll('{{model}}', encodeURIComponent(draft.model)), headers: renderAiTemplate(draft.headers, { api_key: '[RAHASIA]', model: draft.model }), body: value })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pratinjau tidak dapat dibuat.') }
  }
  async function sample() {
    setError(''); setNotice(''); setBusy(true); setTesting(true)
    const controller = new AbortController(); sampleController.current = controller
    try { await runSample(parsed(), key, id, controller.signal); setNotice('Permintaan contoh selesai. Tutup panel ini untuk melihat Request, Response, dan validasinya pada Aktivitas API AI.') } catch (cause) { if (controller.signal.aborted) setNotice('Panggilan dibatalkan. Aktivitas tetap tersedia untuk diperiksa.'); else setError(cause instanceof Error ? cause.message : 'Uji koneksi gagal. Lihat Aktivitas API AI.') } finally { setBusy(false); setTesting(false); sampleController.current = null }
  }
  return <dialog ref={modal} className={styles.settings} aria-labelledby="ai-settings-title" onCancel={event => { if (busy) event.preventDefault(); else close() }}>
    <header className={styles.dialogHeader}><div><h2 id="ai-settings-title">Pengaturan API AI</h2><p>Profil dan template tersimpan di database. Kunci akses pengelola berlaku pada tab ini.</p></div><button type="button" aria-label="Tutup pengaturan API AI" disabled={busy} onClick={close}><X size={20} aria-hidden="true" /></button></header>
    <div className={styles.dialogBody}>
      {!unlocked && <p className={styles.error}>Buka akses pengelola di halaman RAB untuk menyimpan profil atau memanggil API. Template tetap dapat diperiksa di sini.</p>}
      <div className={styles.toolbar}><label>Profil tersimpan<select value={id || ''} disabled={busy} onChange={event => { const item = profiles.find(item => item.id === event.target.value); load(item || aiPreset(preset), item?.id) }}><option value="">Profil baru</option>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · default' : ''}</option>)}</select></label><label>Template awal<select value={preset} disabled={busy} onChange={event => setPreset(event.target.value as typeof preset)}><option value="chat">Chat Completions / kompatibel</option><option value="gemini">Gemini</option><option value="claude">Claude</option></select></label><button type="button" disabled={busy} onClick={() => { if (window.confirm('Ganti isi editor dengan template awal? Perubahan yang belum disimpan akan diganti.')) load({ ...aiPreset(preset), name: config.name, model: config.model }, id) }}>Muat template</button></div>
      <fieldset className={styles.editorFields} disabled={busy}><legend className={styles.srOnly}>Konfigurasi profil</legend>
        <div className={styles.formGrid}><label>Nama profil<input value={config.name} maxLength={100} onChange={event => setConfig({ ...config, name: event.target.value })} placeholder="Contoh: OCR utama" /></label><label>Model<input value={config.model} maxLength={160} onChange={event => setConfig({ ...config, model: event.target.value })} placeholder="Nama model dari penyedia" /></label></div>
        <label>URL endpoint<input value={config.endpoint} maxLength={2048} onChange={event => setConfig({ ...config, endpoint: event.target.value })} /></label><p className={styles.help}>POST JSON ke HTTPS publik, port 443; respons sinkron JSON. URL boleh memakai {'{{model}}'}. Redirect dan alamat jaringan privat dibatasi.</p>
        <label>API key {id ? '(kosongkan untuk mempertahankan key tersimpan)' : ''}<input type="password" autoComplete="new-password" value={key} onChange={event => setKey(event.target.value)} placeholder={id ? '•••••••• · key tersimpan' : 'Masukkan API key'} /></label>
        <label>Headers JSON<textarea aria-label="Headers JSON" className={styles.codeEditor} spellCheck={false} rows={4} maxLength={20000} value={headers} onChange={event => setHeaders(event.target.value)} /></label>
        <p className={styles.help}>Gunakan {'{{api_key}}'} untuk kredensial. Variabel lain: {'{{model}}, {{prompt}}, {{page}}, {{pages}}, {{ocr_text}}, {{image_mime}}, {{image_base64}}, {{image_data_url}}'}. Objek/array harus memakai placeholder sebagai nilai utuh.</p>
        <div className={styles.toolbar} role="group" aria-label="Tahap konfigurasi">{(['ocr', 'structure'] as const).map(key => <button key={key} type="button" aria-pressed={stage === key} onClick={() => setStage(key)}>{key === 'ocr' ? 'OCR gambar → teks' : 'Teks → JSON pekerjaan'}</button>)}</div>
        <label>Prompt {stage === 'ocr' ? 'OCR' : 'Teks ke JSON'}<textarea aria-label={stage === 'ocr' ? 'Prompt OCR' : 'Prompt Teks ke JSON'} rows={5} maxLength={16000} value={config[stage].prompt} onChange={event => setConfig({ ...config, [stage]: { ...config[stage], prompt: event.target.value } })} /></label>
        <label>Body JSON {stage === 'ocr' ? 'OCR' : 'Teks ke JSON'}<textarea aria-label={stage === 'ocr' ? 'Body JSON OCR' : 'Body JSON Teks ke JSON'} className={styles.codeEditor} rows={12} spellCheck={false} maxLength={100000} value={bodies[stage]} onChange={event => setBodies({ ...bodies, [stage]: event.target.value })} /></label>
        <label>Jalur hasil dalam respons API<input value={config[stage].responsePath} onChange={event => setConfig({ ...config, [stage]: { ...config[stage], responsePath: event.target.value } })} placeholder="Contoh: choices[0].message.content" /></label>
        {stage === 'structure' && <><label>Jalur daftar pekerjaan dalam hasil JSON<input value={config.itemsPath} onChange={event => setConfig({ ...config, itemsPath: event.target.value })} placeholder="items" /></label><label>Pemetaan field JSON<textarea aria-label="Pemetaan field JSON" className={styles.codeEditor} rows={4} maxLength={10000} value={mapping} spellCheck={false} onChange={event => setMapping(event.target.value)} /></label><p className={styles.help}>Contoh: {'{"name":"description","volume":"quantity","source_page":"page"}'}. Kosongkan {'{}'} jika respons mengikuti struktur standar. Field standar: code, name, unit, volume, price, total, source_page, raw, issues.</p></>}
        <label className={styles.check}><input type="checkbox" checked={config.isDefault} onChange={event => setConfig({ ...config, isDefault: event.target.checked })} />Jadikan profil default</label>
      </fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.help} role="status">{notice}</p>
      <div className={styles.toolbar}><button type="button" disabled={busy} onClick={showPreview}>Pratinjau request</button><button type="button" disabled={!unlocked || busy} onClick={() => { void sample() }}>Uji koneksi dengan teks contoh</button>{id && <button type="button" disabled={!unlocked || busy} onClick={() => { void remove() }}>Hapus profil</button>}</div>
      {preview !== null && <pre className={styles.json} data-wrap="true" tabIndex={0} aria-label="Pratinjau request AI">{JSON.stringify(preview, null, 2)}</pre>}
    </div>
    <footer className={styles.dialogFooter}><span role="status">{busy && <><span className={base.spinner} aria-hidden="true" />Memproses…</>}</span>{testing && <button type="button" onClick={() => sampleController.current?.abort()}>Batalkan panggilan</button>}<button type="button" disabled={busy} onClick={close}>Tutup</button><button type="button" className={styles.primary} disabled={!unlocked || busy} onClick={() => { void save() }}>Simpan profil</button></footer>
  </dialog>
}
