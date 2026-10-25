'use client'

import { useSyncExternalStore } from 'react'
import { createDemoState, parseStoredState, STORAGE_KEY, type PosState } from './model'

type Snapshot = { state: PosState | null; ready: boolean; error: string; persisted: boolean; readOnly: boolean }
const serverSnapshot: Snapshot = { state: null, ready: false, error: '', persisted: false, readOnly: true }
let snapshot = serverSnapshot
let lastRaw: string | null = null
let memoryOnly = false
let releaseWriter: (() => void) | undefined
let acquiring = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

function initialize() {
  if (snapshot.ready) return
  let state = createDemoState()
  let error = ''
  try {
    lastRaw = localStorage.getItem(STORAGE_KEY)
    if (lastRaw) state = parseStoredState(lastRaw)
  } catch (cause) {
    error = cause instanceof Error && cause.message.startsWith('Data POS') ? cause.message : 'Penyimpanan browser tidak tersedia. Perubahan hanya berlaku selama halaman ini dibuka.'
    memoryOnly = true
  }
  snapshot = { state, ready: true, error, persisted: !!lastRaw && !memoryOnly, readOnly: true }
  emit()
}

function readLatest() {
  initialize()
  if (memoryOnly) return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== lastRaw) {
      const state = raw ? parseStoredState(raw) : createDemoState()
      lastRaw = raw
      snapshot = { ...snapshot, state, ready: true, error: '', persisted: !!raw }
      emit()
    }
  } catch (cause) {
    memoryOnly = true
    snapshot = { ...snapshot, persisted: false, error: cause instanceof Error ? cause.message : 'Penyimpanan browser tidak dapat dibaca. Perubahan hanya berlaku pada halaman ini.' }
    emit()
  }
}

function save(state: PosState) {
  let error = snapshot.error
  let persisted = false
  if (!memoryOnly) {
    try {
      const raw = JSON.stringify(state)
      localStorage.setItem(STORAGE_KEY, raw)
      lastRaw = raw
      persisted = true
      error = ''
    } catch {
      memoryOnly = true
      error = 'Penyimpanan browser penuh atau diblokir. Perubahan hanya berlaku selama halaman ini dibuka; data tersimpan sebelumnya tetap tersedia setelah refresh.'
    }
  }
  snapshot = { ...snapshot, state, ready: true, error, persisted }
  emit()
}

export function activatePosTab() {
  if (releaseWriter || acquiring) return
  if (!navigator.locks?.request) {
    memoryOnly = true
    snapshot = { ...snapshot, readOnly: false, persisted: false, error: 'Browser ini tidak mendukung penguncian antartab. Demo tetap dapat dicoba pada sesi sementara; data tersimpan sebelumnya tidak ditimpa.' }
    emit()
    return
  }
  acquiring = true
  void navigator.locks.request(STORAGE_KEY, { ifAvailable: true }, async lock => {
    acquiring = false
    if (!listeners.size) return
    if (!lock) {
      snapshot = { ...snapshot, readOnly: true, error: 'Demo sedang aktif di tab lain. Tab ini hanya membaca data agar transaksi tidak saling menimpa. Tutup tab penulis lalu aktifkan tab ini.' }
      emit()
      return
    }
    snapshot = { ...snapshot, readOnly: false, error: memoryOnly ? snapshot.error : '' }
    readLatest()
    if (!snapshot.persisted && !memoryOnly) save(snapshot.state!)
    else emit()
    await new Promise<void>(resolve => { releaseWriter = resolve })
    releaseWriter = undefined
    if (listeners.size) queueMicrotask(activatePosTab)
  }).catch(() => {
    acquiring = false
    memoryOnly = true
    snapshot = { ...snapshot, readOnly: false, persisted: false, error: 'Penyimpanan antartab tidak tersedia. Perubahan hanya berlaku selama halaman ini dibuka.' }
    emit()
  })
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) readLatest()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', activatePosTab)
    initialize()
    activatePosTab()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', activatePosTab)
      queueMicrotask(() => {
        if (!listeners.size) {
          snapshot = { ...snapshot, readOnly: true }
          releaseWriter?.()
        }
      })
    }
  }
}

export function usePosStore() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot)
}

export function updatePos(change: (state: PosState) => PosState): PosState {
  readLatest()
  if (snapshot.readOnly) throw Error('Demo sedang aktif di tab lain. Tutup tab penulis lalu aktifkan tab ini.')
  const current = snapshot.state!
  const next = change(current)
  if (next !== current) save(next)
  return next
}

export function resetPos() {
  if (snapshot.readOnly) throw Error('Demo sedang aktif di tab lain.')
  memoryOnly = false
  save(createDemoState())
}
