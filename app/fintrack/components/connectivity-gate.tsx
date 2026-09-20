'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowClockwise } from '@phosphor-icons/react'

type ConnectionState = 'checking' | 'online' | 'offline' | 'unavailable'
const INITIAL_CHECK_DELAY_MS = 5000
const HEALTH_TIMEOUT_MS = 12000
const MAX_RELOAD_ATTEMPTS = 3
const RETRY_STORAGE_KEY = 'fintrack-connectivity-retries'
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
  const [reloadAttempts, setReloadAttempts] = useState(0)
  const [reloadCountdown, setReloadCountdown] = useState<number | null>(null)
  const checkingRef = useRef(false)
  const statusRef = useRef<ConnectionState>('checking')
  const hasConnectedRef = useRef(false)
  const toastTimerRef = useRef<number | null>(null)
  const healthControllerRef = useRef<AbortController | null>(null)

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
    checkingRef.current = true
    if (!hasConnectedRef.current || statusRef.current !== 'online') updateStatus('checking')
    const startedAt = Date.now()
    let nextStatus: ConnectionState = navigator.onLine ? 'unavailable' : 'offline'
    const controller = new AbortController()
    healthControllerRef.current = controller
    const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
    if (navigator.onLine) {
      try {
        const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('Server unavailable')
        nextStatus = 'online'
      } catch {
        nextStatus = navigator.onLine ? 'unavailable' : 'offline'
      }
    }
    window.clearTimeout(timeout)
    const minimumDelay = hasConnectedRef.current ? 0 : INITIAL_CHECK_DELAY_MS
    const remainingDelay = minimumDelay - (Date.now() - startedAt)
    if (remainingDelay > 0) await new Promise((resolve) => window.setTimeout(resolve, remainingDelay))
    if (healthControllerRef.current !== controller) return
    healthControllerRef.current = null
    checkingRef.current = false
    updateStatus(nextStatus)
    if (nextStatus === 'online') {
      hasConnectedRef.current = true
      setHasConnected(true)
    }
  }, [updateStatus])

  const reloadPage = useCallback(() => {
    const nextAttempt = Math.min(MAX_RELOAD_ATTEMPTS, reloadAttempts + 1)
    window.sessionStorage.setItem(RETRY_STORAGE_KEY, String(nextAttempt))
    window.location.reload()
  }, [reloadAttempts])

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
      healthControllerRef.current?.abort()
      healthControllerRef.current = null
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [checkHealth, updateStatus])

  useEffect(() => {
    let interval: number | null = null
    const setup = window.setTimeout(() => {
      if (status === 'checking') {
        setReloadCountdown(null)
        return
      }
      if (status === 'online') {
        window.sessionStorage.removeItem(RETRY_STORAGE_KEY)
        setReloadAttempts(0)
        setReloadCountdown(null)
        return
      }
      const storedAttempts = Math.min(MAX_RELOAD_ATTEMPTS, Number(window.sessionStorage.getItem(RETRY_STORAGE_KEY)) || 0)
      setReloadAttempts(storedAttempts)
      if (storedAttempts >= MAX_RELOAD_ATTEMPTS) {
        setReloadCountdown(null)
        return
      }
      let seconds = (storedAttempts + 1) * 5
      setReloadCountdown(seconds)
      interval = window.setInterval(() => {
        seconds -= 1
        setReloadCountdown(seconds)
        if (seconds <= 0) {
          if (interval) window.clearInterval(interval)
          window.sessionStorage.setItem(RETRY_STORAGE_KEY, String(storedAttempts + 1))
          window.location.reload()
        }
      }, 1000)
    }, 0)
    return () => {
      window.clearTimeout(setup)
      if (interval) window.clearInterval(interval)
    }
  }, [status])

  const label = status === 'online' ? 'Terhubung' : status === 'checking' ? 'Memeriksa' : status === 'offline' ? 'Tidak ada internet' : 'Server tidak tersedia'
  const isBlocked = !hasConnected || status === 'offline' || status === 'unavailable'
  if (isBlocked) return <ConnectionContext.Provider value={status}><PwaInstallContext.Provider value={{ promptEvent: installPrompt, installed, ios }}><main className="ft-connection-gate"><div><Image src="/fintrack-icon-192.png" width={92} height={92} loading="eager" fetchPriority="high" unoptimized alt="FinTrack" /><span className="ft-connection-lamp" data-status={status} /><p>{label}</p><h1>{status === 'checking' ? 'Menyiapkan FinTrack' : status === 'offline' ? 'FinTrack belum terhubung' : 'Server FinTrack tidak merespons'}</h1><small>{status === 'checking' ? 'Memeriksa koneksi internet dan layanan data. Proses ini memerlukan sekitar 5 detik.' : reloadCountdown !== null ? `Pastikan koneksi internet stabil. Halaman akan dimuat ulang dalam ${reloadCountdown} detik.` : 'Percobaan otomatis dihentikan. Pastikan koneksi internet stabil, lalu muat ulang halaman.'}</small>{status === 'checking' ? <span className="ft-connection-progress" aria-hidden="true"><span /></span> : <><button type="button" onClick={reloadPage}><ArrowClockwise size={17} weight="bold" />Muat ulang sekarang</button><span className="ft-retry-meta">{reloadAttempts < MAX_RELOAD_ATTEMPTS ? `Percobaan otomatis ${reloadAttempts + 1} dari ${MAX_RELOAD_ATTEMPTS}` : `${MAX_RELOAD_ATTEMPTS} percobaan otomatis telah selesai`}</span></>}<em>fdlydev</em></div></main></PwaInstallContext.Provider></ConnectionContext.Provider>

  return <ConnectionContext.Provider value={status}><PwaInstallContext.Provider value={{ promptEvent: installPrompt, installed, ios }}>{children}{toast && <div className="ft-connection-toast" data-status={toast.status} role="status" aria-live="assertive"><span className="ft-connection-lamp" data-status={toast.status} /><span>{toast.label}</span></div>}</PwaInstallContext.Provider></ConnectionContext.Provider>
}
