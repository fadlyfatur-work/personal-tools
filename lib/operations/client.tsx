'use client'
import { useCallback, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import { toolsRequest, useTools } from '@/lib/tools/client'
import type { Inventory } from './types'
import styles from '@/app/tools/tools.module.css'

export { styles }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.field}><span className={styles.label}>{label}</span>{children}</label> }
export function localTime(iso: string) { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
export function time(iso: string | null) { return iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB' : 'Belum diperiksa' }
export const statusNames: Record<string,string> = { planned: 'Direncanakan', in_progress: 'Berlangsung', succeeded: 'Berhasil', failed: 'Gagal', cancelled: 'Dibatalkan', healthy: 'Sehat', blocked: 'Target diblokir', maintenance: 'Pemeliharaan', paused: 'Dijeda', stale: 'Data kedaluwarsa', unknown: 'Menunggu pemeriksaan', recovering: 'Menunggu ambang pemulihan', open: 'Insiden dibuka', recovery: 'Layanan pulih' }

export function useOperations<T>(endpoint: string, refreshMs = 0) {
  const tools = useTools(), [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [attempt, setAttempt] = useState(0)
  const identity = tools.context ? `${tools.context.userId}:${tools.workspaceId}` : ''
  const latestIdentity = useRef(identity)
  useEffect(() => { latestIdentity.current = identity }, [identity])
  const [dataIdentity, setDataIdentity] = useState('')
  const refresh = useCallback(() => setAttempt(n => n + 1), [])
  useEffect(() => { if (!refreshMs || !identity) return; const timer = setInterval(refresh, refreshMs); return () => clearInterval(timer) }, [identity, refreshMs, refresh])
  const reloadTools = tools.reload
  useEffect(() => {
    if (!identity) return
    const controller = new AbortController()
    Promise.resolve().then(() => { if (!controller.signal.aborted) { setLoading(true); setError('') } })
    toolsRequest<T>(endpoint, { headers: { 'x-tools-workspace': tools.workspaceId }, signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setData(value); setDataIdentity(identity) } }).catch(err => { if (!controller.signal.aborted) { setError(err.message); if (err.status === 401 || err.status === 403) { setData(null); reloadTools() } } }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint, identity, tools.workspaceId, attempt, reloadTools])
  async function write(value: unknown, target = endpoint) {
    if (saving) return false
    setSaving(true); setError(''); setNotice('')
    try {
      await toolsRequest(target, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-tools-workspace': tools.workspaceId }, body: JSON.stringify(value) })
      if (latestIdentity.current === identity) { setNotice('Catatan tersimpan.'); refresh() }
      return latestIdentity.current === identity
    } catch (err) {
      if (latestIdentity.current === identity) { setError(err instanceof Error ? err.message : 'Belum dapat menyimpan.'); if ((err as {status?:number}).status === 401 || (err as {status?:number}).status === 403) { setData(null); tools.reload() } }
      return false
    } finally { setSaving(false) }
  }
  return { tools, data: dataIdentity === identity ? data : null, identity, error, notice, loading, saving, refresh, write, writable: tools.context?.role !== 'viewer' }
}

export function InventoryForms({ data, save, saving }: { data: Inventory; save: (value: unknown, target?: string) => Promise<boolean>; saving: boolean }) {
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault()
    const form = event.currentTarget, fields = new FormData(form)
    if (await save({ action, ...Object.fromEntries(fields) }, '/api/deployments')) form.reset()
  }
  return <details className={styles.panel}><summary>Kelola layanan dan environment</summary><div className={styles.grid}>
    <form onSubmit={e => submit(e,'service')}><h3>Tambah layanan</h3><Field label="Nama layanan"><input className={styles.input} name="name" required maxLength={120}/></Field><button className={styles.secondary} disabled={saving}>Tambah layanan</button></form>
    <form onSubmit={e => submit(e,'environment')}><h3>Tambah environment</h3><Field label="Layanan"><select className={styles.input} name="service_id" required defaultValue=""><option value="">Pilih layanan</option>{data.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Nama environment"><input className={styles.input} name="name" required maxLength={80}/></Field><button className={styles.secondary} disabled={saving || !data.services.length}>Tambah environment</button></form>
  </div><p className={styles.muted}>Inventaris dipakai bersama oleh Change Tracker dan Monitoring.</p></details>
}
export function PairFields({ data, service, setService, environment, setEnvironment }: { data: Inventory; service: string; setService: (s: string) => void; environment: string; setEnvironment: (s: string) => void }) {
  return <div className={styles.grid}><Field label="Layanan"><select className={styles.input} required value={service} onChange={e => { setService(e.target.value); setEnvironment('') }}><option value="">Pilih layanan</option>{data.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Environment"><select className={styles.input} required value={environment} onChange={e => setEnvironment(e.target.value)}><option value="">Pilih environment</option>{data.environments.filter(e => e.service_id === service).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field></div>
}
