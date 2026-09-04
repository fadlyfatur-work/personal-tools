const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export function formatTanggalIndo(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

// Menghasilkan daftar tanggal (ISO string) dari start s.d. end, inklusif
export function generateDateRange(start: string, end: string): string[] {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const dates: string[] = []

  const cur = new Date(startDate)
  while (cur <= endDate) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// Format teks periode, contoh: "1 s.d. 3 Agustus 2026" atau lintas bulan "30 Juli s.d. 2 Agustus 2026"
export function formatPeriodeSurat(start: string, end: string): string {
  if (start === end) return formatTanggalIndo(start)

  const startDate = new Date(start)
  const endDate = new Date(end)
  const sameMonth =
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()

  if (sameMonth) {
    return `${startDate.getDate()} s.d. ${endDate.getDate()} ${BULAN[endDate.getMonth()]} ${endDate.getFullYear()}`
  }

  return `${formatTanggalIndo(start)} s.d. ${formatTanggalIndo(end)}`
}