'use client'

import { useState } from 'react'
import { DownloadSimple } from '@phosphor-icons/react'
import type { AiTrace } from '@/lib/ahspRabAi'
import base from '../catalog.module.css'
import styles from './ai.module.css'

export type ActivityTrace = AiTrace & { pending?: boolean; cancelled?: boolean }
export function downloadAiLog(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function AiActivity({ traces }: { traces: ActivityTrace[] }) {
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState('request')
  const [notice, setNotice] = useState('')
  const [wrap, setWrap] = useState(true)
  const visible = traces.filter(item => filter === 'all' || filter === 'error' ? filter !== 'error' || !item.ok && !item.pending : item.stage === filter)
  async function copy(value: unknown) {
    try { await navigator.clipboard.writeText(JSON.stringify(value, null, 2)); setNotice('JSON tersalin dengan kredensial tersamarkan.') } catch { setNotice('JSON tidak dapat disalin. Gunakan Unduh log.') }
  }
  return <details className={styles.activity}>
    <summary>Aktivitas API AI <span>{traces.length} panggilan{traces.some(item => item.pending) ? ' · sedang berjalan' : ''}</span></summary>
    <p className={styles.help}>Log tersedia selama halaman ini terbuka, maksimal 30 panggilan terakhir. Kredensial dan lampiran base64 disamarkan; isi dokumen tetap dapat terlihat pada log.</p>
    <div className={styles.toolbar}>
      <label>Filter aktivitas<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua tahap</option><option value="ocr">OCR</option><option value="structure">Teks → JSON</option><option value="error">Gagal / dibatalkan</option></select></label>
      <button type="button" disabled={!traces.length} onClick={() => downloadAiLog('aktivitas-api-ai.json', traces)}><DownloadSimple size={16} aria-hidden="true" />Unduh log</button>
    </div>
    <p role="status" className={styles.help}>{notice}</p>
    {!visible.length && <p className={styles.empty}>Belum ada aktivitas pada kelompok ini. Panggilan muncul saat pembacaan, pembentukan JSON, atau uji koneksi dijalankan.</p>}
    <ol className={styles.traceList}>{visible.map(trace => <li key={trace.id}><details>
      <summary><span className={styles.traceTitle}>{trace.pending && <span className={base.spinner} aria-hidden="true" />}{trace.stage === 'ocr' ? `OCR · halaman ${trace.page}` : 'Teks → JSON'}<small>{trace.profile} · {trace.model}</small></span><span className={styles.traceStatus} data-error={!trace.ok && !trace.pending}>{trace.pending ? 'Menunggu respons' : trace.cancelled ? 'Dibatalkan' : trace.ok ? 'Selesai' : 'Gagal'}{trace.status ? ` · HTTP ${trace.status}` : ''}</span></summary>
      <div className={styles.traceMeta}><span>{new Date(trace.startedAt).toLocaleString('id-ID')}</span><span>{(trace.durationMs / 1000).toFixed(2)} detik</span></div>
      {trace.error && <p className={styles.error} role="alert">{trace.error}</p>}
      <div className={styles.toolbar} role="group" aria-label="Bagian aktivitas">{[['request', 'Request'], ['response', 'Response'], ['result', 'Hasil / validasi'], ['usage', 'Penggunaan']].map(([key, name]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>{name}</button>)}</div>
      <div className={styles.toolbar}><label className={styles.check}><input type="checkbox" checked={wrap} onChange={event => setWrap(event.target.checked)} />Bungkus baris</label><button type="button" onClick={() => { void copy(tab === 'result' ? trace.result ?? { error: trace.error || 'Belum tersedia' } : trace[tab as 'request' | 'response' | 'usage'] ?? null) }}>Salin JSON</button></div>
      <pre className={styles.json} data-wrap={wrap} tabIndex={0} aria-label={`${tab} ${trace.stage}`}>{JSON.stringify(tab === 'result' ? trace.result ?? { error: trace.error || 'Belum tersedia' } : trace[tab as 'request' | 'response' | 'usage'] ?? (trace.pending ? 'Menunggu respons server.' : 'Tidak tersedia dari penyedia.'), null, 2)}</pre>
    </details></li>)}</ol>
  </details>
}
