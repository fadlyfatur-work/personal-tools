'use client'

import { useEffect, useId, useState } from 'react'
import { cachedLocations, cacheLocations, normalizeQuery } from './location-cache'
import styles from './timemark.module.css'

export default function LocationInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const query = value
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [status, setStatus] = useState('Ketik minimal 5 karakter.')
  const [active, setActive] = useState(-1)
  const listId = useId()
  const normalized = normalizeQuery(query)

  useEffect(() => {
    if (!open || disabled || normalized.length < 5 || normalized.length > 200) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      const cached = cachedLocations(normalized)
      if (cached !== undefined) {
        setResults(cached); setStatus(cached.length ? 'Hasil tersimpan di perangkat.' : 'Lokasi tidak ditemukan.'); return
      }
      setStatus('Mencari lokasi…')
      try {
        const response = await fetch(`/api/timemark/locations?q=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Pencarian gagal. Silakan isi manual.')
        if (!Array.isArray(data.results) || !data.results.every((text: unknown) => typeof text === 'string')) throw new Error('Hasil lokasi tidak dapat dibaca.')
        if (controller.signal.aborted) return
        const suggestions: string[] = data.results.slice(0, 5)
        cacheLocations(normalized, suggestions)
        setResults(suggestions); setStatus(suggestions.length ? `${suggestions.length} lokasi ditemukan.` : 'Lokasi tidak ditemukan.')
      } catch (error) {
        if (!controller.signal.aborted) { setResults([]); setStatus(error instanceof Error ? error.message : 'Pencarian gagal. Silakan isi manual.') }
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [normalized, query, open, disabled])

  function choose(index: number) {
    const selected = results[index]
    if (selected) onChange(selected)
    else if (query.trim()) onChange(query.trim())
    setOpen(false); setActive(-1)
  }

  return <div className={styles.location} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label>Lokasi<input role="combobox" aria-autocomplete="list" aria-expanded={open && !disabled} aria-controls={listId} aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} aria-describedby={`${listId}-hint`} maxLength={400} value={query} placeholder="Cari lokasi atau ketik alamat manual" disabled={disabled}
      onChange={event => { onChange(event.target.value); setResults([]); setActive(-1); setOpen(true); const length = normalizeQuery(event.target.value).length; setStatus(length < 5 ? 'Ketik minimal 5 karakter.' : length > 200 ? 'Alamat panjang dapat digunakan langsung secara manual.' : 'Menunggu selesai mengetik…') }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); setActive(-1) }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => event.key === 'ArrowDown' ? Math.min(index + 1, results.length) : Math.max(index - 1, 0)) }
        if (event.key === 'Enter' && open && active >= 0) { event.preventDefault(); choose(active) }
      }} /></label>
    {open && !disabled && <div className={styles.locationDropdown}>
      <p role="status">{status}</p>
      <ul id={listId} role="listbox" aria-label="Saran lokasi Indonesia">
        {results.map((address, index) => <li key={address} id={`${listId}-${index}`} role="option" aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>{address}</li>)}
        <li id={`${listId}-${results.length}`} role="option" aria-selected={active === results.length} className={styles.manualOption} onMouseDown={event => event.preventDefault()} onClick={() => choose(results.length)}>Isi manual{query.trim() ? `: ${query.trim()}` : ''}</li>
      </ul>
      <p className={styles.attribution}>Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></p>
    </div>}
    <p id={`${listId}-hint`} className={styles.help}>Ketik alamat manual atau cari minimal 5 karakter. Maksimal 5 saran di Indonesia.</p>
  </div>
}
