'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react'

export type ConnectionState = 'checking' | 'online' | 'offline' | 'unavailable'
type ConnectivityValue = { status: ConnectionState; countdown: number | null }
const INITIAL_CHECK_DELAY_MS = 5000
const HEALTH_TIMEOUT_MS = 12000
const IDLE_AFTER_MS = 60000
const IDLE_CHECK_INTERVAL_MS = 3 * 60 * 1000
const ACTIVE_CHECK_INTERVAL_MS = 5 * 60 * 1000
const RETRY_INTERVAL_SECONDS = 5
const ConnectionContext = createContext<ConnectivityValue>({ status: 'checking', countdown: null })
export interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const PwaInstallContext = createContext<{ promptEvent: InstallPromptEvent | null; installed: boolean; ios: boolean }>({ promptEvent: null, installed: false, ios: false })

export function useConnectivity() { return useContext(ConnectionContext) }
export function usePwaInstall() { return useContext(PwaInstallContext) }

export function ConnectivityGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionState>('checking')
  const [hasConnected, setHasConnected] = useState(false)
  const [actionsBlocked, setActionsBlocked] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [toast, setToast] = useState<{ status: ConnectionState; label: string } | null>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [ios, setIos] = useState(false)
  const checkingRef = useRef(false)
  const statusRef = useRef<ConnectionState>('checking')
  const hasConnectedRef = useRef(false)
  const lastActivityRef = useRef(0)
  const lastCheckRef = useRef(0)
  const toastTimerRef = useRef<number | null>(null)
  const healthControllerRef = useRef<AbortController | null>(null)

  const updateStatus = useCallback((next: ConnectionState) => {
    const previous = statusRef.current
    statusRef.current = next
    setStatus(next)
    if (next === 'online') setActionsBlocked(false)
    if (next === 'offline' || next === 'unavailable') setActionsBlocked(true)
    setCountdown(next === 'offline' || next === 'unavailable' ? RETRY_INTERVAL_SECONDS : null)
    if (!hasConnectedRef.current || previous === next) return
    const label = next === 'online' ? 'Koneksi kembali terhubung' : next === 'checking' ? 'Memeriksa kembali koneksi' : next === 'offline' ? 'Koneksi internet terputus' : 'Server FinTrack tidak merespons'
    setToast({ status: next, label })
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  const checkHealth = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    updateStatus('checking')
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
    lastCheckRef.current = Date.now()
    updateStatus(nextStatus)
    if (nextStatus === 'online') {
      hasConnectedRef.current = true
      setHasConnected(true)
    }
  }, [updateStatus])

  useEffect(() => {
    lastActivityRef.current = Date.now()
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/fintrack-sw.js', { scope: '/fintrack', updateViaCache: 'none' }).then((registration) => registration.update()).catch(() => undefined)
    const recordActivity = () => { lastActivityRef.current = Date.now() }
    const online = () => { void checkHealth() }
    const offline = () => updateStatus('offline')
    const visible = () => {
      if (document.visibilityState !== 'visible') return
      const idle = Date.now() - lastActivityRef.current >= IDLE_AFTER_MS
      const interval = idle ? IDLE_CHECK_INTERVAL_MS : ACTIVE_CHECK_INTERVAL_MS
      if (Date.now() - lastCheckRef.current >= interval) void checkHealth()
    }
    const requestState = (event: Event) => {
      const next = (event as CustomEvent<ConnectionState>).detail
      if (next === 'online') { updateStatus('online'); hasConnectedRef.current = true; setHasConnected(true) }
      if (next === 'offline' || next === 'unavailable') updateStatus(next)
    }
    const verifyConnection = () => { void checkHealth() }
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent) }
    const appInstalled = () => { setInstalled(true); setInstallPrompt(null) }
    const detectInstallState = window.setTimeout(() => {
      setInstalled(window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    }, 0)
    const monitor = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || statusRef.current !== 'online') return
      const idle = Date.now() - lastActivityRef.current >= IDLE_AFTER_MS
      const interval = idle ? IDLE_CHECK_INTERVAL_MS : ACTIVE_CHECK_INTERVAL_MS
      if (Date.now() - lastCheckRef.current >= interval) void checkHealth()
    }, 15000)
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll']
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }))
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    window.addEventListener('fintrack:connection', requestState)
    window.addEventListener('fintrack:verify-connection', verifyConnection)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)
    const initialCheck = window.setTimeout(() => { void checkHealth() }, 0)
    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity))
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      window.removeEventListener('fintrack:connection', requestState)
      window.removeEventListener('fintrack:verify-connection', verifyConnection)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', appInstalled)
      window.clearInterval(monitor)
      window.clearTimeout(initialCheck)
      window.clearTimeout(detectInstallState)
      healthControllerRef.current?.abort()
      healthControllerRef.current = null
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    }
  }, [checkHealth, updateStatus])

  useEffect(() => {
    if (status === 'online' || status === 'checking') return
    let seconds = RETRY_INTERVAL_SECONDS
    const interval = window.setInterval(() => {
      seconds -= 1
      if (seconds <= 0) {
        window.clearInterval(interval)
        setCountdown(null)
        void checkHealth()
        return
      }
      setCountdown(seconds)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [checkHealth, status])

  const contextValue = { status, countdown }
  const label = status === 'online' ? 'Terhubung' : status === 'checking' ? 'Memeriksa' : status === 'offline' ? 'Tidak ada internet' : 'Server tidak tersedia'
  if (!hasConnected) return <ConnectionContext.Provider value={contextValue}><PwaInstallContext.Provider value={{ promptEvent: installPrompt, installed, ios }}><main className="ft-connection-gate"><div><span className="ft-connection-lamp" data-status={status} /><p>{label}</p><h1>{status === 'checking' ? 'Menyiapkan FinTrack' : status === 'offline' ? 'FinTrack belum terhubung' : 'Server FinTrack tidak merespons'}</h1><small>{status === 'checking' ? 'Memeriksa koneksi internet dan layanan data.' : `Pastikan koneksi internet stabil. Pemeriksaan berikutnya dalam ${countdown ?? RETRY_INTERVAL_SECONDS} detik.`}</small>{status === 'checking' ? <span className="ft-connection-progress" aria-hidden="true"><span /></span> : <button type="button" onClick={() => void checkHealth()}><ArrowClockwise size={17} weight="bold" />Periksa kembali</button>}<em>fdlydev</em></div></main></PwaInstallContext.Provider></ConnectionContext.Provider>

  return <ConnectionContext.Provider value={contextValue}><PwaInstallContext.Provider value={{ promptEvent: installPrompt, installed, ios }}><div className="ft-connected-content" data-connection={status} data-actions-blocked={actionsBlocked} onClickCapture={(event) => { if (actionsBlocked && (event.target as Element).closest('button')) { event.preventDefault(); event.stopPropagation() } }} onSubmitCapture={(event) => { if (actionsBlocked) event.preventDefault() }}>{children}</div>{toast && <div className="ft-connection-toast" data-status={toast.status} role="status" aria-live="assertive"><span className="ft-connection-lamp" data-status={toast.status} /><span>{toast.label}</span></div>}</PwaInstallContext.Provider></ConnectionContext.Provider>
}
