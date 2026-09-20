'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

type ConnectionState = 'checking' | 'online' | 'offline' | 'unavailable'
const ConnectionContext = createContext<ConnectionState>('checking')
export interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const PwaInstallContext = createContext<{ promptEvent: InstallPromptEvent | null; installed: boolean; ios: boolean }>({ promptEvent: null, installed: false, ios: false })

export function useConnectivity() {
  return useContext(ConnectionContext)
}

export function usePwaInstall() {
  return useContext(PwaInstallContext)
}

export function ConnectivityGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionState>('checking')
  const [hasConnected, setHasConnected] = useState(false)
  const [toast, setToast] = useState<{ status: ConnectionState; label: string } | null>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  const checkingRef = useRef(false)
  const statusRef = useRef<ConnectionState>('checking')
  const hasConnectedRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)

  const updateStatus = useCallback((next: ConnectionState) => {
    const previous = statusRef.current
    statusRef.current = next
    setStatus(next)
    if (!hasConnectedRef.current || previous === next) return
    const label = next === 'online' ? 'Koneksi kembali terhubung' : next === 'checking' ? 'Memeriksa kembali koneksi' : next === 'offline' ? 'Koneksi internet terputus' : 'Server FinTrack tidak merespons'
    setToast({ status: next, label })
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  const checkHealth = useCallback(async () => {
    if (checkingRef.current) return
    if (!navigator.onLine) { updateStatus('offline'); return }
    checkingRef.current = true
    if (!hasConnectedRef.current || statusRef.current !== 'online') updateStatus('checking')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('Server unavailable')
      updateStatus('online')
      hasConnectedRef.current = true
      setHasConnected(true)
    } catch {
      updateStatus(navigator.onLine ? 'unavailable' : 'offline')
    } finally {
      checkingRef.current = false
      window.clearTimeout(timeout)
    }
  }, [updateStatus])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/fintrack-sw.js', { scope: '/fintrack', updateViaCache: 'none' }).then((registration) => registration.update()).catch(() => undefined)
    }
    const online = () => { void checkHealth() }
    const offline = () => updateStatus('offline')
    const visible = () => { if (document.visibilityState === 'visible') void checkHealth() }
    const requestState = (event: Event) => {
      const next = (event as CustomEvent<ConnectionState>).detail
      if (next === 'online') { updateStatus('online'); hasConnectedRef.current = true; setHasConnected(true) }
      if (next === 'offline' || next === 'unavailable') updateStatus(next)
    }
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent) }
    const appInstalled = () => { setInstalled(true); setInstallPrompt(null) }
    const detectInstallState = window.setTimeout(() => {
      setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    }, 0)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('fintrack:connection', requestState)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void checkHealth() }, 60000)
    const initialCheck = window.setTimeout(() => { void checkHealth() }, 0)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.removeEventListener('fintrack:connection', requestState)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', appInstalled)
      window.clearInterval(interval)
      window.clearTimeout(initialCheck)
      window.clearTimeout(detectInstallState)
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [checkHealth, updateStatus])

  const label = status === 'online' ? 'Terhubung' : status === 'checking' ? 'Memeriksa' : status === 'offline' ? 'Tidak ada internet' : 'Server tidak tersedia'
  if (!hasConnected) return <ConnectionContext.Provider value={status}><PwaInstallContext.Provider value={{ promptEvent: installPrompt, installed, ios }}><main className="ft-connection-gate"><div><Image src="/fintrack-icon-192.png" width={92} height={92} loading="eager" fetchPriority="high" unoptimized alt="FinTrack" /><span className="ft-connection-lamp" data-status={status} /><p>{label}</p><h1>{status === 'checking' ? 'Menyiapkan FinTrack' : 'FinTrack belum dapat dibuka'}</h1><small>{status === 'offline' ? 'Hubungkan perangkat ke internet untuk melanjutkan.' : status === 'unavailable' ? 'Internet tersedia, tetapi server belum merespons.' : 'Memeriksa koneksi internet dan layanan data.'}</small>{status !== 'checking' && <button type="button" onClick={checkHealth}>Coba lagi</button>}<em>fdlydev</em></div></main></PwaInstallContext.Provider></ConnectionContext.Provider>

  return <ConnectionContext.Provider value={status}><PwaInstallContext.Provider value={{ promptEvent: installPrompt, installed, ios }}>{children}{toast && <div className="ft-connection-toast" data-status={toast.status} role="status" aria-live="assertive"><span className="ft-connection-lamp" data-status={toast.status} /><span>{toast.label}</span></div>}</PwaInstallContext.Provider></ConnectionContext.Provider>
}
