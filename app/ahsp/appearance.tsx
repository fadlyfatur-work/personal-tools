'use client'

import { useId, useRef, useSyncExternalStore } from 'react'
import { Check, Moon, Palette, Sun } from '@phosphor-icons/react'
import styles from './swiss-red.module.css'

type Palette = 'swiss-red' | 'pastel-dreams' | 'indigo-frost'
type Mode = 'system' | 'light' | 'dark'
type Appearance = { palette: Palette; mode: Mode }
const storageKey = 'ahsp-appearance'
const defaults: Appearance = { palette: 'swiss-red', mode: 'system' }
const palettes = { 'swiss-red': 'Swiss Red', 'pastel-dreams': 'Pastel Dreams', 'indigo-frost': 'Indigo Frost' }
const serverSnapshot = JSON.stringify(defaults)
let snapshot = serverSnapshot
let initialized = false

function read(value: string | null): Appearance {
  try {
    const saved = JSON.parse(value || '{}')
    return {
      palette: ['swiss-red', 'pastel-dreams', 'indigo-frost'].includes(saved?.palette) ? saved.palette : defaults.palette,
      mode: ['system', 'light', 'dark'].includes(saved?.mode) ? saved.mode : defaults.mode,
    }
  } catch { return defaults }
}

function getSnapshot() {
  if (!initialized) {
    initialized = true
    try { snapshot = JSON.stringify(read(localStorage.getItem(storageKey))) } catch { /* Keep the default when browser storage is unavailable. */ }
  }
  return snapshot
}

function subscribe(listener: () => void) {
  const sync = (event: StorageEvent) => {
    if ((event.key === storageKey || event.key === null) && event.storageArea === localStorage) {
      snapshot = JSON.stringify(read(event.newValue))
      listener()
    }
  }
  window.addEventListener('storage', sync)
  window.addEventListener('ahsp-appearance-change', listener)
  return () => {
    window.removeEventListener('storage', sync)
    window.removeEventListener('ahsp-appearance-change', listener)
  }
}

export function useAhspAppearance() {
  const current = read(useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot))
  function change(update: Partial<Appearance>) {
    snapshot = JSON.stringify({ ...read(snapshot), ...update })
    try { localStorage.setItem(storageKey, snapshot) } catch { /* The selected appearance still works for this tab. */ }
    window.dispatchEvent(new Event('ahsp-appearance-change'))
  }
  return { ...current, change }
}

function subscribeScheme(listener: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
const getScheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export default function AppearancePicker({ appearance }: { appearance: ReturnType<typeof useAhspAppearance> }) {
  const systemDark = useSyncExternalStore(subscribeScheme, getScheme, () => false)
  const dark = appearance.mode === 'dark' || (appearance.mode === 'system' && systemDark)
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const modeLabel = dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'
  return <div className={styles.appearance} role="group" aria-label="Preferensi warna">
    <button type="button" className={styles.paletteTrigger} popoverTarget={id} aria-haspopup="dialog" aria-label={`Pilih tema: ${palettes[appearance.palette]}`} title={`Tema: ${palettes[appearance.palette]}`}>
      <Palette size={18} aria-hidden="true" /><span>{palettes[appearance.palette]}</span>
    </button>
    <button type="button" className={styles.modeToggle} aria-label={modeLabel} title={modeLabel} onClick={() => appearance.change({ mode: dark ? 'light' : 'dark' })}>
      {dark ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
    <div id={id} ref={panel} popover="auto" className={styles.appearancePanel} role="dialog" aria-label="Pilihan tema">
      <h2>Tema warna</h2>
      <div className={styles.paletteOptions}>
        {(Object.entries(palettes) as [Palette, string][]).map(([key, name]) => <button key={key} type="button" aria-pressed={appearance.palette === key} onClick={() => { appearance.change({ palette: key }); panel.current?.hidePopover() }}>
          <span className={styles.paletteSwatch} data-swatch={key} aria-hidden="true" />
          <span>{name}</span>{appearance.palette === key && <Check size={16} aria-hidden="true" />}
        </button>)}
      </div>
      <label className={styles.systemMode}><input type="checkbox" checked={appearance.mode === 'system'} onChange={event => appearance.change({ mode: event.target.checked ? 'system' : dark ? 'dark' : 'light' })} />Ikuti mode perangkat</label>
    </div>
  </div>
}
