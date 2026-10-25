'use client'

import { cloneElement, useId, useRef, useState, useSyncExternalStore, type ReactElement } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check as CheckIcon, DownloadSimple, FileText, GearSix, Plus, Trash } from '@phosphor-icons/react'
import { activities, calculate, documentErrors, duration, flightRate, positions, provinces, rupiah, SOURCE, type Person, type Trip } from '@/lib/nominatif/calculate'
import { pickTemplate, readTemplate, templateErrors, TEMPLATE_STORAGE_KEY, type NominatifTemplate } from '@/lib/nominatif/template'
import styles from './nominatif.module.css'

const blankPerson = (id: string, nights = ''): Person => ({ id, name: '', nip: '', grade: 'III/a', position: 'staff', nights, hotelActual: '', jobTitle: '', spdNumber: '', ticket: '', advance: '', mealRate: '', mealDays: '', snackRate: '', snackDays: '', expenses: [] })
const initialTrip: Trip = {
  rule: 'pmk2026', mode: 'estimate', year: '2026', purpose: '', originProvince: 'DKI Jakarta', destinationProvince: 'Sumatra Selatan', origin: 'Jakarta', destination: 'Palembang', start: '', end: '', activity: 'ordinary', before: false, after: false,
  transport: 'plane', ticket: '', ticketProvided: false, originTrips: '2', destinationTrips: '2', originRate: '', destinationRate: '', dailyProvided: false, hotelProvided: false, localActual: false, localCost: '', representationDuty: false,
  satker: '', budget: '', documentNumber: '', documentDate: '', sptNumber: '', sptDate: '', output: '', issueCity: '', signer: '', signerNip: '', treasurer: '', treasurerNip: '', bank: '', address: '', npwp: '', fileType: '',
  manual: { name: '', year: '2026', daily: '', hotel: '', representation: '0', originTransfer: '', destinationTransfer: '', localPercent: '100' },
}
const sheets = ['DATA', 'nominatif-LS', 'nominatif-KPN', 'SPPD-Form', 'Kwitansi', 'Kartu Kendali', 'Amplop', 'Lamp-Transport']

function getSavedTemplate() {
  try { return localStorage.getItem(TEMPLATE_STORAGE_KEY) || '' } catch { return '' }
}
function subscribeTemplate(listener: () => void) {
  const sync = (event: StorageEvent) => { if (event.key === TEMPLATE_STORAGE_KEY || event.key === null) listener() }
  window.addEventListener('storage', sync)
  window.addEventListener('nominatif-template-change', listener)
  return () => { window.removeEventListener('storage', sync); window.removeEventListener('nominatif-template-change', listener) }
}
const getServerTemplate = () => ''

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactElement<{ id?: string; 'aria-describedby'?: string }> }) {
  const id = useId()
  return <div className={styles.field}><label htmlFor={id}>{label}</label>{cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.check}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /><span>{label}</span></label>
}
function Money({ value, onChange, placeholder = '0', ...a11y }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string; 'aria-describedby'?: string }) {
  return <input {...a11y} type="number" min="0" max="1000000000" step="1" inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
}

