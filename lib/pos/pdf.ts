import { jsPDF } from 'jspdf'
import { dateTime, latestSales, money, type Sale, type Settings } from './model'

type Fonts = { regular: string; bold: string }
let fontPromise: Promise<Fonts> | undefined
const mm = 72 / 25.4

function loadFonts(): Promise<Fonts> {
  if (!fontPromise) {
    const load = async (file: string) => {
      const response = await fetch(`/fonts/pos/${file}`)
      if (!response.ok) throw Error('Font struk tidak dapat dimuat.')
      const bytes = new Uint8Array(await response.arrayBuffer())
      let binary = ''
      for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192))
      return btoa(binary)
    }
    fontPromise = Promise.all([load('Inconsolata-Regular.ttf'), load('Inconsolata-Bold.ttf')]).then(([regular, bold]) => ({ regular, bold })).catch(error => { fontPromise = undefined; throw error })
  }
  return fontPromise
}

function registerFonts(pdf: jsPDF, fonts: Fonts) {
  pdf.addFileToVFS('Inconsolata-Regular.ttf', fonts.regular)
  pdf.addFileToVFS('Inconsolata-Bold.ttf', fonts.bold)
  pdf.addFont('Inconsolata-Regular.ttf', 'Receipt', 'normal')
  pdf.addFont('Inconsolata-Bold.ttf', 'Receipt', 'bold')
  pdf.setFont('Receipt', 'normal')
  pdf.setTextColor(0)
}

type Command = { kind: 'text'; y: number; value: string; size: number; bold: boolean; align: 'left' | 'center' | 'right'; x: number } | { kind: 'rule'; y: number }

export async function createReceiptPdf(sale: Sale, suppliedFonts?: Fonts): Promise<jsPDF> {
  const fonts = suppliedFonts || await loadFonts()
  const width = 80 * mm
  const margin = 4 * mm
  const usable = width - margin * 2
  const measure = new jsPDF({ unit: 'pt', format: [width, 600], compress: true })
  registerFonts(measure, fonts)
  const commands: Command[] = []
  let y = 5 * mm
  function text(value: string, size = 8.4, bold = false, align: 'left' | 'center' = 'left') {
    measure.setFont('Receipt', bold ? 'bold' : 'normal'); measure.setFontSize(size)
    const lines: string[] = measure.splitTextToSize(value, usable)
    for (const line of lines) { commands.push({ kind: 'text', y, value: line, size, bold, align, x: align === 'center' ? width / 2 : margin }); y += size * 1.32 }
  }
  function pair(label: string, value: string, size = 8.5, bold = false) {
    measure.setFont('Receipt', bold ? 'bold' : 'normal'); measure.setFontSize(size)
    const available = usable - measure.getTextWidth(value) - 8
    const labels: string[] = measure.splitTextToSize(label, Math.max(20, available))
    for (const line of labels) { commands.push({ kind: 'text', y, value: line, size, bold, align: 'left', x: margin }); if (line !== labels.at(-1)) y += size * 1.4 }
    commands.push({ kind: 'text', y, value, size, bold, align: 'right', x: width - margin })
    y += size * 1.4
  }
  function rule() { y += 3; commands.push({ kind: 'rule', y }); y += 10 }
  const number = (value: number) => value.toLocaleString('id-ID')
  text(sale.store.name, 12, true, 'center'); y += 1
  if (sale.store.address) text(sale.store.address, 7.6, false, 'center')
  if (sale.store.phone) text(sale.store.phone, 7.6, false, 'center')
  y += 5; text('STRUK PENJUALAN', 8.3, true, 'center'); rule()
  text(`No.     : ${sale.invoice}`, 8)
  text(`Tanggal : ${dateTime(sale.createdAt)}`, 8)
  text(`Kasir   : ${sale.cashier}`, 8)
  text('Bayar   : TUNAI', 8)
  rule(); text('RINCIAN BELANJA (Rp)', 7.6); y += 4
  for (const item of sale.items) {
    text(item.name, 8.8, true)
    pair(`  ${item.qty} x ${number(item.price)}`, number(item.qty * item.price), 8.3)
    y += 5
  }
  rule(); text(`${sale.items.length} jenis barang / ${sale.items.reduce((sum, item) => sum + item.qty, 0)} item`, 8)
  y += 7; pair('Subtotal', number(sale.total)); pair('Diskon', '0')
  y += 3; pair('TOTAL', `Rp${number(sale.total)}`, 11.2, true)
  y += 3; pair('Tunai', `Rp${number(sale.received)}`); pair('Kembali', `Rp${number(sale.change)}`, 8.5, true)
  rule(); y += 2
  text('Terima kasih telah berbelanja.', 7.5, false, 'center')
  text('Simpan struk ini sebagai referensi.', 7.5, false, 'center')
  y += 10; text('CONTOH STRUK - DEMO POS', 7, true, 'center'); text('Bukan bukti pembayaran yang sah.', 6.7, false, 'center')

  const segment = 2700
  const pageCount = Math.floor((y - margin) / segment) + 1
  const pageHeight = Math.min(y + 4 * mm, segment + 35)
  const pdf = new jsPDF({ unit: 'pt', format: [width, pageHeight], compress: true })
  registerFonts(pdf, fonts)
  pdf.setProperties({ title: `Struk ${sale.invoice}`, author: 'Project POS', subject: 'Transaksi simulasi - data browser' })
  for (let index = 1; index < pageCount; index++) pdf.addPage([width, Math.max(width, Math.min(y - index * segment + 4 * mm + 20, segment + 35))])
  for (const command of commands) {
    const page = Math.floor((command.y - margin) / segment)
    pdf.setPage(page + 1)
    const offset = command.y - page * segment + (page > 0 ? 20 : 0)
    if (command.kind === 'rule') {
      pdf.setDrawColor(0); pdf.setLineWidth(.45); pdf.setLineDashPattern([2, 2], 0)
      pdf.line(margin, offset, width - margin, offset); pdf.setLineDashPattern([], 0)
    } else {
      pdf.setFont('Receipt', command.bold ? 'bold' : 'normal'); pdf.setFontSize(command.size)
      pdf.text(command.value, command.x, offset, { align: command.align })
    }
  }
  for (let page = 2; page <= pageCount; page++) { pdf.setPage(page); pdf.setFont('Receipt', 'normal'); pdf.setFontSize(7); pdf.text('STRUK LANJUTAN - DEMO POS', width / 2, 12, { align: 'center' }) }
  pdf.setFont('Receipt', 'normal')
  return pdf
}

