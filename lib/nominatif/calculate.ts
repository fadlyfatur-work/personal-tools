import rates from './pmk-32-2025.json'

export const provinces = rates.provinces
export const SOURCE = 'https://jdih.kemenkeu.go.id/dok/pmk-32-tahun-2025'
export const activities = { ordinary: 'Dinas biasa (luar kota)', local: 'Dalam kota lebih dari 8 jam', training: 'Diklat tatap muka', fullboard: 'Rapat fullboard', fullday: 'Rapat fullday', halfday: 'Rapat halfday' }
export const positions = { staff: 'Staf / pegawai', echelon4: 'Eselon IV', echelon3: 'Eselon III', echelon2: 'Eselon II', echelon1: 'Eselon I', state: 'Pejabat negara / wakil menteri', otherState: 'Pejabat negara lainnya' }
export type Activity = keyof typeof activities
export type Position = keyof typeof positions
export type Person = { id: string; name: string; nip: string; grade: string; position: Position; nights: string; hotelActual: string }
export type ManualRates = { name: string; year: string; daily: string; hotel: string; representation: string; originTransfer: string; destinationTransfer: string; localPercent: string }
export type Trip = {
  satker?: string; documentNumber?: string; budget?: string; signer?: string;
  rule: 'pmk2026' | 'manual'; mode: 'estimate' | 'actual'; year: string; purpose: string;
  originProvince: string; destinationProvince: string; origin: string; destination: string;
  start: string; end: string; activity: Activity; before: boolean; after: boolean;
  transport: 'plane' | 'train' | 'land' | 'sea'; ticket: string; ticketProvided: boolean;
  originTrips: string; destinationTrips: string; originRate: string; destinationRate: string;
  dailyProvided: boolean; hotelProvided: boolean; localActual: boolean; localCost: string;
  representationDuty: boolean; manual: ManualRates;
}
export type Line = { personId: string; person: string; nip: string; grade: string; position: string; component: string; quantity: number; unit: string; rate: number; amount: number; note: string }
export const rupiah = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
export function duration(start: string, end: string) {
  const parse = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().slice(0, 10) === s ? Date.parse(s) : NaN
  if (!start || !end) return 0
  try { return Math.max(0, (parse(end) - parse(start)) / 86400000 + 1) || 0 } catch { return 0 }
}
const city = (s: string) => s.trim().toLowerCase().replace(/^kota\s+/, '')
export function flightRate(trip: Trip) {
  // Only use a printed route in its printed direction; unmatched routes require an estimate.
  return rates.flights.find(f => city(f.from) === city(trip.origin) && city(f.to) === city(trip.destination))
}
export function hotelTier(person: Person) {
  if (person.position === 'state' || person.position === 'echelon1') return 0
  if (person.position === 'otherState' || person.position === 'echelon2') return 1
  if (person.position === 'echelon3' || person.grade.startsWith('IV/')) return 2
  return 3
}
export function calculate(trip: Trip, people: Person[]) {
  const errors: string[] = [], lines: Line[] = [], notes: string[] = []
  const days = duration(trip.start, trip.end), official = trip.rule === 'pmk2026'
  const origin = provinces.find(p => p.name === trip.originProvince)
  const destination = provinces.find(p => p.name === trip.destinationProvince)
  const ruleName = official ? 'PMK 32 Tahun 2025 · SBM TA 2026' : trip.manual.name.trim()
  const number = (value: string, label: string, max = 1_000_000_000) => {
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) { errors.push(`${label}: isi bilangan bulat 0–${max.toLocaleString('id-ID')}.`); return 0 }
    return Number(value)
  }
  if (!days || days > 366) errors.push('Tanggal perjalanan harus valid, berurutan, dan maksimal 366 hari.')
  if (!/^\d{4}$/.test(trip.year) || (official && trip.year !== '2026') || (!official && trip.year !== trip.manual.year)) errors.push('Tahun anggaran harus sesuai aturan yang dipilih.')
  if (days && (!trip.start.startsWith(trip.year + '-') || !trip.end.startsWith(trip.year + '-'))) errors.push('Tanggal perjalanan harus berada dalam tahun anggaran yang dipilih.')
  if (!trip.purpose.trim()) errors.push('Isi kegiatan atau tujuan penugasan.')
  if (!origin || !destination || !trip.origin.trim() || !trip.destination.trim()) errors.push('Lengkapi provinsi dan kota asal serta tujuan.')
  if (!official && !ruleName) errors.push('Isi nama aturan manual.')
  if (!people.length) errors.push('Tambahkan minimal satu pegawai.')
  if (trip.activity === 'local' && (city(trip.origin) !== city(trip.destination) || trip.originProvince !== trip.destinationProvince)) errors.push('Perjalanan dalam kota harus memiliki kota dan provinsi asal/tujuan yang sama.')
  if (official && trip.activity === 'ordinary' && city(trip.origin) === city(trip.destination) && trip.originProvince === trip.destinationProvince) errors.push('Asal dan tujuan berada dalam kota yang sama; pilih jenis kegiatan yang sesuai.')
  const meeting = ['fullboard', 'fullday', 'halfday'].includes(trip.activity)
  const extraDays = meeting ? Number(trip.before) + Number(trip.after) : 0
  if (meeting && days <= extraDays) errors.push('Sisakan minimal satu hari untuk kegiatan rapat.')
  if (official && trip.localActual && trip.activity !== 'ordinary') errors.push('Transpor lokal riil dengan uang harian 60% hanya didukung untuk dinas biasa di formulir ini.')
  const flight = official && trip.transport === 'plane' ? flightRate(trip) : undefined
  const ticket = trip.ticketProvided ? 0 : trip.mode === 'estimate' && trip.ticket === '' && flight ? flight.economy : number(trip.ticket, 'Biaya tiket/transportasi utama PP')
  const originTrips = number(trip.originTrips, 'Jumlah transfer asal', 4)
  const destinationTrips = number(trip.destinationTrips, 'Jumlah transfer tujuan', 4)
  const transferRate = (value: string, fallback: number | null | undefined, label: string, count: number) => !count ? 0 : official && value === '' && fallback != null ? fallback : number(value, label)
  const originTransfer = transferRate(official ? trip.originRate : trip.manual.originTransfer, origin?.transfer, 'Tarif transfer asal', originTrips)
  const destinationTransfer = transferRate(official ? trip.destinationRate : trip.manual.destinationTransfer, destination?.transfer, 'Tarif transfer tujuan', destinationTrips)
  if (official && (trip.originRate !== '' || trip.destinationRate !== '')) notes.push('Tarif transfer yang diisi manual perlu diverifikasi. Pembayaran di atas SBM mengikuti syarat biaya riil, dari/ke kantor, dan bukan kendaraan pribadi (hlm. 107).')
  if (official && flight && ticket > flight.economy) notes.push('Tiket melebihi referensi SBM; Lampiran II dapat dilampaui sesuai ketentuan. Pembayaran tiket berdasarkan biaya riil.')
  if (official && !flight && !trip.ticketProvided && trip.mode === 'estimate') notes.push('Tiket/transportasi utama menggunakan estimasi pengguna; rute atau moda ini tidak memakai referensi tiket otomatis.')
  const localCost = trip.localActual ? number(trip.localCost, 'Total transpor lokal riil per pegawai') : 0
  const factor = trip.localActual ? (official ? 60 : number(trip.manual.localPercent, 'Persentase uang harian', 100)) / 100 : 1
  for (const [index, p] of people.entries()) {
    const label = p.name.trim() || `Pegawai ${index + 1}`
    if (!p.name.trim()) errors.push(`Pegawai ${index + 1}: isi nama.`)
    if (p.nip && !/^\d{18}$/.test(p.nip)) errors.push(`${label}: NIP harus 18 digit atau dikosongkan.`)
    const nights = trip.hotelProvided ? 0 : number(p.nights, `${label}, malam menginap`, 365)
    if (days && nights > days - 1) errors.push(`${label}: jumlah malam tidak boleh melebihi lama perjalanan dikurangi satu.`)
    if (official && trip.activity === 'fullboard' && nights > extraDays) errors.push(`${label}: penginapan fullboard sudah termasuk paket; isi hanya malam tambahan sebelum/sesudah kegiatan.`)
    const add = (component: string, quantity: number, unit: string, rate: number, note: string) => lines.push({ personId: p.id, person: label, nip: p.nip, grade: p.grade, position: positions[p.position], component, quantity, unit, rate, amount: Math.round(quantity * rate), note })
    const normalDaily = official ? destination?.daily[trip.activity === 'local' ? 1 : trip.activity === 'training' ? 2 : 0] ?? 0 : number(trip.manual.daily, 'Tarif uang harian manual')
    if (trip.dailyProvided) add('Uang harian', 0, 'hari', normalDaily, 'Ditanggung pihak lain; tidak dihitung kembali.')
    else if (official && meeting) {
      add('Uang harian kegiatan', Math.max(0, days - extraDays), 'hari', trip.activity === 'fullboard' ? 130000 : 0, 'PMK hlm. 22, 56. Fullboard Rp130.000; halfday/fullday tidak diberikan uang harian kegiatan.')
      if (extraDays) add('Uang harian hari perjalanan', extraDays, 'hari', destination?.daily[0] ?? 0, 'PMK hlm. 56: maksimal 1 hari sebelum dan/atau sesudah, sesuai kebutuhan transportasi/panitia.')
    } else add('Uang harian', days, 'hari', Math.round(normalDaily * factor), official ? `PMK hlm. 15${factor !== 1 ? '; 60% karena transpor lokal riil (hlm. 53)' : ''}.` : `${ruleName}; tarif manual${factor !== 1 ? ` × ${factor * 100}%` : ''}.`)
    const hotelLimit = official ? destination?.hotel[hotelTier(p)] ?? 0 : nights ? number(trip.manual.hotel, 'Tarif/batas hotel manual') : 0
    const hotel = nights && trip.mode === 'actual' ? number(p.hotelActual, `${label}, biaya hotel aktual per malam`) : hotelLimit
    if (official && hotel > hotelLimit) errors.push(`${label}: hotel melebihi batas ${rupiah(hotelLimit)}/malam; pengecualian khusus belum didukung.`)
    add('Penginapan', nights, 'malam', hotel, trip.hotelProvided ? 'Ditanggung penyelenggara.' : `${official ? 'PMK hlm. 19, 54' : ruleName}; ${trip.mode === 'actual' ? 'biaya aktual per malam' : 'estimasi berdasarkan batas tarif'}, bukti sah diperlukan pada realisasi.`)
    add(trip.transport === 'plane' ? 'Tiket pesawat ekonomi PP' : 'Transportasi utama PP', trip.ticketProvided ? 0 : 1, 'PP', ticket, trip.ticketProvided ? 'Ditanggung pihak lain.' : `${flight && trip.mode === 'estimate' && trip.ticket === '' ? `Referensi PMK hlm. ${flight.page}` : 'Nominal pengguna'}; sudah pergi-pulang, pembayaran berdasarkan biaya riil.`)
    add('Transfer di kota asal', originTrips, 'kali', originTransfer, official && trip.originRate === '' && origin?.transfer != null ? 'PMK hlm. 85, 107; lumpsum per perjalanan.' : 'Tarif manual per perjalanan; verifikasi dasar biaya.')
    add('Transfer di kota tujuan', destinationTrips, 'kali', destinationTransfer, official && trip.destinationRate === '' && destination?.transfer != null ? 'PMK hlm. 85, 107; lumpsum per perjalanan.' : 'Tarif manual per perjalanan; verifikasi dasar biaya.')
    const rep = official ? ({ state: 250000, echelon1: 200000, echelon2: 150000 } as Partial<Record<Position, number>>)[p.position] ?? 0 : number(trip.manual.representation, 'Tarif representasi manual')
    add('Uang representasi', trip.representationDuty ? days : 0, 'hari', trip.activity === 'local' && official ? rep / 2 : rep, official ? 'PMK hlm. 15, 54; hanya pejabat yang berhak dalam pelaksanaan tugas/fungsi jabatan.' : 'Tarif dan kelayakan ditentukan pengguna berdasarkan aturan manual.')
    if (trip.localActual) add('Transpor lokal riil', 1, 'total', localCost, 'Beberapa lokasi dalam kabupaten/kota yang sama; total per pegawai, tidak termasuk transfer bandara.')
  }
  if (!official) notes.push('Aturan manual: tarif dan kelayakan biaya wajib mengikuti sumber yang Anda isi. Sistem hanya menghitung volume × tarif; ketentuan khusus PMK tidak diterapkan otomatis.')
  if (official && meeting) notes.push('Paket rapat merupakan biaya penyelenggara dan tidak ditambahkan sebagai pembayaran pegawai. Hari tambahan harus sesuai penugasan dan kebutuhan perjalanan.')
  return { days, ruleName, lines, total: errors.length ? null : lines.reduce((sum, l) => sum + l.amount, 0), errors: [...new Set(errors)], notes }
}
export type Calculation = ReturnType<typeof calculate>
