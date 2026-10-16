import PizZip from 'pizzip'
import { detectRabMapping, RAB_MAX_BYTES, RAB_MAX_ROWS, rabColumn, rabColumnIndex, rabRecap, rabPrimary, rabAmountWarning, type RabSheet, type RabCell, type RabRow } from './ahspRab'

const MAX_EXPANDED = 40 * 1024 * 1024
function validateZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--) if (view.getUint32(end, true) === 0x06054b50) break
  if (end < 0 || bytes.length < 22) throw new Error('File bukan workbook XLSX yang valid.')
  const entries = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true)
  if (entries > 2000 || entries === 65535 || start >= bytes.length) throw new Error('Struktur workbook terlalu besar atau tidak didukung.')
  let offset = start, expanded = 0
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Struktur ZIP workbook rusak.')
    if (view.getUint16(offset + 8, true) & 1) throw new Error('Workbook terkunci. Simpan salinan tanpa kata sandi.')
    expanded += view.getUint32(offset + 24, true)
    if (expanded > MAX_EXPANDED) throw new Error('Isi workbook setelah dibuka melebihi 40 MB. Pisahkan dokumen terlebih dahulu.')
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
}
export function readRabWorkbook(bytes: Uint8Array): RabSheet[] {
  if (bytes.length > RAB_MAX_BYTES) throw new Error('Ukuran file maksimal 10 MB.')
  validateZip(bytes)
  let zip: PizZip
  try { zip = new PizZip(bytes, { checkCRC32: true }) }
  catch { throw new Error('Workbook rusak, terkunci, atau tidak dapat dibuka. Simpan ulang sebagai .xlsx.') }
  const nodes = (element: Document | Element, name: string) => Array.from(element.getElementsByTagNameNS('*', name))
  const xml = (path: string): Document => {
    const file = zip.file(path)
    if (!file) throw new Error(`Bagian workbook tidak ditemukan: ${path}.`)
    const text = file.asText()
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Deklarasi XML eksternal tidak didukung.')
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    if (nodes(doc, 'parsererror').length) throw new Error('XML workbook tidak dapat dibaca.')
    return doc
  }
  const content = xml('[Content_Types].xml')
  if (!nodes(content, 'Override').some(n => n.getAttribute('ContentType') === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml')) throw new Error('Hanya workbook .xlsx yang didukung. Simpan ulang melalui Excel jika perlu.')
  const workbook = xml('xl/workbook.xml')
  const relations = nodes(xml('xl/_rels/workbook.xml.rels'), 'Relationship')
  const shared = zip.file('xl/sharedStrings.xml') ? nodes(xml('xl/sharedStrings.xml'), 'si').map(si => nodes(si, 't').map(t => t.textContent ?? '').join('')) : []
  const sheets = nodes(workbook, 'sheet')
  if (sheets.length > 100) throw new Error('Workbook memiliki lebih dari 100 sheet. Pisahkan dokumen terlebih dahulu.')
  return sheets.map(sheet => {
    const relationId = Array.from(sheet.attributes).find(a => a.localName === 'id')?.value
    const relation = relations.find(r => r.getAttribute('Id') === relationId)
    if (!relation || relation.getAttribute('TargetMode') === 'External') throw new Error('Sheet mengarah ke sumber eksternal yang tidak didukung.')
    const target = relation.getAttribute('Target') ?? ''
    const parts: string[] = []
    for (const part of (target.startsWith('/') ? target.slice(1) : `xl/${target}`).split('/')) {
      if (part === '..') parts.pop(); else if (part !== '.') parts.push(part)
    }
    const path = parts.join('/')
    if (!path.startsWith('xl/') || /[:\\]/.test(path)) throw new Error('Alamat sheet tidak valid.')
    const doc = xml(path), cells: Record<string, RabCell> = {}, columns = new Set<string>()
    let lastRow = 0, count = 0
    for (const cell of nodes(doc, 'c')) {
      const address = cell.getAttribute('r') ?? ''
      const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(address)
      if (!match) throw new Error('Alamat sel workbook tidak valid.')
      const row = Number(match[2]), col = match[1], type = cell.getAttribute('t')
      const formula = nodes(cell, 'f').length > 0
      const valueText = nodes(cell, 'v')[0]?.textContent ?? ''
      const text = type === 's' ? shared[Number(valueText)] ?? '' : type === 'inlineStr' ? nodes(cell, 't').map(t => t.textContent ?? '').join('') : valueText
      if (!text && !formula) continue
      lastRow = Math.max(lastRow, row)
      if (row > RAB_MAX_ROWS) continue
      if (++count > 100000 || rabColumnIndex(col) > 256) throw new Error('Area data terlalu lebar. Batasi sheet hingga 256 kolom dan 100.000 sel terisi pada 1.000 baris pertama.')
      columns.add(col)
      cells[address] = { text, value: (!type || type === 'n') && text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : null, formula, error: type === 'e' }
    }
    const merges = nodes(doc, 'mergeCell').flatMap(node => {
      const ref = node.getAttribute('ref') ?? ''
      const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(ref)
      return match ? [{ from: Number(match[2]), to: Number(match[4]), left: rabColumnIndex(match[1]), right: rabColumnIndex(match[3]), ref }] : []
    })
    const result: RabSheet = { name: sheet.getAttribute('name') ?? 'Sheet', hidden: sheet.getAttribute('state') === 'hidden' || sheet.getAttribute('state') === 'veryHidden', lastRow, cells, merges, columns: [...columns].sort((a, b) => rabColumnIndex(a) - rabColumnIndex(b)), mapping: { name: '', code: '', unit: '', volume: '', price: '', total: '', start: 1 } }
    result.mapping = detectRabMapping(result)
    return result
  })
}

type ExportCell = string | number | null
export type RabExportContext = { filename: string; sheets: { name: string; lastRow: number; start: number }[]; catalogAt: string; completed: boolean }
const escapeXml = (text: string) => text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function exportRabWorkbook(rows: RabRow[], context: RabExportContext): Uint8Array {
  const recap = rabRecap(rows)
  const status = (row: RabRow) => row.excluded ? 'Dikecualikan' : ({ pending: 'Belum dicocokkan', review: 'Perlu ditinjau', missing: 'Belum ditemukan', matched: row.candidate && rabPrimary(row.candidate) ? 'Cocok regulasi utama' : 'Cocok regulasi tambahan' })[row.status]
  const header = ['Sheet asal', 'Baris asal', 'Sel uraian', 'Uraian asli', 'Uraian diperiksa', 'Kode sumber', 'Satuan sumber', 'Volume', 'Harga Satuan (Rupiah)', 'Total Harga (Rupiah)', 'Pekerjaan hasil rekonsiliasi', 'Kode AHSP', 'Satuan AHSP', 'Regulasi', 'Status regulasi', 'Status kecocokan', 'Keputusan', 'Penyelesaian perbedaan', 'Catatan pembacaan', 'Sel angka asal', 'Angka asli Excel', 'Riwayat tindakan']
  const detail = (row: RabRow): ExportCell[] => [row.sheet, row.row, row.source, row.originalName, row.name, row.code, row.unit, row.volume, row.price, row.total, row.candidate?.name ?? '', row.candidate?.code ?? '', row.candidate?.unit ?? '', row.candidate?.regulation ?? '', row.candidate?.regulation_status ?? '', status(row), row.manual ? 'Manual' : row.candidate ? 'Otomatis' : '', row.resolution, [row.exclusion, ...row.issues, row.reviewed ? '' : 'Pembacaan belum dikonfirmasi', rabAmountWarning(row)].filter(Boolean).join('; '), JSON.stringify(row.refs), JSON.stringify(row.raw), row.history.join('\n')]
  const summary: ExportCell[][] = [
    ['REKAPITULASI PENCOCOKAN RAB'], ['File sumber', context.filename], ['Katalog dimuat', context.catalogAt], ['Diekspor', new Date().toISOString()],
    ['Referensi utama', 'SE 47/2026 dan Permen 08/2023'], ['Status proses', context.completed && !recap.pending ? 'Pencocokan selesai' : 'Sementara / pencocokan belum selesai'],
    ['Status pembacaan', recap.issues || recap.excludedReview ? `${recap.issues} item dan ${recap.excludedReview} pengecualian belum dikonfirmasi` : 'Tidak ada pembacaan yang menunggu konfirmasi'],
    ['Cakupan', context.sheets.some(s => s.lastRow > RAB_MAX_ROWS) ? 'TERBATAS: hanya baris Excel 1–1000 per sheet terpilih' : 'Sheet terpilih; baris sebelum awal data dikecualikan'],
    ...context.sheets.map(s => ['Sheet', s.name, 'Awal data', s.start, 'Akhir diproses', Math.min(s.lastRow, RAB_MAX_ROWS), 'Baris terakhir berisi', s.lastRow] as ExportCell[]),
    ['Ukuran', 'Nilai'], ['Item diperiksa', recap.total], ['Cocok regulasi utama', recap.primary], ['Persentase utama (%)', Number(recap.percent.toFixed(2))],
    ['Cocok regulasi tambahan', recap.additional], ['Persentase tambahan (%)', Number(recap.additionalPercent.toFixed(2))], ['Perlu ditinjau', recap.review], ['Belum ditemukan', recap.missing], ['Belum dicocokkan', recap.pending], ['Baris dikecualikan', recap.excluded],
    ['Jumlah total sumber yang tersedia (Rupiah)', recap.amount], ['Item tanpa total sumber', recap.missingAmounts],
    ['Dasar persentase', 'Jumlah item cocok pada kelompok regulasi / seluruh item diperiksa. Item belum selesai tetap masuk penyebut.'],
    ['Pekerjaan pengganti', 'Volume, satuan sumber, harga satuan, dan total sumber tidak dikonversi saat memilih pasangan AHSP.'],
    ['Rumus sumber', 'Nilai hasil tersimpan dibaca tanpa menghitung ulang Excel. Selisih Volume × Harga Satuan dicatat tanpa menimpa total sumber.'],
    ['Kelompok', 'Jumlah item', 'Jumlah total sumber tersedia (Rupiah)', 'Item tanpa total'],
  ]
  const primary = rows.filter(r => !r.excluded && r.status === 'matched' && r.candidate && rabPrimary(r.candidate))
  const additional = rows.filter(r => !r.excluded && r.status === 'matched' && r.candidate && !rabPrimary(r.candidate))
  const unresolved = rows.filter(r => !r.excluded && r.status !== 'matched')
  for (const [label, group] of [['Regulasi utama', primary], ['Regulasi tambahan', additional], ['Belum cocok', unresolved]] as const) summary.push([label, group.length, group.reduce((n, r) => n + (r.total ?? 0), 0), group.filter(r => r.total === null).length])
  const sheets = [
    { name: 'Rekapitulasi', rows: summary },
    { name: 'Regulasi Utama', rows: [header, ...primary.map(detail)] },
    { name: 'Regulasi Tambahan', rows: [header, ...additional.map(detail)] },
    { name: 'Belum Cocok', rows: [header, ...unresolved.map(detail)] },
    { name: 'Dikecualikan', rows: [header, ...rows.filter(r => r.excluded).map(detail)] },
  ]
  const zip = new PizZip(), ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  zip.file('[Content_Types].xml', `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  zip.file('_rels/.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file('xl/workbook.xml', `${declaration}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="${rel}/styles" Target="styles.xml"/></Relationships>`)
  zip.file('xl/styles.xml', `${declaration}<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##########"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF163B68"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)
  sheets.forEach((s, i) => {
    const width = (col: number) => i === 0 ? col === 0 ? 48 : 38 : [3, 4, 10, 17, 18, 19, 20, 21].includes(col) ? 64 : 23
    const maxCols = Math.max(...s.rows.map(r => r.length))
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `${declaration}<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({ length: maxCols }, (_, col) => `<col min="${col + 1}" max="${col + 1}" width="${width(col)}" customWidth="1"/>`).join('')}</cols><sheetData>${s.rows.map((row, r) => `<row r="${r + 1}">${row.map((value, c) => value === null ? '' : typeof value === 'number' ? `<c r="${rabColumn(c + 1)}${r + 1}" s="2"><v>${value}</v></c>` : `<c r="${rabColumn(c + 1)}${r + 1}" s="${r === 0 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData>${i > 0 ? `<autoFilter ref="A1:V${s.rows.length}"/>` : ''}</worksheet>`)
  })
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
}
