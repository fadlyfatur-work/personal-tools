'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Calculator, DownloadSimple, FileText, Plus, Trash } from '@phosphor-icons/react'
import { activities, calculate, duration, flightRate, positions, provinces, rupiah, SOURCE, type Person, type Trip } from '@/lib/nominatif/calculate'
import styles from './nominatif.module.css'

const blankPerson = (id: string, nights = ''): Person => ({ id, name: '', nip: '', grade: 'III/a', position: 'staff', nights, hotelActual: '' })
const initialTrip: Trip = {
  rule: 'pmk2026', mode: 'estimate', year: '2026', purpose: '', originProvince: 'DKI Jakarta', destinationProvince: 'Sumatra Selatan', origin: 'Jakarta', destination: 'Palembang', start: '', end: '', activity: 'ordinary', before: false, after: false,
  transport: 'plane', ticket: '', ticketProvided: false, originTrips: '2', destinationTrips: '2', originRate: '', destinationRate: '', dailyProvided: false, hotelProvided: false, localActual: false, localCost: '', representationDuty: false,
  manual: { name: '', year: '2027', daily: '', hotel: '', representation: '0', originTransfer: '', destinationTransfer: '', localPercent: '100' },
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.check}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>
}

export default function NominatifForm() {
  const [trip, setTrip] = useState<Trip>(initialTrip)
  const [people, setPeople] = useState<Person[]>([blankPerson('first')])
  const [showErrors, setShowErrors] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const resultRef = useRef<HTMLElement>(null)
  const result = calculate(trip, people)
  const official = trip.rule === 'pmk2026'
  const meeting = ['fullboard', 'fullday', 'halfday'].includes(trip.activity)
  const flight = flightRate(trip)
  const originRate = provinces.find(p => p.name === trip.originProvince)?.transfer
  const destinationRate = provinces.find(p => p.name === trip.destinationProvince)?.transfer
  function update<K extends keyof Trip>(key: K, value: Trip[K]) { setTrip(prev => ({ ...prev, [key]: value })); setMessage('') }
  function personUpdate(id: string, key: keyof Person, value: string) { setPeople(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p)); setMessage('') }
  function dateUpdate(key: 'start' | 'end', value: string) {
    const previous = Math.max(0, duration(trip.start, trip.end) - 1)
    const next = Math.max(0, duration(key === 'start' ? value : trip.start, key === 'end' ? value : trip.end) - 1)
    setPeople(prev => prev.map(p => p.nights === '' || p.nights === String(previous) ? { ...p, nights: String(next) } : p))
    update(key, value)
  }
  function example() {
    setTrip({ ...initialTrip, purpose: 'Koordinasi pelaksanaan kegiatan', start: '2026-10-05', end: '2026-10-07' })
    setPeople([{ ...blankPerson('example', '2'), name: 'Pegawai contoh' }]); setShowErrors(false); setMessage('Contoh Jakarta–Palembang dimuat. Ganti identitas sebelum digunakan.')
  }
  async function exportExcel() {
    setShowErrors(true)
    if (result.total === null) { resultRef.current?.focus(); return }
    setExporting(true); setMessage('')
    try {
      const { createWorkbook } = await import('@/lib/nominatif/excel')
      const bytes = createWorkbook(trip, result)
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = `nominatif-${trip.year}-${trip.start}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('File Excel disiapkan untuk diunduh. Format awal memuat sheet Rincian dan Parameter.')
    } catch { setMessage('Ekspor Excel gagal. Coba unduh kembali.') } finally { setExporting(false) }
  }
  const moneyInput = (value: string, onChange: (value: string) => void, placeholder = '0') => <input type="number" min="0" max="1000000000" step="1" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  return <div className={styles.page}>
    <a href="#form" className={styles.skip}>Lewati ke formulir</a>
    <header className={styles.topbar}><Link href="/menu"><ArrowLeft size={18} aria-hidden="true" />Menu aplikasi</Link><span><Calculator size={20} aria-hidden="true" />Nominatif</span><span className={styles.topNote}>Perjalanan dinas dalam negeri</span></header>
    <main className={styles.container}>
      <div className={styles.heading}><div><h1>Rencanakan perjalanan.<br /><span>Periksa setiap rincian.</span></h1><p>Hitung biaya per pegawai sesuai aturan, lalu unduh rinciannya ke Excel.</p></div><button type="button" className={styles.secondary} onClick={example}>Isi contoh Jakarta–Palembang<ArrowRight size={18} aria-hidden="true" /></button></div>
      <div className={styles.workspace}>
        <form id="form" className={styles.form} onSubmit={e => { e.preventDefault(); setShowErrors(true); resultRef.current?.focus(); resultRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }) }} noValidate>
          <section className={styles.section} aria-labelledby="rule-title"><h2 id="rule-title">Dasar perhitungan</h2><p>Pilih sumber tarif dan tahap perhitungan.</p><div className={styles.grid}>
            <Field label="Aturan"><select value={trip.rule} onChange={e => { const rule = e.target.value as Trip['rule']; setTrip(t => ({ ...t, rule, year: rule === 'pmk2026' ? '2026' : t.manual.year, ticket: '', originRate: '', destinationRate: '' })) }}><option value="pmk2026">PMK 32 Tahun 2025 · SBM 2026</option><option value="manual">Aturan lain / tarif manual</option></select></Field>
            <Field label="Tahap"><select value={trip.mode} onChange={e => update('mode', e.target.value as Trip['mode'])}><option value="estimate">Estimasi pengajuan</option><option value="actual">Realisasi biaya</option></select></Field>
            <Field label="Tahun anggaran" hint={official ? 'Mengikuti tahun berlaku aturan.' : 'Samakan dengan tahun aturan manual.'}><input type="number" min="2000" max="2100" value={trip.year} readOnly={official} onChange={e => { const year = e.target.value; setTrip(t => ({ ...t, year, manual: { ...t.manual, year } })) }} /></Field>
          </div>
          {official ? <a className={styles.source} href={SOURCE} target="_blank" rel="noreferrer">Lihat sumber aturan di JDIH<ArrowRight size={16} aria-hidden="true" /></a> : <div className={styles.inset}><p>Tarif manual berlaku per pegawai untuk perjalanan ini. Isi sesuai aturan Anda; ketentuan khusus PMK tidak diterapkan otomatis.</p><div className={styles.grid}>
            <Field label="Nama / nomor aturan"><input value={trip.manual.name} onChange={e => update('manual', { ...trip.manual, name: e.target.value })} placeholder="Contoh: Peraturan biaya TA 2027" maxLength={200} /></Field>
            {([['daily', 'Uang harian / hari'], ['hotel', 'Batas hotel / malam'], ['representation', 'Representasi / hari'], ['originTransfer', 'Transfer asal / kali'], ['destinationTransfer', 'Transfer tujuan / kali']] as const).map(([key, label]) => <Field key={key} label={`${label} (Rp)`}>{moneyInput(trip.manual[key], value => update('manual', { ...trip.manual, [key]: value }))}</Field>)}
          </div><small>Jika pegawai memiliki hak tarif berbeda, buat perhitungan manual terpisah.</small></div>}
          <details className={styles.details}><summary>Informasi dokumen (opsional)</summary><div className={styles.grid}>{([['satker', 'Satker / instansi'], ['documentNumber', 'Nomor surat tugas / SPD'], ['budget', 'Sumber anggaran'], ['signer', 'Penandatangan (nama / NIP)']] as const).map(([key, label]) => <Field key={key} label={label}><input value={trip[key] || ''} onChange={e => update(key, e.target.value)} maxLength={200} /></Field>)}</div></details>
          </section>
          <section className={styles.section} aria-labelledby="trip-title"><h2 id="trip-title">Perjalanan</h2><p>Tujuan dan jenis kegiatan menentukan tarif yang digunakan.</p>
            <Field label="Kegiatan / tujuan penugasan"><input value={trip.purpose} onChange={e => update('purpose', e.target.value)} placeholder="Contoh: Koordinasi pelaksanaan kegiatan" maxLength={250} /></Field>
            <div className={styles.grid}>
              <Field label="Provinsi asal"><select value={trip.originProvince} onChange={e => { setTrip(t => ({ ...t, originProvince: e.target.value, origin: '', originRate: '', ticket: '' })) }}>{provinces.map(p => <option key={p.name}>{p.name}</option>)}</select></Field>
              <Field label="Provinsi tujuan"><select value={trip.destinationProvince} onChange={e => { setTrip(t => ({ ...t, destinationProvince: e.target.value, destination: '', destinationRate: '', ticket: '' })) }}>{provinces.map(p => <option key={p.name}>{p.name}</option>)}</select></Field>
              <Field label="Kota asal"><input value={trip.origin} onChange={e => { setTrip(t => ({ ...t, origin: e.target.value, ticket: '' })) }} maxLength={80} /></Field>
              <Field label="Kota tujuan"><input value={trip.destination} onChange={e => { setTrip(t => ({ ...t, destination: e.target.value, ticket: '' })) }} maxLength={80} /></Field>
              <Field label="Tanggal berangkat"><input type="date" value={trip.start} onChange={e => dateUpdate('start', e.target.value)} /></Field>
              <Field label="Tanggal pulang" hint={result.days ? `${result.days} hari, termasuk berangkat dan pulang.` : 'Pilih tanggal untuk menghitung durasi.'}><input type="date" min={trip.start || undefined} value={trip.end} onChange={e => dateUpdate('end', e.target.value)} /></Field>
              <Field label="Jenis kegiatan" hint={trip.activity === 'training' ? 'Tatap muka di luar kota, atau dalam kota lebih dari 8 jam.' : undefined}><select value={trip.activity} onChange={e => { const activity = e.target.value as Trip['activity']; setTrip(t => ({ ...t, activity, before: false, after: false, localActual: false })); if (official && activity === 'fullboard') setPeople(ps => ps.map(p => ({ ...p, nights: '0' }))) }}>{Object.entries(activities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
              <Field label="Moda transportasi"><select value={trip.transport} onChange={e => setTrip(t => ({ ...t, transport: e.target.value as Trip['transport'], ticket: '' }))}><option value="plane">Pesawat · ekonomi</option><option value="train">Kereta api</option><option value="land">Transportasi darat</option><option value="sea">Kapal / transportasi air</option></select></Field>
            </div>
            {meeting && <div className={styles.inset}><strong>Hari perjalanan di luar jadwal rapat</strong><p>Centang hanya jika diperlukan untuk transportasi atau tugas panitia. Hotel paket fullboard tidak dihitung kembali.</p><Check label="1 hari sebelum kegiatan" checked={trip.before} onChange={v => update('before', v)} /><Check label="1 hari sesudah kegiatan" checked={trip.after} onChange={v => update('after', v)} /></div>}
          </section>
          <section className={styles.section} aria-labelledby="people-title"><div className={styles.sectionHead}><div><h2 id="people-title">Pegawai</h2><p>Rincian dihitung untuk setiap orang.</p></div><button type="button" className={styles.secondary} onClick={() => setPeople(ps => [...ps, blankPerson(crypto.randomUUID(), String(trip.activity === 'fullboard' ? 0 : Math.max(0, result.days - 1)))])}><Plus size={17} aria-hidden="true" />Tambah</button></div>
            {people.map((p, i) => <fieldset className={styles.person} key={p.id}><legend>Pegawai {i + 1}</legend>{people.length > 1 && <button type="button" className={styles.remove} aria-label={`Hapus pegawai ${i + 1}`} onClick={() => setPeople(ps => ps.filter(person => person.id !== p.id))}><Trash size={18} aria-hidden="true" />Hapus</button>}<div className={styles.grid}>
              <Field label="Nama pegawai"><input value={p.name} onChange={e => personUpdate(p.id, 'name', e.target.value)} maxLength={100} autoComplete="off" /></Field>
              <Field label="NIP (opsional)"><input inputMode="numeric" value={p.nip} maxLength={18} onChange={e => personUpdate(p.id, 'nip', e.target.value)} placeholder="18 digit" /></Field>
              <Field label="Golongan / ruang"><select value={p.grade} onChange={e => personUpdate(p.id, 'grade', e.target.value)}>{['I/a','I/b','I/c','I/d','II/a','II/b','II/c','II/d','III/a','III/b','III/c','III/d','IV/a','IV/b','IV/c','IV/d','IV/e'].map(g => <option key={g}>{g}</option>)}</select></Field>
              <Field label="Tingkat jabatan"><select value={p.position} onChange={e => personUpdate(p.id, 'position', e.target.value)}>{Object.entries(positions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
              {!trip.hotelProvided && <Field label="Malam menginap yang dibayar" hint={trip.activity === 'fullboard' ? 'Hanya malam tambahan di luar paket rapat.' : 'Periksa kembali sesuai jadwal menginap.'}><input type="number" min="0" max={Math.max(0, result.days - 1)} step="1" value={p.nights} onChange={e => personUpdate(p.id, 'nights', e.target.value)} /></Field>}
              {!trip.hotelProvided && trip.mode === 'actual' && Number(p.nights) > 0 && <Field label="Biaya hotel aktual / malam (Rp)" hint="Gunakan nominal per malam sesuai bukti; tidak melebihi batas tarif.">{moneyInput(p.hotelActual, v => personUpdate(p.id, 'hotelActual', v))}</Field>}
            </div></fieldset>)}
          </section>
          <section className={styles.section} aria-labelledby="cost-title"><h2 id="cost-title">Biaya & fasilitas</h2><p>Nominal transportasi berikut berlaku per pegawai. Isi 0 kali jika transfer disediakan.</p>
            <div className={styles.checks}><Check label="Tiket / transportasi utama ditanggung pihak lain" checked={trip.ticketProvided} onChange={v => update('ticketProvided', v)} /><Check label="Penginapan seluruhnya ditanggung pihak lain" checked={trip.hotelProvided} onChange={v => update('hotelProvided', v)} /><Check label="Uang harian ditanggung pihak lain" checked={trip.dailyProvided} onChange={v => update('dailyProvided', v)} /></div>
            <div className={styles.grid}>
              {!trip.ticketProvided && <Field label={`${trip.mode === 'actual' ? 'Aktual' : 'Estimasi'} tiket / transportasi PP (Rp)`} hint={official && trip.mode === 'estimate' && trip.transport === 'plane' && flight ? `Kosongkan untuk referensi SBM: ${rupiah(flight.economy)} PP (hlm. ${flight.page}).` : 'Isi total pergi-pulang sesuai estimasi atau bukti. Tarif otomatis tidak digunakan.'}>{moneyInput(trip.ticket, v => update('ticket', v), official && trip.mode === 'estimate' && trip.transport === 'plane' && flight ? String(flight.economy) : 'Isi nominal PP')}</Field>}
              <Field label="Transfer asal (kali)" hint="Contoh: kantor → bandara dan sebaliknya = 2 kali."><input type="number" min="0" max="4" step="1" value={trip.originTrips} onChange={e => update('originTrips', e.target.value)} /></Field>
              <Field label="Transfer tujuan (kali)" hint="Contoh: bandara → hotel dan sebaliknya = 2 kali."><input type="number" min="0" max="4" step="1" value={trip.destinationTrips} onChange={e => update('destinationTrips', e.target.value)} /></Field>
              {official && Number(trip.originTrips) > 0 && <Field label="Tarif transfer asal / kali (Rp)" hint={originRate == null ? 'Tidak tercantum pada tabel; masukkan tarif dengan dasar biaya.' : `Kosongkan untuk SBM ${rupiah(originRate)}/kali.`}>{moneyInput(trip.originRate, v => update('originRate', v), originRate == null ? 'Wajib diisi' : String(originRate))}</Field>}
              {official && Number(trip.destinationTrips) > 0 && <Field label="Tarif transfer tujuan / kali (Rp)" hint={destinationRate == null ? 'Tidak tercantum pada tabel; masukkan tarif dengan dasar biaya.' : `Kosongkan untuk SBM ${rupiah(destinationRate)}/kali.`}>{moneyInput(trip.destinationRate, v => update('destinationRate', v), destinationRate == null ? 'Wajib diisi' : String(destinationRate))}</Field>}
            </div>
            <details className={styles.details}><summary>Kondisi khusus & representasi</summary><Check label="Perjalanan untuk tugas/fungsi jabatan yang berhak atas uang representasi" checked={trip.representationDuty} onChange={v => update('representationDuty', v)} />{(trip.activity === 'ordinary' || !official) && <><Check label="Beberapa lokasi dalam kabupaten/kota yang sama; transpor lokal dibayar riil" checked={trip.localActual} onChange={v => update('localActual', v)} />{trip.localActual && <div className={styles.grid}><Field label="Total transpor lokal per pegawai (Rp)" hint={official ? 'Uang harian menjadi 60% dari tarif. Pisahkan dari transfer bandara.' : 'Nominal di luar transfer bandara.'}>{moneyInput(trip.localCost, v => update('localCost', v))}</Field>{!official && <Field label="Persentase uang harian (%)"><input type="number" min="0" max="100" value={trip.manual.localPercent} onChange={e => update('manual', { ...trip.manual, localPercent: e.target.value })} /></Field>}</div>}</>}</details>
          </section>
          <div className={styles.formEnd}><p>Data hanya diproses di browser dan belum disimpan. Unduh hasil sebelum menutup halaman.</p><button type="submit" className={styles.primary}>Periksa rincian<ArrowRight size={18} aria-hidden="true" /></button></div>
        </form>
        <aside ref={resultRef} tabIndex={-1} className={styles.result} aria-labelledby="result-title"><div className={styles.resultTop}><FileText size={25} aria-hidden="true" /><span>{trip.mode === 'estimate' ? 'Estimasi pengajuan' : 'Realisasi biaya'}</span></div><h2 id="result-title">Rincian perhitungan</h2><p className={styles.route}>{trip.origin || 'Kota asal'} <ArrowRight size={16} aria-hidden="true" /> {trip.destination || 'Kota tujuan'}</p><div className={styles.total}><span>Total {people.length} pegawai{result.days > 0 ? ` · ${result.days} hari` : ''}</span><strong aria-live="polite">{result.total === null ? 'Belum lengkap' : rupiah(result.total)}</strong><small>{result.ruleName || 'Aturan manual belum diisi'}</small></div>
          {result.total === null ? <div className={styles.empty}><Calculator size={32} aria-hidden="true" /><h3>Lengkapi data perjalanan</h3><p>Isi kegiatan, tanggal, dan nama pegawai untuk melihat total yang dapat diperiksa.</p>{showErrors && <div role="alert" className={styles.errors}><strong>Perlu diperiksa</strong><ul>{result.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}</div> : <>
            <div className={styles.breakdown}>{people.map(person => <div key={person.id} className={styles.personTotal}><span>{person.name}<small>{person.grade} · {positions[person.position]}</small></span><strong>{rupiah(result.lines.filter(l => l.personId === person.id).reduce((sum, l) => sum + l.amount, 0))}</strong></div>)}</div>
            <div className={styles.tableWrap}><table><caption>Rincian biaya seluruh pegawai</caption><thead><tr><th scope="col">Komponen</th><th scope="col">Jumlah</th></tr></thead><tbody>{result.lines.map((l, i) => <tr key={i}><td><strong>{l.component}</strong><span>{people.length > 1 ? `${l.person} · ` : ''}{l.quantity} {l.unit} × {rupiah(l.rate)}</span><details><summary>Dasar biaya</summary><p>{l.note}</p></details></td><td>{rupiah(l.amount)}</td></tr>)}</tbody></table></div>
            {result.notes.map(n => <p key={n} className={styles.note}>{n}</p>)}
            <p className={styles.note}>{trip.mode === 'estimate' ? 'Ini estimasi, bukan nominal pembayaran final. Tiket dan penginapan dipertanggungjawabkan sesuai bukti.' : 'Nominal realisasi berasal dari input Anda. Verifikasi bukti dan ketentuan sebelum digunakan.'}</p>
          </>}
          <button type="button" className={styles.primary} onClick={exportExcel} disabled={exporting || result.total === null}><DownloadSimple size={20} aria-hidden="true" />{exporting ? 'Menyiapkan Excel…' : 'Unduh Excel'}</button><p className={styles.exportHint}>.xlsx · Rincian & parameter · Format awal</p>
          <p className={styles.status} role="status">{message}</p>
        </aside>
      </div>
      <footer className={styles.footer}>Nominatif<span>Perhitungan transparan, dari aturan hingga rincian.</span></footer>
    </main>
  </div>
}
