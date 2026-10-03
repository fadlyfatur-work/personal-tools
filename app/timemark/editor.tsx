'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ImageSquare, UploadSimple, DownloadSimple, ArrowCounterClockwise } from '@phosphor-icons/react'
import { dimensions, draw, type Settings } from './render'
import styles from './timemark.module.css'
import LocationInput from './location-input'

const defaults: Settings = { date: '', time: '', address: '', id: '', language: 'id-ID', scale: 100, x: 0, y: 100, logoSize: 10, logoX: 0, logoY: 0, accent: '#ffc800', text: '#ffffff', opacity: 95, vertical: true, hour12: false }
const cacheKey = 'timemark-settings-v1'

async function readImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Gunakan foto JPG, PNG, atau WebP.')
  if (file.size > 30 * 1024 * 1024) throw new Error('Ukuran file maksimal 30 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image(); image.src = url; await image.decode()
    if (image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Foto maksimal 40 megapiksel. Perkecil foto terlebih dahulu.')
    return image
  } finally { URL.revokeObjectURL(url) }
}

export default function Editor() {
  const [settings, setSettings] = useState(defaults)
  const [ready, setReady] = useState(false)
  const [dark, setDark] = useState(false)
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [name, setName] = useState('foto')
  const [rotation, setRotation] = useState(0)
  const [original, setOriginal] = useState(true)
  const [reviewed, setReviewed] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cacheMessage, setCacheMessage] = useState('Pengaturan tersimpan di perangkat ini.')
  const [format, setFormat] = useState('image/jpeg')
  const canvas = useRef<HTMLCanvasElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)
  const uploadVersion = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
    const now = new Date()
    let preferredDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    try {
      const savedTheme = localStorage.getItem('timemark-theme')
      if (savedTheme === 'dark' || savedTheme === 'light') preferredDark = savedTheme === 'dark'
    } catch { /* System preference still works when storage is unavailable. */ }
    setDark(preferredDark)
    let initial = { ...defaults, date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, id: crypto.randomUUID() }
    try {
      const saved = JSON.parse(localStorage.getItem(cacheKey) || '{}')
      for (const key of Object.keys(defaults) as (keyof Settings)[]) {
        if (typeof saved[key] === typeof defaults[key]) initial = { ...initial, [key]: saved[key] }
      }
    } catch { setCacheMessage('Cache tidak tersedia. Editor tetap bisa digunakan.') }
    setSettings(initial); setReady(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(cacheKey, JSON.stringify(settings)) }
      catch { setCacheMessage('Pengaturan tidak dapat disimpan di browser ini.') }
    }, 250)
    return () => clearTimeout(timer)
  }, [settings, ready])

  useEffect(() => {
    if (!photo || !canvas.current) return
    const frame = requestAnimationFrame(() => {
      if (canvas.current) draw(canvas.current, photo, logo, rotation, settings, original, 1600)
    })
    return () => cancelAnimationFrame(frame)
  }, [photo, logo, rotation, settings, original])

  function update<K extends keyof Settings>(key: K, value: Settings[K]) { setSettings(current => ({ ...current, [key]: value })) }

  function toggleTheme() {
    const next = !dark
    setDark(next)
    try { localStorage.setItem('timemark-theme', next ? 'dark' : 'light') }
    catch { setCacheMessage('Tema berubah, tetapi tidak dapat disimpan di browser ini.') }
  }

  async function upload(file: File | undefined, isLogo = false) {
    if (!file) return
    const version = ++uploadVersion.current
    setBusy(true); setError('')
    try {
      const image = await readImage(file)
      if (version !== uploadVersion.current) return
      if (isLogo) setLogo(image)
      else { setPhoto(image); setName(file.name.replace(/\.[^.]+$/, '')); setRotation(0); setOriginal(true); setReviewed(false); setZoom(false); update('id', crypto.randomUUID()) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Foto tidak dapat dibuka.') }
    finally { if (version === uploadVersion.current) setBusy(false) }
  }

  async function download() {
    if (!photo) return
    setBusy(true); setError('')
    try {
      await new Promise(resolve => setTimeout(resolve, 0))
      const output = document.createElement('canvas')
      draw(output, photo, logo, rotation, settings)
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, format, .95))
      if (!blob) throw new Error('Ekspor gagal. Coba foto dengan ukuran lebih kecil.')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${name}-timemark.${format === 'image/png' ? 'png' : 'jpg'}`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      output.width = 0; output.height = 0
    } catch (e) { setError(e instanceof Error ? e.message : 'Foto gagal diekspor.') }
    finally { setBusy(false) }
  }

  function range(label: string, key: 'scale' | 'x' | 'y' | 'logoSize' | 'logoX' | 'logoY' | 'opacity', min = 0, max = 100) {
    return <label className={styles.range}>{label}<output>{settings[key]}%</output><input type="range" min={min} max={max} value={settings[key]} onChange={e => update(key, Number(e.target.value))} /></label>
  }
  const size = photo ? dimensions(photo, rotation) : null

  return <main className={styles.app} data-theme={dark ? 'dark' : 'light'}>
    <header className={styles.header}><div><Link href="/menu">Personal Tools</Link><span className={styles.divider}>/</span><strong>Timemark</strong></div><div className={styles.headerActions}><span className={styles.local}>Foto diproses di perangkatmu</span><button disabled={!ready} aria-pressed={dark} onClick={toggleTheme}>Mode gelap</button></div></header>
    <div className={styles.heading}><h1>Informasi lengkap. Dalam satu foto.</h1><p>Review foto, tambahkan cap, lalu unduh hasilnya.</p></div>
    <input ref={photoInput} className={styles.hidden} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Unggah foto" onChange={e => { void upload(e.target.files?.[0]); e.target.value = '' }} />
    <input ref={logoInput} className={styles.hidden} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Unggah logo" onChange={e => { void upload(e.target.files?.[0], true); e.target.value = '' }} />
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.workspace}>
      <aside className={styles.controls}>
        <section><h2><span>1</span> Foto sumber</h2><button className={styles.upload} disabled={busy || !ready} onClick={() => photoInput.current?.click()}><UploadSimple size={20} />{photo ? 'Ganti foto' : 'Pilih foto'}</button><p className={styles.help}>{photo ? name : 'JPG, PNG, WebP · Maks. 30 MB / 40 MP'}</p></section>
        <fieldset disabled={!reviewed || busy}><legend><span>2</span> Informasi foto</legend>
          <div className={styles.row}><label>Tanggal<input type="date" value={settings.date} onChange={e => update('date', e.target.value)} /></label><label>Jam<input type="time" value={settings.time} onChange={e => update('time', e.target.value)} /></label></div>
          <LocationInput value={settings.address} onChange={value => update('address', value)} disabled={!reviewed || busy} />
          <label>ID foto<input maxLength={64} value={settings.id} onChange={e => update('id', e.target.value)} /></label><div className={styles.idActions}><button className={styles.textButton} onClick={() => update('id', Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join(''))}>Buat ID pendek</button><button className={styles.textButton} onClick={() => update('id', crypto.randomUUID())}>Buat UUID baru</button></div>
          <div className={styles.row}><label>Bahasa tanggal<select value={settings.language} onChange={e => update('language', e.target.value)}><option value="id-ID">Indonesia</option><option value="en-US">English</option></select></label><label>Format jam<select value={String(settings.hour12)} onChange={e => update('hour12', e.target.value === 'true')}><option value="false">24 jam</option><option value="true">12 jam</option></select></label></div>
          <div className={styles.logoRow}><button onClick={() => logoInput.current?.click()}>{logo ? 'Ganti logo' : 'Unggah logo'}</button>{logo && <button onClick={() => setLogo(null)}>Hapus logo</button>}</div>
          <details><summary>Atur tampilan dan posisi</summary>
            {range('Ukuran cap', 'scale', 50, 130)}{range('Posisi horizontal cap', 'x')}{range('Posisi vertikal cap', 'y')}{range('Latar jam', 'opacity')}
            {logo && <>{range('Ukuran logo', 'logoSize', 4, 30)}{range('Posisi horizontal logo', 'logoX')}{range('Posisi vertikal logo', 'logoY')}</>}
            <div className={styles.row}><label>Warna aksen<input type="color" value={settings.accent} onChange={e => update('accent', e.target.value)} /></label><label>Warna teks<input type="color" value={settings.text} onChange={e => update('text', e.target.value)} /></label></div>
            <label className={styles.check}><input type="checkbox" checked={settings.vertical} onChange={e => update('vertical', e.target.checked)} />Kode vertikal di sisi kanan</label>
          </details>
        </fieldset>
        <p className={styles.help}>{cacheMessage} Foto dan logo tidak disimpan setelah halaman ditutup.</p>
      </aside>
      <section className={styles.preview} aria-label="Pratinjau foto">
        <div className={styles.toolbar}><div><button aria-pressed={original} disabled={!photo} onClick={() => setOriginal(true)}>Foto asli</button><button aria-pressed={!original} disabled={!reviewed} onClick={() => setOriginal(false)}>Dengan cap</button></div><div><button disabled={!photo || busy} onClick={() => setRotation(r => (r + 90) % 360)} aria-label="Putar foto 90 derajat"><ArrowCounterClockwise size={18} />Putar</button><button disabled={!photo} aria-pressed={zoom} onClick={() => setZoom(v => !v)}>{zoom ? 'Pas layar' : 'Perbesar'}</button></div></div>
        <div className={`${styles.stage} ${zoom ? styles.zoom : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void upload(e.dataTransfer.files[0]) }}>
          {photo ? <canvas ref={canvas} aria-label={original ? 'Foto asli sebelum diberi cap' : 'Hasil foto dengan cap informasi'} /> : <div className={styles.empty}><ImageSquare size={64} weight="thin" /><h2>Mulai dari fotomu</h2><p>Tarik foto ke sini, atau pilih dari perangkat.<br />Kamu bisa mereview foto sebelum memberi cap.</p><button className={styles.primary} disabled={busy || !ready} onClick={() => photoInput.current?.click()}>Pilih foto</button></div>}
        </div>
        <div className={styles.caption}><span>{size ? `${size[0]} × ${size[1]} px · ${size[0] > size[1] ? 'Landscape' : 'Portrait'}` : 'Pratinjau foto'}{busy ? ' · Memproses…' : ''}</span><span>Tanpa pemotongan</span></div>
        {photo && !reviewed ? <div className={styles.export}><p>Sudah sesuai? Lanjutkan untuk mengisi informasi.</p><button className={styles.primary} disabled={busy} onClick={() => { setReviewed(true); setOriginal(false) }}>Gunakan foto ini</button></div> : <div className={styles.export}><p>Informasi waktu dan lokasi diisi manual.</p><div><select aria-label="Format unduhan" value={format} onChange={e => setFormat(e.target.value)}><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select><button className={styles.primary} disabled={!reviewed || busy || !settings.date || !settings.time || !settings.id.trim()} onClick={() => void download()}><DownloadSimple size={19} />{busy ? 'Memproses…' : 'Unduh foto'}</button></div></div>}
      </section>
    </div>
  </main>
}
