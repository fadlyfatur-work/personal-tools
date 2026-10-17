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
  const key = JSON.stringify([...new Set(ids)].sort())
  useEffect(() => {
    const requested: string[] = JSON.parse(key)
    const missing = requested.filter(id => !(id in cache.current))
    if (!missing.length) { setLoading(false); setError(''); return }
    const controller = new AbortController()
    async function load() {
      setLoading(true); setError('')
      try {
        for (let start = 0; start < missing.length; start += 100) {
          const batch = missing.slice(start, start + 100)
          const response = await fetch('/api/ahsp/rab/components', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: batch }), signal: controller.signal })
          const body = await response.json()
          if (!response.ok || !Array.isArray(body.analyses)) throw new Error(body.error || 'Informasi MPTK belum dapat dimuat.')
          if (controller.signal.aborted) return
          for (const id of batch) cache.current[id] = body.analyses.find((a: RabUsageAnalysis) => a.item.id === id) ?? null
          setData({ ...cache.current })
        }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Informasi MPTK belum dapat dimuat.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
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
