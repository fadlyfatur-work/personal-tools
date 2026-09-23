'use client'

import { useSyncExternalStore } from 'react'
import { projects } from './data'

const keys = { order: 'ff_portfolio_project_order_v1', favorites: 'ff_portfolio_bookmarks_v1' }
const ids = projects.map(project => project.id)
const serverSnapshot = { order: ids, favorites: [] as string[], ready: false, error: '' }
let snapshot = serverSnapshot
const listeners = new Set<() => void>()

function readIds(key: string) {
  const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && ids.includes(id)))]
    : []
}

function refresh() {
  let order = ids
  let favorites: string[] = []
  let error = ''
  try {
    const saved = readIds(keys.order)
    order = [...saved, ...ids.filter(id => !saved.includes(id))]
  } catch { error = 'Votre ordre' /* replaced below with the actionable localized message */ }
  try { favorites = readIds(keys.favorites) }
  catch { error = 'favorites' }
  snapshot = { order, favorites, ready: true, error: error ? 'Certaines préférences' : '' }
  if (error) snapshot.error = 'Preferensi tersimpan tidak dapat dibaca. Anda tetap bisa mengatur proyek.'
  listeners.forEach(listener => listener())
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === keys.order || event.key === keys.favorites) refresh()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage)
    refresh()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) window.removeEventListener('storage', onStorage)
  }
}

export function useProjectPreferences() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot)
}

export function saveProjectPreference(kind: 'order' | 'favorites', value: string[]) {
  let persisted = true
  try { localStorage.setItem(keys[kind], JSON.stringify(value)) }
  catch { persisted = false }
  snapshot = { ...snapshot, [kind]: value, error: persisted ? '' : 'Penyimpanan browser tidak tersedia. Perubahan hanya berlaku selama halaman ini dibuka.' }
  listeners.forEach(listener => listener())
  return persisted
}