export default function NominatifForm() {
  const savedJSON = useSyncExternalStore(subscribeTemplate, getSavedTemplate, getServerTemplate)
  const savedTemplate = readTemplate(savedJSON)
  const [data, setTrip] = useState<Trip>(initialTrip)
  const trip: Trip = { ...data, ...savedTemplate }
  const [people, setPeople] = useState<Person[]>([blankPerson('first')])
  const [templateDraft, setTemplateDraft] = useState<NominatifTemplate | null>(null)
  const [showTemplateErrors, setShowTemplateErrors] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const resultRef = useRef<HTMLElement>(null)
  const formTitle = useRef<HTMLHeadingElement>(null)
  const result = calculate(trip, people)
  const docErrors = documentErrors(trip, people)
  const masterErrors = templateErrors(trip)
  const dataDocErrors = docErrors.filter(error => !masterErrors.includes(error))
  const official = trip.rule === 'pmk2026'
  const short = trip.activity === 'localShort'
  const meeting = ['fullboard', 'fullday', 'halfday'].includes(trip.activity)
  const flight = flightRate(trip)
  const originRate = provinces.find(p => p.name === trip.originProvince)?.transfer
  const destinationRate = provinces.find(p => p.name === trip.destinationProvince)?.transfer
  function update<K extends keyof Trip>(key: K, value: Trip[K]) { setTrip(prev => ({ ...prev, [key]: value })); setMessage('') }
  function personUpdate<K extends keyof Person>(id: string, key: K, value: Person[K]) { setPeople(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p)); setMessage('') }
  function focusForm() { requestAnimationFrame(() => formTitle.current?.focus()) }
  function openTemplate() { setTemplateDraft(pickTemplate(trip)); setShowTemplateErrors(false); setMessage(''); focusForm() }
  function closeTemplate() { setTemplateDraft(null); setShowTemplateErrors(false); setMessage(''); focusForm() }
  function saveTemplate() {
    if (!templateDraft) return
    setShowTemplateErrors(true)
    if (templateErrors(templateDraft).length) return
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(pickTemplate(templateDraft)))
      window.dispatchEvent(new Event('nominatif-template-change'))
      setTemplateDraft(null); setShowTemplateErrors(false); setMessage('Template tersimpan di browser ini dan akan digunakan pada nominatif berikutnya.'); focusForm()
    } catch { setMessage('Template belum tersimpan. Penyimpanan browser tidak tersedia; coba izinkan penyimpanan lalu simpan kembali.') }
  }
  function dateUpdate(key: 'start' | 'end', value: string) {
    const previous = Math.max(0, duration(trip.start, trip.end) - 1)
    const next = Math.max(0, duration(key === 'start' ? value : trip.start, key === 'end' ? value : trip.end) - 1)
    setPeople(prev => prev.map(p => p.nights === '' || p.nights === String(previous) ? { ...p, nights: String(next) } : p))
    if (short) setTrip(t => ({ ...t, start: value, end: value }))
    else update(key, value)
  }
  function example() {
    setTrip({ ...initialTrip, rule: 'manual', transport: 'land', purpose: 'Pembahasan hasil uji coba SOP pengumpulan data harga satuan sektor konstruksi', destinationProvince: 'DKI Jakarta', destination: 'Jakarta', activity: 'local', start: '2026-09-24', end: '2026-09-24', ticket: '170000', originTrips: '0', destinationTrips: '0', satker: 'Satuan kerja contoh', budget: 'KODE.ANGGARAN.CONTOH', output: 'Fasilitasi dan pembinaan jasa konstruksi', sptNumber: 'SPT/CONTOH/2026/01', sptDate: '2026-09-21', documentNumber: 'SPD/CONTOH/2026/01', documentDate: '2026-09-28', issueCity: 'Jakarta', signer: 'PPK contoh (ganti)', signerNip: '000000000000000000', treasurer: 'Bendahara contoh (ganti)', treasurerNip: '000000000000000000', manual: { ...initialTrip.manual, name: 'Tarif contoh Excel (verifikasi dasar biaya)', daily: '210000', hotel: '0', originTransfer: '0', destinationTransfer: '0' } })
    setPeople([{ ...blankPerson('example', '0'), name: 'Pegawai contoh (ganti)', nip: '000000000000000000', grade: 'III/b', jobTitle: 'Pembina Jasa Konstruksi Ahli Pertama', expenses: [{ description: 'Transportasi dalam kota DKI Jakarta', amount: '170000' }] }])
    setShowErrors(false); setShowDocuments(false); setTemplateDraft(null); setMessage('Contoh nominal Rp380.000 dimuat. Identitas contoh perlu diganti. Template yang sudah disimpan tetap digunakan.'); focusForm()
  }
  async function exportExcel() {
    setShowErrors(true); setShowDocuments(true)
    if (result.total === null) { resultRef.current?.focus(); return }
    if (masterErrors.length) { openTemplate(); setShowTemplateErrors(true); return }
    if (docErrors.length) { setTemplateDraft(null); focusForm(); setMessage('Lengkapi DATA pegawai dan surat tugas sebelum mengunduh.'); return }
    setExporting(true); setMessage('')
    try {
      const { createWorkbook } = await import('@/lib/nominatif/excel')
      const bytes = createWorkbook(trip, result)
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = `nominatif-${trip.year}-${trip.start}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(`Excel disiapkan: ${4 + people.length * 4} sheet untuk ${people.length} pegawai.`)
    } catch { setMessage('Ekspor Excel gagal. Coba unduh kembali.') } finally { setExporting(false) }
  }
  const money = (value: string, onChange: (v: string) => void, placeholder?: string) => <Money value={value} onChange={onChange} placeholder={placeholder} />
  const tripFields = (fields: readonly (readonly [keyof Trip, string])[]) => fields.map(([key, label]) => <Field key={key} label={label}><input value={String(trip[key] || '')} onChange={e => update(key, e.target.value as never)} maxLength={250} /></Field>)
  const masterFields = (fields: readonly (readonly [keyof NominatifTemplate, string])[]) => fields.map(([key, label]) => <Field key={key} label={label}><input value={templateDraft?.[key] || ''} onChange={e => setTemplateDraft(prev => prev && ({ ...prev, [key]: e.target.value }))} maxLength={250} /></Field>)

  return <div className={styles.page}>
    <a href="#form" className={styles.skip}>Lewati ke formulir</a>
    <header className={styles.topbar}><div className={styles.topInner}>
      <Link href="/" className={styles.brand} aria-label="Fdly.dev, Beranda">Fdly<span>.dev</span></Link>
      <span className={styles.topNote}>Personal Tools / Nominatif</span>
      <Link href="/menu" className={styles.menuLink}><ArrowLeft size={16} aria-hidden="true" />Menu aplikasi</Link>
    </div></header>
    <main className={styles.container}>
      <div className={styles.sectionBar}><span>Administrasi perjalanan dinas</span><span>01 / Nominatif</span></div>
      <div className={styles.heading}><div><h1>Nominatif <span>perjalanan dinas.</span></h1><p>Isi DATA perjalanan. Nominatif, SPPD, kuitansi, dan lampiran terisi otomatis.</p></div><button type="button" className={styles.secondary} onClick={example}><FileText size={18} aria-hidden="true" />Isi contoh dari Excel</button></div>
      <div className={styles.workspace}>
        <div className={styles.editor}>
          {!templateDraft && <div className={styles.templateBar}><div><strong>{trip.satker || 'Template dokumen belum diatur'}</strong><small>{savedTemplate ? 'Template tersimpan · dipakai untuk semua dokumen' : 'Atur data tetap sekali, lalu gunakan kembali.'}</small></div><button type="button" className={styles.secondary} onClick={openTemplate}><GearSix size={18} aria-hidden="true" />{savedTemplate ? 'Ubah template' : 'Atur template'}</button></div>}
          <form id="form" className={styles.form} onSubmit={e => { e.preventDefault(); if (templateDraft) saveTemplate(); else { setShowErrors(true); setShowDocuments(true); resultRef.current?.focus(); resultRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' }) } }} noValidate>
            <div className={styles.formHeading}><span>{templateDraft ? 'Data master / digunakan kembali' : 'Diisi setiap penugasan'}</span><h2 ref={formTitle} tabIndex={-1}>{templateDraft ? 'Pengaturan template' : 'DATA perjalanan'}</h2><p>{templateDraft ? 'Atur sekali. Perubahan berlaku setelah disimpan dan digunakan untuk nominatif berikutnya di browser ini.' : 'Cukup lengkapi data berikut; seluruh sheet hasil mengambil isian dari sini.'}</p></div>
            {savedJSON && !savedTemplate && <p role="alert" className={styles.errors}>Template tersimpan tidak dapat dibaca. Buka pengaturan untuk menyimpannya kembali.</p>}
            {!templateDraft && showDocuments && dataDocErrors.length > 0 && <div className={styles.errors} role="alert"><strong>Lengkapi DATA berikut</strong><ul>{dataDocErrors.map(error => <li key={error}>{error}</li>)}</ul></div>}
            {!templateDraft && <>
              <details className={styles.settingsDetails}><summary>Aturan tarif & asal perjalanan</summary><section className={styles.section} aria-labelledby="rule-title"><h3 id="rule-title">Dasar perhitungan</h3><div className={styles.grid}>
                <Field label="Aturan"><select value={trip.rule} onChange={e => { const rule = e.target.value as Trip['rule']; setTrip(t => ({ ...t, rule, year: rule === 'pmk2026' ? '2026' : t.manual.year, ticket: '', originRate: '', destinationRate: '' })) }}><option value="pmk2026">PMK 32 Tahun 2025 · SBM 2026</option><option value="manual">Aturan lain / tarif manual</option></select></Field>
                <Field label="Tahap"><select value={trip.mode} onChange={e => update('mode', e.target.value as Trip['mode'])}><option value="estimate">Estimasi pengajuan</option><option value="actual">Realisasi biaya</option></select></Field>
                <Field label="Tahun anggaran" hint={official ? 'Mengikuti tahun berlaku aturan.' : 'Samakan dengan tahun aturan manual.'}><input type="number" min="2000" max="2100" value={trip.year} readOnly={official} onChange={e => { const year = e.target.value; setTrip(t => ({ ...t, year, manual: { ...t.manual, year } })) }} /></Field>
                <Field label="Provinsi asal"><select value={trip.originProvince} onChange={e => setTrip(t => ({ ...t, originProvince: e.target.value, origin: '', originRate: '', ticket: '' }))}>{provinces.map(p => <option key={p.name}>{p.name}</option>)}</select></Field>
                <Field label="Kota asal"><input value={trip.origin} onChange={e => setTrip(t => ({ ...t, origin: e.target.value, ticket: '' }))} maxLength={80} /></Field>
              </div>
              {official ? <a className={styles.source} href={SOURCE} target="_blank" rel="noreferrer">Sumber tarif: PMK 32 Tahun 2025 (tab baru)</a> : <div className={styles.inset}><p>Isi tarif untuk perjalanan ini sesuai sumber Anda. Tarif contoh Excel tidak dianggap sebagai aturan otomatis.</p><div className={styles.grid}>
                <Field label="Nama / nomor aturan"><input value={trip.manual.name} onChange={e => update('manual', { ...trip.manual, name: e.target.value })} placeholder="Nama aturan dan tahun berlaku" maxLength={200} /></Field>
                {!short && ([['daily', 'Uang harian / hari'], ['hotel', 'Batas hotel / malam'], ['representation', 'Representasi / hari'], ['originTransfer', 'Transfer asal / kali'], ['destinationTransfer', 'Transfer tujuan / kali']] as const).map(([key, label]) => <Field key={key} label={`${label} (Rp)`}>{money(trip.manual[key], value => update('manual', { ...trip.manual, [key]: value }))}</Field>)}
              </div></div>}</section></details>
              <section className={styles.section} aria-labelledby="trip-title"><h3 id="trip-title">Penugasan & rute</h3>
                <Field label="Kegiatan / maksud perjalanan"><textarea rows={3} value={trip.purpose} onChange={e => update('purpose', e.target.value)} placeholder="Uraikan kegiatan yang tercantum pada surat tugas" maxLength={500} /></Field>
                <div className={styles.grid}>
                  <Field label="Provinsi tujuan"><select value={trip.destinationProvince} onChange={e => setTrip(t => ({ ...t, destinationProvince: e.target.value, destination: '', destinationRate: '', ticket: '' }))}>{provinces.map(p => <option key={p.name}>{p.name}</option>)}</select></Field>
                  <Field label="Kota tujuan"><input value={trip.destination} onChange={e => setTrip(t => ({ ...t, destination: e.target.value, ticket: '' }))} maxLength={80} /></Field>
                  <Field label="Tanggal berangkat"><input type="date" value={trip.start} onChange={e => dateUpdate('start', e.target.value)} /></Field>
                  <Field label="Tanggal pulang" hint={result.days ? `${result.days} hari, termasuk berangkat dan pulang.` : 'Durasi dihitung dari kedua tanggal.'}><input type="date" min={trip.start || undefined} value={trip.end} onChange={e => dateUpdate('end', e.target.value)} /></Field>
                  <Field label="Jenis kegiatan"><select value={trip.activity} onChange={e => { const activity = e.target.value as Trip['activity']; setTrip(t => ({ ...t, activity, before: false, after: false, localActual: false, ...(activity === 'localShort' ? { transport: 'land', ticket: '170000', ticketProvided: false, destinationProvince: t.originProvince, destination: t.origin, end: t.start } : {}) })); if (official && activity === 'fullboard') setPeople(ps => ps.map(p => ({ ...p, nights: '0' }))) }}>{Object.entries(activities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
                  {!short && <Field label="Moda transportasi"><select value={trip.transport} onChange={e => setTrip(t => ({ ...t, transport: e.target.value as Trip['transport'], ticket: '' }))}><option value="plane">Pesawat · ekonomi</option><option value="train">Kereta api</option><option value="land">Transportasi darat</option><option value="sea">Kapal / transportasi air</option></select></Field>}
                </div>
                {meeting && <div className={styles.inset}><strong>Hari perjalanan di luar jadwal rapat</strong><p>Hanya jika diperlukan untuk transportasi atau tugas panitia. Hotel paket fullboard tidak dihitung kembali.</p><Check label="1 hari sebelum kegiatan" checked={trip.before} onChange={v => update('before', v)} /><Check label="1 hari sesudah kegiatan" checked={trip.after} onChange={v => update('after', v)} /></div>}
              </section>
              <section className={styles.section} aria-labelledby="letter-title"><h3 id="letter-title">Surat tugas & SPD</h3><div className={styles.grid}>
                {tripFields([['sptNumber', 'Nomor SPT']])}<Field label="Tanggal SPT"><input type="date" value={trip.sptDate || ''} onChange={e => update('sptDate', e.target.value)} /></Field>
                {tripFields([['documentNumber', 'Nomor SPD']])}<Field label="Tanggal SPD"><input type="date" value={trip.documentDate || ''} onChange={e => update('documentDate', e.target.value)} /></Field>
                {tripFields([['budget', 'Kode pembebanan anggaran / MAK'], ['issueCity', 'Kota penerbitan dokumen']])}
              </div></section>
            </>}
            {!templateDraft && <section className={styles.section} aria-labelledby="people-title"><div className={styles.sectionHead}><div><h3 id="people-title">Daftar pegawai</h3><p>Satu isian untuk nominatif dan seluruh lampiran pegawai.</p></div><button type="button" className={styles.secondary} onClick={() => { setPeople(ps => [...ps, blankPerson(crypto.randomUUID(), String(trip.activity === 'fullboard' ? 0 : Math.max(0, result.days - 1)))]); setMessage('Pegawai baru ditambahkan.') }}><Plus size={17} aria-hidden="true" />Tambah pegawai</button></div>
              {people.map((p, i) => <fieldset className={styles.person} key={p.id}><legend>Pegawai {String(i + 1).padStart(2, '0')}</legend>{people.length > 1 && <button type="button" className={styles.remove} aria-label={`Hapus pegawai ${i + 1}`} onClick={() => { setPeople(ps => ps.filter(person => person.id !== p.id)); setMessage('Pegawai dihapus.') }}><Trash size={17} aria-hidden="true" />Hapus</button>}<div className={styles.grid}>
                <Field label="Nama pegawai"><input value={p.name} onChange={e => personUpdate(p.id, 'name', e.target.value)} maxLength={100} autoComplete="off" /></Field>
                <Field label="NIP" hint="18 digit; disimpan sebagai teks pada Excel."><input inputMode="numeric" value={p.nip} maxLength={18} onChange={e => personUpdate(p.id, 'nip', e.target.value)} /></Field>
                <Field label="Jabatan pada dokumen"><input value={p.jobTitle || ''} onChange={e => personUpdate(p.id, 'jobTitle', e.target.value)} maxLength={150} placeholder="Contoh: Pembina Jasa Konstruksi Ahli Pertama" /></Field>
                <Field label="Golongan / ruang"><select value={p.grade} onChange={e => personUpdate(p.id, 'grade', e.target.value)}>{['I/a','I/b','I/c','I/d','II/a','II/b','II/c','II/d','III/a','III/b','III/c','III/d','IV/a','IV/b','IV/c','IV/d','IV/e'].map(g => <option key={g}>{g}</option>)}</select></Field>
                {!short && !trip.hotelProvided && <Field label="Malam menginap yang dibayar" hint={trip.activity === 'fullboard' ? 'Hanya malam tambahan di luar paket rapat.' : 'Periksa sesuai jadwal menginap.'}><input type="number" min="0" max={Math.max(0, result.days - 1)} step="1" value={p.nights} onChange={e => personUpdate(p.id, 'nights', e.target.value)} /></Field>}
                {!short && !trip.hotelProvided && trip.mode === 'actual' && Number(p.nights) > 0 && <Field label="Biaya hotel aktual / malam (Rp)">{money(p.hotelActual, v => personUpdate(p.id, 'hotelActual', v))}</Field>}
              </div>
              <details className={styles.details}><summary>Jabatan & SPD khusus</summary><div className={styles.grid}>
                <Field label="Tingkat jabatan untuk tarif"><select value={p.position} onChange={e => personUpdate(p.id, 'position', e.target.value as Person['position'])}>{Object.entries(positions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
                <Field label="Nomor SPD khusus (opsional)" hint="Kosongkan untuk memakai nomor SPD pada DATA perjalanan."><input value={p.spdNumber || ''} onChange={e => personUpdate(p.id, 'spdNumber', e.target.value)} maxLength={100} /></Field>
                <Field label="Tingkat biaya SPD (opsional)"><input value={p.costLevel || ''} onChange={e => personUpdate(p.id, 'costLevel', e.target.value)} maxLength={50} placeholder="Sesuai penetapan pada SPD" /></Field>
              </div></details>
              <details className={styles.details}><summary>Biaya khusus, potongan & panjar</summary><div className={styles.grid}>
                {!trip.ticketProvided && <Field label="Transportasi PP khusus pegawai (Rp)" hint="Opsional. Menggantikan nominal bersama pada bagian Biaya.">{money(p.ticket || '', v => personUpdate(p.id, 'ticket', v), 'Ikuti nominal bersama')}</Field>}
                <Field label="Panjar / dibayar semula (Rp)" hint="Untuk menghitung sisa kurang/lebih pada kuitansi.">{money(p.advance || '', v => personUpdate(p.id, 'advance', v))}</Field>
                {!short && (['meal', 'snack'] as const).map(kind => <div className={styles.pair} key={kind}><Field label={`Potongan ${kind === 'meal' ? 'makan' : 'snack'} / hari (Rp)`}>{money(p[`${kind}Rate`] || '', v => personUpdate(p.id, `${kind}Rate`, v))}</Field><Field label={`Hari potongan ${kind === 'meal' ? 'makan' : 'snack'}`}><input type="number" min="0" max={result.days || 366} value={p[`${kind}Days`] || ''} onChange={e => personUpdate(p.id, `${kind}Days`, e.target.value)} /></Field></div>)}
              </div></details>
              <details className={styles.details}><summary>Lampiran transportasi tanpa bukti</summary><p className={styles.help}>Rincian ini bagian dari biaya transportasi utama pegawai, bukan tambahan biaya. Isi hanya pengeluaran yang tidak memiliki bukti; maksimal 4 baris.</p>
                {(p.expenses || []).map((expense, j) => <div className={styles.expense} key={j}><Field label={`Uraian pengeluaran ${j + 1}`}><input value={expense.description} maxLength={160} onChange={e => personUpdate(p.id, 'expenses', p.expenses!.map((item, n) => n === j ? { ...item, description: e.target.value } : item))} /></Field><Field label={`Jumlah pengeluaran ${j + 1} (Rp)`}>{money(expense.amount, amount => personUpdate(p.id, 'expenses', p.expenses!.map((item, n) => n === j ? { ...item, amount } : item)))}</Field><button type="button" className={styles.iconButton} aria-label={`Hapus pengeluaran ${j + 1} pegawai ${i + 1}`} onClick={() => personUpdate(p.id, 'expenses', p.expenses!.filter((_, n) => n !== j))}><Trash size={18} aria-hidden="true" /></button></div>)}
                {(p.expenses?.length || 0) < 4 && <button type="button" className={styles.secondary} onClick={() => personUpdate(p.id, 'expenses', [...(p.expenses || []), { description: '', amount: '' }])}><Plus size={17} aria-hidden="true" />Tambah pengeluaran</button>}
              </details>
              </fieldset>)}
            </section>}
            {!templateDraft && <>
              <section className={styles.section} aria-labelledby="cost-title"><h3 id="cost-title">Biaya perjalanan</h3><p>{short ? 'Hanya uang transport. Bawaan Rp170.000 per pegawai, dapat diubah; tanpa uang harian dan biaya lainnya.' : 'Uang harian dan hotel mengikuti tarif. Isi transportasi jika tidak memakai referensi otomatis.'}</p>
                {!trip.ticketProvided && <Field label={short ? 'Uang transport dalam kota (Rp)' : `${trip.mode === 'actual' ? 'Aktual' : 'Estimasi'} tiket / transportasi PP (Rp)`} hint={short ? 'Kosongkan untuk Rp170.000 per pegawai.' : official && trip.mode === 'estimate' && trip.transport === 'plane' && flight ? `Kosongkan untuk referensi SBM ${rupiah(flight.economy)} PP.` : 'Isi total pergi-pulang. Jika semua pegawai memakai biaya khusus, boleh kosong.'}>{money(trip.ticket, v => update('ticket', v), short ? '170000' : official && trip.mode === 'estimate' && trip.transport === 'plane' && flight ? String(flight.economy) : 'Isi nominal PP')}</Field>}
                {!short && <details className={styles.details}><summary>Fasilitas & transfer</summary>
                <div className={styles.checks}><Check label="Tiket / transportasi utama ditanggung pihak lain" checked={trip.ticketProvided} onChange={v => update('ticketProvided', v)} /><Check label="Penginapan seluruhnya ditanggung pihak lain" checked={trip.hotelProvided} onChange={v => update('hotelProvided', v)} /><Check label="Uang harian ditanggung pihak lain" checked={trip.dailyProvided} onChange={v => update('dailyProvided', v)} /></div>
                <div className={styles.grid}>
                  <Field label="Transfer asal (kali)" hint="Kantor → bandara dan sebaliknya = 2 kali. Isi 0 jika disediakan."><input type="number" min="0" max="4" step="1" value={trip.originTrips} onChange={e => update('originTrips', e.target.value)} /></Field>
                  <Field label="Transfer tujuan (kali)" hint="Bandara → hotel dan sebaliknya = 2 kali. Isi 0 jika disediakan."><input type="number" min="0" max="4" step="1" value={trip.destinationTrips} onChange={e => update('destinationTrips', e.target.value)} /></Field>
                  {official && Number(trip.originTrips) > 0 && <Field label="Tarif transfer asal / kali (Rp)" hint={originRate == null ? 'Tidak tercantum; masukkan tarif dengan dasar biaya.' : `Kosongkan untuk SBM ${rupiah(originRate)}/kali.`}>{money(trip.originRate, v => update('originRate', v), originRate == null ? 'Wajib diisi' : String(originRate))}</Field>}
                  {official && Number(trip.destinationTrips) > 0 && <Field label="Tarif transfer tujuan / kali (Rp)" hint={destinationRate == null ? 'Tidak tercantum; masukkan tarif dengan dasar biaya.' : `Kosongkan untuk SBM ${rupiah(destinationRate)}/kali.`}>{money(trip.destinationRate, v => update('destinationRate', v), destinationRate == null ? 'Wajib diisi' : String(destinationRate))}</Field>}
                </div>
                </details>}
              </section>
              {!short && <details className={styles.settingsDetails}><summary>Kondisi khusus & representasi</summary><Check label="Perjalanan untuk tugas/fungsi jabatan yang berhak atas uang representasi" checked={trip.representationDuty} onChange={v => update('representationDuty', v)} />{(trip.activity === 'ordinary' || !official) && <><Check label="Beberapa lokasi dalam kabupaten/kota yang sama; transpor lokal dibayar riil" checked={trip.localActual} onChange={v => update('localActual', v)} />{trip.localActual && <div className={styles.grid}><Field label="Total transpor lokal per pegawai (Rp)" hint={official ? 'Uang harian menjadi 60% dari tarif. Pisahkan dari transfer bandara.' : 'Nominal di luar transfer bandara dan transportasi utama.'}>{money(trip.localCost, v => update('localCost', v))}</Field>{!official && <Field label="Persentase uang harian (%)"><input type="number" min="0" max="100" value={trip.manual.localPercent} onChange={e => update('manual', { ...trip.manual, localPercent: e.target.value })} /></Field>}</div>}</>}</details>}
              <details className={styles.settingsDetails}><summary>Potongan pajak & bukti kas</summary><div className={styles.grid}>
                {tripFields([['receiptNumber', 'Nomor bukti kas (opsional)']])}
                <Field label="Potongan PPN pada kartu kendali (Rp)" hint="Sesuai hasil verifikasi pajak. Tidak mengubah rincian hak pegawai.">{money(trip.ppn || '', v => update('ppn', v))}</Field>
                <Field label="Potongan PPh pada kartu kendali (Rp)">{money(trip.pph || '', v => update('pph', v))}</Field>
              </div></details>
            </>}
            {templateDraft && <>
              {showTemplateErrors && templateErrors(templateDraft).length > 0 && <div className={styles.errors} role="alert"><strong>Lengkapi template berikut</strong><ul>{templateErrors(templateDraft).map(error => <li key={error}>{error}</li>)}</ul></div>}
              <section className={styles.section} aria-labelledby="doc-title"><h3 id="doc-title">Satuan kerja & dokumen</h3><div className={styles.grid}>{masterFields([['satker', 'Satuan kerja'], ['output', 'Output kegiatan (opsional)'], ['fileType', 'Jenis berkas (opsional)']])}</div></section>
              <section className={styles.section} aria-labelledby="sign-title"><h3 id="sign-title">Penandatangan</h3><div className={styles.grid}>{masterFields([['signer', 'Nama PPK'], ['signerNip', 'NIP PPK'], ['treasurer', 'Nama bendahara pengeluaran'], ['treasurerNip', 'NIP bendahara']])}</div></section>
              <section className={styles.section} aria-labelledby="admin-title"><h3 id="admin-title">Rekening & kartu kendali</h3><p>Opsional; akan dikosongkan jika tidak diisi.</p><div className={styles.grid}>
                <Field label="Bank, pemilik & nomor rekening"><textarea rows={3} value={templateDraft.bank} onChange={e => setTemplateDraft(prev => prev && ({ ...prev, bank: e.target.value }))} maxLength={250} placeholder="Nama bank, nama pemilik, nomor rekening" /></Field>
                <Field label="Alamat satuan kerja"><textarea rows={3} value={templateDraft.address} onChange={e => setTemplateDraft(prev => prev && ({ ...prev, address: e.target.value }))} maxLength={250} /></Field>
                {masterFields([['npwp', 'NPWP (opsional)']])}
              </div></section>
            </>}
            <div className={styles.formEnd}><span>{templateDraft ? 'Hanya data master yang disimpan. DATA perjalanan tetap terpisah.' : 'Semua sheet hasil menggunakan DATA ini dan template tersimpan.'}</span><div>{templateDraft && <button type="button" className={styles.secondary} onClick={closeTemplate}>Batal</button>}<button type="submit" className={styles.primary}>{templateDraft ? 'Simpan template' : 'Periksa DATA'}<CheckIcon size={17} aria-hidden="true" /></button></div><p className={styles.status} role="status">{message}</p></div>
          </form>
        </div>
        <aside ref={resultRef} tabIndex={-1} className={styles.result} aria-labelledby="result-title">
          <div className={styles.resultTop}><span>Ringkasan biaya</span><span>{trip.mode === 'estimate' ? 'Estimasi' : 'Realisasi'}</span></div>
          <div className={styles.resultBody}><h2 id="result-title">{trip.origin || 'Kota asal'}<ArrowRight size={22} aria-hidden="true" />{trip.destination || 'Kota tujuan'}</h2>
            <p className={styles.route}>{people.length} pegawai{result.days > 0 ? ` / ${result.days} hari` : ' / tanggal belum diisi'}</p>
            <div className={styles.total}><span>Total perjalanan</span><strong aria-live="polite">{result.total === null ? 'Belum lengkap' : rupiah(result.total)}</strong><small>{result.ruleName || 'Nama aturan belum diisi'}</small></div>
            {result.total === null ? <div className={styles.empty}><FileText size={26} aria-hidden="true" /><h3>Mulai dari data perjalanan</h3><p>Isi penugasan, tanggal, dan pegawai. Rincian biaya akan terhitung saat datanya lengkap.</p>{showErrors && <div role="alert" className={styles.errors}><strong>Perlu diperiksa</strong><ul>{result.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}<button type="button" className={styles.textButton} onClick={() => { setShowErrors(true); resultRef.current?.focus() }}>Periksa isian</button></div> : <>
              <div className={styles.breakdown}>{people.map(person => <div key={person.id} className={styles.personTotal}><span>{person.name}<small>{person.grade} · {positions[person.position]}</small></span><strong>{rupiah(result.lines.filter(l => l.personId === person.id).reduce((sum, l) => sum + l.amount, 0))}</strong></div>)}</div>
              <details className={styles.costDetail}><summary>Lihat rincian perhitungan</summary><div className={styles.tableWrap}><table><caption>Rincian biaya seluruh pegawai</caption><thead><tr><th scope="col">Komponen</th><th scope="col">Jumlah</th></tr></thead><tbody>{result.lines.filter(l => !short || l.amount !== 0).map((l, i) => <tr key={i}><td><strong>{l.component}</strong><span>{people.length > 1 ? `${l.person} · ` : ''}{l.quantity} {l.unit} × {rupiah(l.rate)}</span><details><summary>Dasar biaya</summary><p>{l.note}</p></details></td><td>{rupiah(l.amount)}</td></tr>)}</tbody></table></div>{result.notes.map(n => <p key={n} className={styles.note}>{n}</p>)}</details>
            </>}
            <details className={styles.output}><summary>{4 + people.length * 4} sheet hasil otomatis</summary><ol>{sheets.map((name, i) => <li key={name}><span>{String(i + 1).padStart(2, '0')}</span>{name}{['SPPD-Form', 'Kwitansi', 'Amplop', 'Lamp-Transport'].includes(name) && <small>per pegawai</small>}</li>)}</ol></details>
            <button type="button" className={styles.docStatus} onClick={() => { if (masterErrors.length) { openTemplate(); setShowTemplateErrors(true) } else { setTemplateDraft(null); setShowDocuments(true); setShowErrors(true); focusForm() } }}>{masterErrors.length ? 'Atur template untuk seluruh dokumen' : docErrors.length ? `${dataDocErrors.length} isian DATA perlu dilengkapi` : 'Seluruh dokumen terisi otomatis'}<ArrowRight size={16} aria-hidden="true" /></button>
            <button type="button" className={`${styles.primary} ${styles.download}`} onClick={exportExcel} disabled={exporting || result.total === null}><DownloadSimple size={20} aria-hidden="true" />{exporting ? 'Menyiapkan Excel…' : 'Unduh Excel'}</button>
            <p className={styles.exportHint}>{trip.mode === 'estimate' ? 'Estimasi pengajuan. Periksa ketentuan dan bukti sebelum pembayaran.' : 'Periksa bukti pengeluaran dan ketentuan sebelum digunakan.'} Ubah data di aplikasi lalu ekspor ulang untuk memperbarui seluruh dokumen dan terbilang.</p>
          </div>
        </aside>
      </div>
      <footer className={styles.footer}><span>Nominatif / Personal Tools</span><span>{savedTemplate ? 'Template tersimpan di browser ini. ' : ''}DATA perjalanan belum disimpan; unduh hasil sebelum meninggalkan halaman.</span></footer>
    </main>
  </div>
}
