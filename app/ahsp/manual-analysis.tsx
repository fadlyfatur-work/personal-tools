'use client'

import { useRef, useState } from 'react'
import { calculateAhsp, parseAhspNumber, type AhspComponent, type AhspItem } from '@/lib/ahsp'
import styles from './catalog.module.css'

type ManualRow = { id: string; group: 'tenaga' | 'bahan' | 'alat'; name: string; unit: string; coefficient: string; price: string }
const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 })

export default function ManualAnalysis({ item }: { item: AhspItem }) {
  const [rows, setRows] = useState<ManualRow[]>(() => item.components.filter(c => c.group !== 'smkk').map(c => ({ id: c.id, group: c.group as ManualRow['group'], name: c.name, unit: c.unit, coefficient: c.coefficient === null ? '' : String(c.coefficient), price: '' })))
  const sequence = useRef(1)
  const [basis, setBasis] = useState(String(item.output_quantity))
  const [volume, setVolume] = useState('1')
  const [overhead, setOverhead] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const update = (id: string, key: keyof ManualRow, value: string) => { setConfirmed(false); setRows(rs => rs.map(r => r.id === id ? { ...r, [key]: value } : r)) }
  const complete = confirmed && rows.length > 0 && rows.every(r => r.name.trim() && r.unit.trim())
  const components: AhspComponent[] = rows.map(row => ({ id: row.id, group: row.group, name: row.name, unit: row.unit, code: '', coefficient: parseAhspNumber(row.coefficient), expression: '', sourceLine: 'Input simulasi manual pengguna.' }))
  const result = calculateAhsp({ ...item, analysis_status: complete ? 'extracted' : 'needs_review', components, output_quantity: parseAhspNumber(basis) ?? 0 }, {
    volume: parseAhspNumber(volume), overhead: parseAhspNumber(overhead),
    prices: Object.fromEntries(rows.map(r => [r.id, parseAhspNumber(r.price)])),
    coefficients: {},
  })
  return <details className={styles.manual}>
    <summary>Simulasi manual dari lampiran</summary>
    <p className={styles.help}>Gunakan seluruh komponen, satuan, koefisien, dan basis volume pada halaman sumber. Hasil bagian ini merupakan simulasi berdasarkan isian Anda.</p>
    <div className={styles.calculatorInputs}>
      <label>Basis volume analisis ({item.unit})<input inputMode="decimal" value={basis} onChange={e => { setBasis(e.target.value); setConfirmed(false) }} /></label>
      <label>Volume pekerjaan ({item.unit})<input inputMode="decimal" value={volume} onChange={e => setVolume(e.target.value)} /></label>
      <label>Biaya umum dan keuntungan (%)<input inputMode="decimal" value={overhead} onChange={e => setOverhead(e.target.value)} /></label>
    </div>
    <div className={styles.manualRows}>{rows.map((row, index) => <fieldset key={row.id} className={styles.manualRow}>
      <legend>Komponen {index + 1}</legend>
      <label>Jenis<select value={row.group} onChange={e => update(row.id, 'group', e.target.value)}><option value="tenaga">Tenaga kerja</option><option value="bahan">Bahan</option><option value="alat">Peralatan</option></select></label>
      <label className={styles.manualName}>Nama komponen<input value={row.name} onChange={e => update(row.id, 'name', e.target.value)} maxLength={240} /></label>
      <label>Satuan<input value={row.unit} onChange={e => update(row.id, 'unit', e.target.value)} maxLength={40} /></label>
      <label>Koefisien<input inputMode="decimal" value={row.coefficient} onChange={e => update(row.id, 'coefficient', e.target.value)} /></label>
      <label>Harga dasar (Rp)<input inputMode="decimal" value={row.price} onChange={e => update(row.id, 'price', e.target.value)} /></label>
      <button type="button" onClick={() => { setRows(rs => rs.filter(r => r.id !== row.id)); setConfirmed(false) }} aria-label={`Hapus komponen ${index + 1}`}>Hapus</button>
    </fieldset>)}</div>
    <button type="button" onClick={() => { setRows(rs => [...rs, { id: `manual-${sequence.current++}`, group: 'bahan', name: '', unit: '', coefficient: '', price: '' }]); setConfirmed(false) }}>Tambah komponen</button>
    <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Komponen, satuan, dan basis volume sudah saya cocokkan dengan lampiran.</label>
    <div className={styles.result} aria-live="polite"><h3>Hasil simulasi manual</h3><dl><div><dt>Harga satuan per {item.unit}</dt><dd>{result.unitPrice === null ? 'Belum dihitung' : currency.format(result.unitPrice)}</dd></div><div className={styles.total}><dt>Total × volume</dt><dd>{result.total === null ? 'Belum dihitung' : currency.format(result.total)}</dd></div></dl>
      {result.errors.length > 0 && <p>{complete ? 'Lengkapi koefisien, harga dasar, volume, dan persentase sesuai lampiran.' : 'Lengkapi seluruh komponen dan konfirmasi kecocokannya dengan lampiran.'}</p>}
    </div>
  </details>
}
