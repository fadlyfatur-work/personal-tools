'use client'

import { useSyncExternalStore } from 'react'

export type PosTheme = 'system' | 'light' | 'dark'
const key = 'personal-tools-pos-theme-v1'
const serverSnapshot = { preference: 'system' as PosTheme, error: '' }
let snapshot = serverSnapshot
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

function refresh() {
  try {
    const saved = localStorage.getItem(key)
    snapshot = { preference: saved === 'light' || saved === 'dark' ? saved : 'system', error: '' }
  } catch { /* Keep the current session preference when browser storage is unavailable. */ }
  emit()
}
function onStorage(event: StorageEvent) { if (event.key === key || event.key === null) refresh() }
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) { window.addEventListener('storage', onStorage); refresh() }
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener('storage', onStorage) }
}
export function usePosTheme() { return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot) }
export function setPosTheme(preference: PosTheme) {
  let error = ''
  try { localStorage.setItem(key, preference) }
  catch { error = 'Pilihan tema hanya berlaku selama halaman ini dibuka karena penyimpanan browser tidak tersedia.' }
  snapshot = { preference, error }
  emit()
}
