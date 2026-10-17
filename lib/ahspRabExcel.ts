import PizZip from 'pizzip'
import { detectRabMapping, RAB_MAX_BYTES, RAB_MAX_ROWS, rabColumn, rabColumnIndex, rabRecap, rabPrimary, rabPercent, rabAmountWarning, rabDifferences, type RabSheet, type RabCell, type RabRow } from './ahspRab'
import type { RabUsageReport } from './ahspRabUsage'

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
type ExportSheet = { name: string; rows: ExportCell[][]; widths: number[]; headers: number[]; merges?: string[]; heights?: Record<number, number>; money?: Set<string>; styles?: Record<string, number>; archiveRows?: Set<number>; freeze: number; filter?: string }
export type RabExportContext = { filename: string; sheets: { name: string; lastRow: number; start: number }[]; catalogAt: string; completed: boolean; usage?: RabUsageReport }
const escapeXml = (text: string) => text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
export function exportRabWorkbook(rows: RabRow[], context: RabExportContext): Uint8Array {
  const recap = rabRecap(rows)
  const status = (row: RabRow) => row.excluded ? 'Dikecualikan' : row.noMatch ? 'Tidak ada kecocokan · sudah diperiksa' : ({ pending: 'Belum dicocokkan', review: 'Perlu ditinjau', missing: 'Belum ditemukan', matched: row.candidate && rabPrimary(row.candidate) ? 'Cocok regulasi utama' : 'Cocok regulasi tambahan' })[row.status]
  const header = ['Kode sumber', 'Uraian sumber', 'Satuan sumber', 'Volume', 'Harga Satuan (Rupiah)', 'Total Harga (Rupiah)', 'Kode AHSP', 'Uraian hasil rekonsiliasi', 'Satuan AHSP', 'Regulasi', 'Status regulasi', 'Status kecocokan', 'Keputusan', 'Penyelesaian perbedaan', 'Catatan pembacaan']
  const detail = (row: RabRow): ExportCell[] => [row.code, row.name, row.unit, row.volume, row.price, row.total, row.candidate?.code ?? '', row.candidate?.name ?? '', row.candidate?.unit ?? '', row.candidate?.regulation ?? '', row.candidate?.regulation_status ?? '', status(row), row.manual ? 'Manual' : row.candidate ? 'Otomatis' : '', row.resolution, [row.exclusion, ...row.issues, row.reviewed ? '' : 'Pembacaan belum dikonfirmasi', ...(row.candidate ? rabDifferences(row, row.candidate) : []), rabAmountWarning(row)].filter(Boolean).join('; ')]
  const summary: ExportSheet = { name: 'Rekapitulasi', rows: [], widths: [44, 24, 38, 24], headers: [], merges: [], heights: {}, money: new Set(), freeze: 1 }
  const section = (title: string) => {
    if (summary.rows.length) summary.rows.push([])
    summary.rows.push([title]); const r = summary.rows.length
    summary.headers.push(r); summary.merges!.push(`A${r}:D${r}`); summary.heights![r] = 28
  }
  const pair = (title: string, result: ExportCell, height = 30, mergeValue = true) => {
    summary.rows.push([title, result]); const r = summary.rows.length
    if (mergeValue) summary.merges!.push(`B${r}:D${r}`)
    summary.heights![r] = height
    return r
  }
  section('REKAPITULASI PENCOCOKAN RAB')
  pair('File sumber', context.filename)
  pair('Katalog dimuat', context.catalogAt)
  pair('Diekspor', new Date().toISOString())
  pair('Referensi utama', 'SE 47/2026 dan Permen 08/2023')
  pair('Status proses', context.completed && !recap.pending ? 'Pencocokan selesai' : 'Sementara / pencocokan belum selesai')
  pair('Status pembacaan', recap.issues || recap.excludedReview ? `${recap.issues} item dan ${recap.excludedReview} pengecualian belum dikonfirmasi` : 'Tidak ada pembacaan yang menunggu konfirmasi')
  pair('Cakupan', context.sheets.some(s => s.lastRow > RAB_MAX_ROWS) ? 'TERBATAS: hanya baris Excel 1–1000 per sheet terpilih' : 'Sheet terpilih; baris sebelum awal data dikecualikan')
  section('CAKUPAN SHEET')
  summary.rows.push(['Sheet', 'Awal data', 'Akhir diproses', 'Baris terakhir berisi']); summary.headers.push(summary.rows.length)
  for (const sheet of context.sheets) summary.rows.push([sheet.name, sheet.start, Math.min(sheet.lastRow, RAB_MAX_ROWS), sheet.lastRow])
  section('HASIL PENCOCOKAN')
  for (const [title, result] of [
    ['Item diperiksa', recap.total], ['Total item cocok', `${recap.primary + recap.additional} (${rabPercent(recap.percent + recap.additionalPercent)}%)`], ['Cocok regulasi utama', `${recap.primary} (${rabPercent(recap.percent)}%)`],
    ['Cocok regulasi tambahan', `${recap.additional} (${rabPercent(recap.additionalPercent)}%)`], ['Perlu ditinjau', recap.review], ['Belum ditemukan', recap.missing], ['Sudah diperiksa tanpa kecocokan', recap.checkedMissing], ['Belum dicocokkan', recap.pending], ['Baris dikecualikan', recap.excluded],
    ['Total harga (Rp)', recap.amount],
  ] as [string, ExportCell][]) {
    const r = pair(title, result, 30, false)
    if (title === 'Total harga (Rp)') summary.money!.add(`B${r}`)
  }
  const primary = rows.filter(r => !r.excluded && r.status === 'matched' && r.candidate && rabPrimary(r.candidate))
  const additional = rows.filter(r => !r.excluded && r.status === 'matched' && r.candidate && !rabPrimary(r.candidate))
  const unresolved = rows.filter(r => !r.excluded && r.status !== 'matched')
  section('RINGKASAN NILAI PER KELOMPOK')
  summary.rows.push(['Kelompok', 'Jumlah item']); summary.headers.push(summary.rows.length)
  for (const [title, group] of [['Regulasi utama', primary], ['Regulasi tambahan', additional], ['Belum cocok', unresolved]] as const) {
    summary.rows.push([title, group.length])
  }
  section('CATATAN PEMBACAAN DAN REKONSILIASI')
  pair('Dasar persentase', 'Jumlah item cocok pada kelompok regulasi / seluruh item diperiksa. Item belum selesai tetap masuk penyebut.', 44)
  pair('Pekerjaan pengganti', 'Kode dan uraian pada Final RAB memakai pasangan yang telah ditetapkan cocok. Item tanpa pasangan memakai data sumber; kolom regulasi dibiarkan kosong.', 56)
  pair('Satuan dan angka sumber', 'Satuan, volume, harga satuan, dan total sumber tidak dikonversi saat memilih pasangan AHSP, termasuk bila satuan AHSP berbeda.', 44)
  pair('Rumus sumber', 'Nilai hasil tersimpan dibaca tanpa menghitung ulang Excel. Selisih Volume × Harga Satuan dicatat tanpa menimpa total sumber.', 44)
  if (context.usage) {
    section('CAKUPAN REKAP PENGGUNAAN KOMPONEN')
    pair('Pekerjaan cocok', context.usage.matched, 30, false)
    pair('Dengan rincian komponen', context.usage.covered, 30, false)
    pair('Rincian belum tersedia', context.usage.matched - context.usage.covered, 30, false)
    pair('Rincian sebagian / perlu ditinjau', context.usage.review, 30, false)
    pair('AHSP unik', context.usage.uniqueJobs, 30, false)
    pair('Dasar hitungan penggunaan', 'Total dipakai menghitung baris RAB. Item pekerjaan/AHSP menghitung analisis unik beserta versi regulasinya. Komponen berulang dihitung sekali per baris RAB. Tidak menghitung kuantitas atau biaya komponen.', 68)
  }
  const detailSheet = (name: string, group: RabRow[]): ExportSheet => ({ name, rows: [header, ...group.map(detail)], widths: header.map((_, col) => [1, 7, 13, 14].includes(col) ? 60 : 23), headers: [1], heights: { 1: 36 }, freeze: 1, filter: `A1:O${group.length + 1}`, money: new Set(group.flatMap((_, i) => [`E${i + 2}`, `F${i + 2}`])), styles: Object.fromEntries([['B1', 14], ['H1', 15], ...group.flatMap((_, i) => [[`B${i+2}`, 8], [`H${i+2}`, 9]])]) })
  const active = rows.filter(row => !row.excluded)
  const finalRows: ExportCell[][] = [
    ['FINAL RAB'], [`File sumber: ${context.filename}`],
    [context.completed && !recap.pending ? 'Status: pencocokan selesai' : 'Status: hasil sementara; masih ada item yang perlu diperiksa atau diproses'],
    ['Satuan dan angka mengikuti sumber. Kode dan uraian memakai pasangan cocok jika tersedia. Baris dikecualikan tidak dimasukkan.'], [],
    ['Kode', 'Uraian sumber', 'Uraian hasil rekonsiliasi', 'Satuan', 'Harga satuan (Rupiah)', 'Volume/Kuantitas', 'Jumlah Harga', 'Regulasi'],
    ...active.map(row => {
      const matched = row.status === 'matched' ? row.candidate : null
      return [matched ? matched.code : row.code, row.originalName, matched ? matched.name : row.name, row.unit, row.price, row.volume, row.total, matched?.regulation ?? '']
    }),
    ['JUMLAH HARGA', null, null, null, null, null, active.some(row => row.total !== null) ? active.reduce((n, row) => n + (row.total ?? 0), 0) : null],
  ]
  const finalSheet: ExportSheet = { name: 'Final RAB', rows: finalRows, widths: [18, 54, 54, 12, 24, 22, 24, 24], headers: [1, 6, finalRows.length], heights: { 1: 32, 2: 26, 3: 32, 4: 38, 6: 36 }, merges: ['A1:H1', 'A2:H2', 'A3:H3', 'A4:H4', `A${finalRows.length}:F${finalRows.length}`], freeze: 6, filter: `A6:H${6 + active.length}`, money: new Set([...active.flatMap((_, i) => [`E${i + 7}`, `G${i + 7}`]), `G${finalRows.length}`]), styles: Object.fromEntries([['B6', 14], ['C6', 15], ...active.flatMap((_, i) => [[`B${i+7}`, 8], [`C${i+7}`, 9]])]), archiveRows: new Set(active.flatMap((row, i) => row.status === 'matched' && row.candidate && !rabPrimary(row.candidate) ? [i+7] : [])) }
  const sheets: ExportSheet[] = [summary, detailSheet('Regulasi Utama', primary), detailSheet('Regulasi Tambahan', additional), detailSheet('Belum Cocok', unresolved), detailSheet('Dikecualikan', rows.filter(r => r.excluded)), finalSheet]
  if (context.usage) {
    const usage = context.usage
    const table = (name: string, headers: string[], values: ExportCell[][], widths: number[]): ExportSheet => ({ name, rows: [headers, ...values], widths, headers: [1], heights: { 1: 40 }, freeze: 1, filter: `A1:${rabColumn(headers.length)}${values.length + 1}` })
    const mptk: ExportSheet = { name: 'Rekapitulasi MPTK', rows: [], widths: [60, 20, 30, 26, 28], headers: [], merges: [], freeze: 2 }
    for (const [group, title] of [['tenaga', 'TENAGA KERJA'], ['bahan', 'MATERIAL'], ['alat', 'PERALATAN']] as const) {
      if (mptk.rows.length) mptk.rows.push([])
      mptk.rows.push([title]); mptk.headers.push(mptk.rows.length); mptk.merges!.push(`A${mptk.rows.length}:E${mptk.rows.length}`)
      mptk.rows.push(['Komponen', 'Satuan komponen', 'Kode komponen', 'Total dipakai (baris RAB)', 'Item pekerjaan/AHSP unik']); mptk.headers.push(mptk.rows.length)
      mptk.rows.push(...usage.components.filter(c => c.group === group).map(c => [c.name, c.unit, c.codes.join(', '), c.total, c.jobs.length]))
    }
    sheets.push(mptk)
    const names = { tenaga: 'Tenaga kerja', bahan: 'Material', alat: 'Peralatan' }
    const details = usage.components.flatMap(c => c.jobs.flatMap(job => job.sources.map(source => [names[c.group], c.name, c.unit, job.item.code, job.item.name, job.item.regulation, job.analysis.code, job.analysis.regulation, source.sheet, source.row, source.source, source.name, job.note])))
    if (details.length >= 1048576) throw new Error('Rincian penggunaan melewati kapasitas baris Excel.')
    sheets.push(table('Rincian Penggunaan', ['Jenis komponen', 'Komponen', 'Satuan komponen', 'Kode AHSP', 'Item pekerjaan/AHSP', 'Regulasi pasangan', 'Kode acuan analisis', 'Regulasi analisis', 'Sheet RAB', 'Baris RAB', 'Sel uraian RAB', 'Uraian RAB', 'Catatan'], details, [20, 60, 20, 24, 65, 26, 24, 26, 28, 16, 24, 65, 65]))
    sheets.push(table('Cakupan Komponen', ['Sheet RAB', 'Baris RAB', 'Sel uraian RAB', 'Uraian RAB', 'Kode AHSP', 'Item pekerjaan/AHSP', 'Regulasi', 'Ketersediaan rincian', 'Catatan'], usage.coverage.map(c => [c.source.sheet, c.source.row, c.source.source, c.source.name, c.item.code, c.item.name, c.item.regulation, c.available ? c.review ? 'Tersedia sebagian / perlu ditinjau' : 'Tersedia' : 'Belum tersedia', c.note]), [28, 16, 24, 65, 24, 65, 26, 36, 65]))
  }
  const zip = new PizZip(), ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  zip.file('[Content_Types].xml', `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  zip.file('_rels/.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file('xl/workbook.xml', `${declaration}<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="${rel}/styles" Target="styles.xml"/></Relationships>`)
  const formats = [0, 0, 3, 164, 4, 4, 3, 164, 0, 0, 0, 3, 164, 4, 0, 0]
  const fills = ['FF163B68', 'FFE6F0FB', 'FFE6F3EB', 'FFFFF0CE']
  zip.file('xl/styles.xml', `${declaration}<styleSheet xmlns="${ns}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.##########"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Arial"/><color rgb="FF142D50"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FF142D50"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.map(color => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/></patternFill></fill>`).join('')}</fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="16">${formats.map((format, i) => {
    const heading = i === 1 || (i >= 5 && i <= 7)
    const fill = i === 8 || i === 14 ? 3 : i === 9 || i === 15 ? 4 : i >= 10 && i <= 13 ? 5 : heading ? 2 : 0
    return `<xf numFmtId="${format}" fontId="${i >= 14 ? 2 : heading ? 1 : 0}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" wrapText="1"${format ? ' horizontal="right"' : ''}/></xf>`
  }).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`)
  sheets.forEach((s, i) => {
    const maxCols = s.widths.length
    const height = (row: ExportCell[], r: number) => Math.min(409, Math.max(s.heights?.[r] ?? 24, ...row.map((value, c) => {
      if (typeof value !== 'string') return 24
      const merge = s.merges?.find(ref => ref.startsWith(`${rabColumn(c + 1)}${r}:`))
      const end = merge ? rabColumnIndex(merge.split(':')[1].replace(/\d+$/, '')) : c + 1
      const width = s.widths.slice(c, end).reduce((n, w) => n + w, 0)
      return value.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / Math.max(1, width - 3))), 0) * 16 + 12
    })))
    const sheetData = s.rows.map((row, index) => {
      const r = index + 1, heading = s.headers.includes(r)
      return `<row r="${r}" ht="${row.length ? height(row, r) : 12}" customHeight="1">${row.map((value, c) => {
        const address = `${rabColumn(c + 1)}${r}`
        const archive = s.archiveRows?.has(r)
        if (value === null) return archive ? `<c r="${address}" s="10"/>` : ''
        if (typeof value === 'number') {
          const style = archive ? s.money?.has(address) ? 13 : Number.isInteger(value) ? 11 : 12 : s.money?.has(address) ? heading ? 5 : 4 : Number.isInteger(value) ? heading ? 6 : 2 : heading ? 7 : 3
          return `<c r="${address}" s="${style}"><v>${value}</v></c>`
        }
        return `<c r="${address}" s="${archive ? 10 : s.styles?.[address] ?? (heading ? 1 : 0)}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
      }).join('')}</row>`
    }).join('')
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `${declaration}<worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${rabColumn(maxCols)}${s.rows.length}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${s.freeze}" topLeftCell="A${s.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${s.widths.map((width, col) => `<col min="${col + 1}" max="${col + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetData}</sheetData>${s.filter ? `<autoFilter ref="${s.filter}"/>` : ''}${s.merges?.length ? `<mergeCells count="${s.merges.length}">${s.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`)
  })
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
}
