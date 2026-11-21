'use client'

import { useEffect, useRef, useState } from 'react'
import { rabUsageResourceKey, type RabUsageAnalysis } from '@/lib/ahspRabUsage'
import { mptkGroups, type MptkGroup } from '@/lib/ahspMptk'
import type { RabCandidate } from '@/lib/ahspRab'
import base from '../catalog.module.css'
import styles from './reconciliation.module.css'

export function useRabComponents(ids: string[]) {
  const [data, setData] = useState<Record<string, RabUsageAnalysis | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const cache = useRef<Record<string, RabUsageAnalysis | null>>({})
  const inFlight = useRef(new Map<string, Promise<void>>())
  const mounted = useRef(false)
  const key = JSON.stringify([...new Set(ids)].sort())
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    const requested: string[] = JSON.parse(key)
    let active = true
    setData(current => ({ ...current, ...cache.current }))
    const missing = requested.filter(id => !(id in cache.current))
    if (!missing.length) { setLoading(false); setError(''); return }
    setLoading(true); setError('')
    for (let start = 0; start < missing.length; start += 100) {
      const batch = missing.slice(start, start + 100).filter(id => !inFlight.current.has(id))
      if (!batch.length) continue
      const task = (async () => {
        const response = await fetch('/api/ahsp/rab/components', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: batch }) })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body.analyses)) throw new Error(body.error || 'Informasi MPTK belum dapat dimuat.')
        for (const id of batch) cache.current[id] = body.analyses.find((a: RabUsageAnalysis) => a.item.id === id) ?? null
        if (mounted.current) setData({ ...cache.current })
      })()
      for (const id of batch) inFlight.current.set(id, task)
      void task.then(() => {
        for (const id of batch) if (inFlight.current.get(id) === task) inFlight.current.delete(id)
      }, () => {
        for (const id of batch) if (inFlight.current.get(id) === task) inFlight.current.delete(id)
      })
    }
    const pending = missing.map(id => inFlight.current.get(id)).filter((task): task is Promise<void> => !!task)
    void Promise.all(pending).then(() => {
      if (active && mounted.current) { setData({ ...cache.current }); setError(''); setLoading(false) }
    }).catch(error => {
      if (active && mounted.current) { setError(error instanceof Error ? error.message : 'Informasi MPTK belum dapat dimuat.'); setLoading(false) }
    })
    return () => { active = false }
  }, [key, revision])
  return { data, loading, error, reload: () => { for (const id of JSON.parse(key)) delete cache.current[id]; setRevision(n => n + 1) } }
}

export default function ItemComponents({ item, data, loading, error, reload, compact = false }: {
  item: RabCandidate; data?: RabUsageAnalysis | null; loading: boolean; error: string; reload: () => void; compact?: boolean;
}) {
  const groups = (Object.entries(mptkGroups) as [MptkGroup, string][]).map(([group, name]) => ({ group, name, components: [...new Map((data?.components.filter(c => c.group === group) ?? []).map(c => [rabUsageResourceKey(c, data), c])).values()] })).filter(group => group.components.length)
  if (loading && !data) return <p className={base.loadingIndicator} role="status"><span className={base.spinner} aria-hidden="true" />Memuat informasi MPTK…</p>
  if (error && !data) return <p className={styles.help} role="alert">{error} <button type="button" onClick={reload}>Muat ulang informasi MPTK</button></p>
  return <div className={compact ? styles.componentSummary : styles.componentInfo}>
    {!compact && <><h3>Informasi komponen MPTK</h3><p>{item.code || 'Tanpa kode'} · {item.name} · {item.regulation}</p></>}
    {groups.length ? <div className={styles.componentBadges} role="group" aria-label={`Jenis komponen ${item.code || item.name}`}>{groups.map(g => <span className={styles.componentBadge} key={g.group}>{g.name} ({g.components.length})</span>)}</div> : <small>{data?.note || 'Rincian MPTK belum tersedia untuk item ini.'}</small>}
    {!compact && groups.length > 0 && <><div className={styles.componentList} tabIndex={0} role="region" aria-label="Daftar komponen MPTK">{groups.map(g => <section key={g.group}><h4>{g.name}</h4><ul>{g.components.map((c, index) => <li key={index}>{c.name} · {c.unit}{c.code && ` · ${c.code}`}</li>)}</ul></section>)}</div>{data?.note && <p className={styles.help}>{data.note}</p>}</>}
  </div>
}