export async function downloadReceipt(sale: Sale) {
  const pdf = await createReceiptPdf(sale)
  pdf.save(`struk-${sale.invoice.replaceAll('/', '-')}.pdf`)
}

export async function createReportPdf(settings: Settings, sales: Sale[], start: string, end: string, suppliedFonts?: Fonts): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  registerFonts(pdf, suppliedFonts || await loadFonts())
  const right = 559
  let y = 40
  function text(value: string, x = 36, size = 9, bold = false) { pdf.setFont('Receipt', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.text(value, x, y) }
  function header() {
    y = 40; text('LAPORAN PENJUALAN - DEMO POS', 36, 16, true)
    y += 22; pdf.setFontSize(11); const storeLines: string[] = pdf.splitTextToSize(settings.name, 520); for (const line of storeLines) { text(line, 36, 11, true); y += 14 }
    text(`Periode: ${start} s.d. ${end}`); y += 18
    text(`Transaksi: ${sales.length}  |  Penjualan: ${money(sales.reduce((sum, sale) => sum + sale.total, 0))}`, 36, 10, true)
    y += 24; text('Invoice'); text('Waktu', 223); text('Kasir', 343); text('Total (Rp)', 495); y += 8
    pdf.setDrawColor(150); pdf.line(36, y, right, y); y += 18
  }
  header()
  for (const sale of latestSales(sales)) {
    pdf.setFont('Receipt', 'normal'); pdf.setFontSize(9)
    const cashiers: string[] = pdf.splitTextToSize(sale.cashier, 135)
    const height = Math.max(1, cashiers.length) * 12 + 14
    if (y + height > 780) { pdf.addPage(); header() }
    text(sale.invoice, 36, 8)
    text(dateTime(sale.createdAt), 223, 8)
    for (let index = 0; index < cashiers.length; index++) { pdf.text(cashiers[index], 343, y + index * 12) }
    pdf.setFontSize(9); pdf.text(sale.total.toLocaleString('id-ID'), right, y, { align: 'right' })
    y += height; pdf.setDrawColor(220); pdf.line(36, y - 10, right, y - 10)
  }
  if (!sales.length) { text('Belum ada transaksi pada periode ini.'); y += 25 }
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.text('Data simulasi dari browser. Bukan laporan operasional toko.', 36, 814); pdf.text(`${page} / ${pdf.getNumberOfPages()}`, right, 814, { align: 'right' }) }
  return pdf
}

export async function downloadReport(settings: Settings, sales: Sale[], start: string, end: string) {
  const pdf = await createReportPdf(settings, sales, start, end)
  pdf.save(`laporan-pos-${start}-${end}.pdf`)
}
