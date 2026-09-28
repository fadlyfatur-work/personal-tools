import PizZip from 'pizzip'
import { activities, type Calculation, type Trip } from './calculate'

type Cell = string | number | { formula: string; value: number }
const escape = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

// ponytail: reuse the project's ZIP library for this fixed, two-sheet XLSX.
// Adopt a spreadsheet library when the supplied template needs advanced Excel features.
export function createWorkbook(trip: Trip, result: Calculation): Uint8Array {
  if (result.total === null) throw new Error('Lengkapi input sebelum ekspor.')
  const rows: Cell[][] = [
    ['RINCIAN PERHITUNGAN PERJALANAN DINAS'],
    ['Aturan', result.ruleName, 'Tahun anggaran', trip.year],
    ['Kegiatan', trip.purpose],
    ['Rute', `${trip.origin}, ${trip.originProvince} → ${trip.destination}, ${trip.destinationProvince}`],
    ['Tanggal', trip.start, 's.d.', trip.end, 'Hari', result.days],
    ['Perhitungan', trip.mode === 'estimate' ? 'Estimasi pengajuan' : 'Realisasi berdasarkan input'],
    ['Nama', 'NIP', 'Golongan', 'Jabatan', 'Komponen', 'Volume', 'Satuan', 'Tarif (Rp)', 'Jumlah (Rp)', 'Dasar / catatan'],
  ]
  for (const l of result.lines) {
    const r = rows.length + 1
    rows.push([l.person, l.nip, l.grade, l.position, l.component, l.quantity, l.unit, l.rate, { formula: `F${r}*H${r}`, value: l.amount }, l.note])
  }
  const last = rows.length
  rows.push(['TOTAL', '', '', '', '', '', '', '', { formula: `SUM(I8:I${last})`, value: result.total }])
  rows.push(['Angka dapat diedit. Kolom Jumlah dan TOTAL dihitung ulang oleh Excel.'])
  rows.push(['Pengubahan volume/tarif di Excel tidak menjalankan validasi aturan aplikasi.'])
  for (const note of result.notes) rows.push([note])
  const params: Cell[][] = [
    ['PARAMETER PERHITUNGAN'], ['Parameter', 'Nilai'],
    ['Aturan', result.ruleName], ['Tahun anggaran', trip.year], ['Kegiatan', activities[trip.activity]],
    ['Satker / instansi', trip.satker || ''], ['Nomor surat tugas / SPD', trip.documentNumber || ''], ['Sumber anggaran', trip.budget || ''], ['Penandatangan (nama / NIP)', trip.signer || ''],
    ['Moda', trip.transport], ['Kelas tiket', trip.transport === 'plane' ? 'Ekonomi' : 'Sesuai input'],
    ['Uang harian ditanggung pihak lain', trip.dailyProvided ? 'Ya' : 'Tidak'],
    ['Penginapan ditanggung pihak lain', trip.hotelProvided ? 'Ya' : 'Tidak'],
    ['Tiket ditanggung pihak lain', trip.ticketProvided ? 'Ya' : 'Tidak'],
    ['Transfer asal (kali per pegawai)', Number(trip.originTrips)], ['Transfer tujuan (kali per pegawai)', Number(trip.destinationTrips)],
    ['Transpor lokal riil', trip.localActual ? 'Ya' : 'Tidak'],
    ['Tugas/fungsi jabatan untuk representasi', trip.representationDuty ? 'Ya' : 'Tidak'],
    ['Hari sebelum rapat', trip.before ? 1 : 0], ['Hari sesudah rapat', trip.after ? 1 : 0],
    ['Sumber', trip.rule === 'pmk2026' ? 'https://jdih.kemenkeu.go.id/dok/pmk-32-tahun-2025' : trip.manual.name],
    ['Cakupan', 'Perjalanan dinas dalam negeri. Biaya tidak mencakup paket penyelenggara rapat.'],
  ]
  const zip = new PizZip()
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const sheet = (data: Cell[][], header: number, detail: boolean) => `${declaration}<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${header}" topLeftCell="A${header + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${(detail ? [25, 24, 12, 27, 32, 12, 12, 19, 21, 90] : [48, 100]).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${data.map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
    const ref = `${String.fromCharCode(65 + c)}${r + 1}`
    const s = r === 0 || r === header - 1 ? 1 : detail && (c === 7 || c === 8) && r >= header ? 2 : 0
    if (typeof cell === 'number') return `<c r="${ref}" s="${s}"><v>${cell}</v></c>`
    if (typeof cell === 'object') return `<c r="${ref}" s="${s}"><f>${cell.formula}</f><v>${cell.value}</v></c>`
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escape(cell)}</t></is></c>`
  }).join('')}</row>`).join('')}</sheetData>${detail ? `<autoFilter ref="A7:J${last}"/>` : ''}</worksheet>`
  zip.file('[Content_Types].xml', `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${[1, 2].map(i => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  zip.file('_rels/.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file('xl/workbook.xml', `${declaration}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="Rincian" sheetId="1" r:id="rId1"/><sheet name="Parameter" sheetId="2" r:id="rId2"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[1, 2].map(i => `<Relationship Id="rId${i}" Type="${rel}/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}<Relationship Id="rId3" Type="${rel}/styles" Target="styles.xml"/></Relationships>`)
  zip.file('xl/styles.xml', `${declaration}<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF16645B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)
  zip.file('xl/worksheets/sheet1.xml', sheet(rows, 7, true))
  zip.file('xl/worksheets/sheet2.xml', sheet(params, 2, false))
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
}
