import {jsPDF} from 'jspdf'
import {
  ROLES, STEPS, accountLabel, packageEvidenceComplete, packageEvidenceLink, timeLabel, provinceName, provinceSummary,
  sortProvinces, stepSummary, summarize, workflowStatusOf, type ReportPackage, type ReportSnapshot,
} from './model'

const ink = '#1F2937', muted = '#596678', navy = '#203C65', line = '#D7E0EA'
const neutral = {fill: '#FFFFFF', color: ink}
const done = {fill: '#DCF5E6', color: '#146C3B'}
const pending = {fill: '#FFF1D6', color: '#8A5A00'}
const repair = {fill: '#FCE4E4', color: '#B42318'}
const unknown = {fill: '#F1F3F6', color: muted}
const phaseDate = new Intl.DateTimeFormat('id-ID', {dateStyle: 'long', timeZone: 'Asia/Jakarta'})

const packagePhases = [
  {step: 'pu', workflow: 'pu', next: 'bpkad', labels: ['Penyusunan PU', 'Selesai PU']},
  {step: 'bpkad', workflow: 'bpkad', next: 'apip', labels: ['Penyusunan BPKAD', 'Selesai BPKAD']},
  {step: 'apip', workflow: 'apip', next: 'ready', labels: ['Pemeriksaan APIP', 'Approval APIP']},
] as const

function packageStatus(pkg: ReportPackage) {
  const history = pkg.workflowHistory ?? []
  const cycle = history.slice(Math.max(0, history.findLastIndex(event => event.to === 'pu')))
  return packagePhases.flatMap(({step, workflow, next, labels}) => {
    const status = pkg[step]
    if (status === '-') return []
    const finished = status === 'selesai'
    const event = cycle.findLast(item => finished
      ? item.kind === 'advanced' && item.from === workflow && item.to === next
      : item.to === workflow)
    // An aggregate status timestamp cannot date individual completed stages.
    const timestamp = event?.createdAt ?? (!finished && workflowStatusOf(pkg) === workflow ? pkg.statusUpdatedAt : null)
    return [`${labels[Number(finished)]} - ${timestamp ? phaseDate.format(new Date(timestamp)) : 'Belum tercatat'}`]
  }).join(' | ')
}

export function createReportPdf(snapshot: ReportSnapshot): jsPDF {
  const pdf = new jsPDF({orientation: 'landscape', format: 'a3', unit: 'pt', compress: true})
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight()
  const margin = 30, contentWidth = width - 2 * margin, bottom = height - 35
  const summary = summarize(snapshot.document), rows = sortProvinces(snapshot.document.provinces)
  const widths = [24, 119, 150, 53, 53, 53, 42, 52, 52, 69, 69, 69, 69, 53, 56, 52, 60, 59]
  const scale = contentWidth / widths.reduce((sum, value) => sum + value, 0)
  const columns = widths.map(value => value * scale), xs = [margin]
  columns.forEach(value => xs.push(xs.at(-1)! + value))

  function font(size: number, bold = false, color = ink) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(color)
  }
  function text(value: string, x: number, y: number, size = 8, color = ink, bold = false) {
    font(size, bold, color)
    pdf.text(value, x, y)
  }
  function wrap(value: string, size: number, available: number, bold = false): string[] {
    font(size, bold)
    return pdf.splitTextToSize(value, available)
  }
  function box(x: number, y: number, w: number, h: number, fill: string, radius = 0) {
    pdf.setFillColor(fill)
    pdf.setDrawColor(line)
    pdf.setLineWidth(.4)
    if (radius) pdf.roundedRect(x, y, w, h, radius, radius, 'FD')
    else pdf.rect(x, y, w, h, 'FD')
  }
  function cell(values: string[], index: number, y: number, h: number, tone = neutral, bold = false) {
    box(xs[index], y, columns[index], h, tone.fill)
    font(7.2, bold, tone.color)
    const left = index === 1 || index === 2
    pdf.text(values, left ? xs[index] + 4 : xs[index] + columns[index] / 2,
      y + (h - (values.length - 1) * 9) / 2 + 2.5, {align: left ? 'left' : 'center', lineHeightFactor: 1.25})
  }

  const title = 'MONITORING PROGRES PENERAPAN ASB TINGKAT PROVINSI - SIPASTI PEMDA'
  const updated = `Diperbarui pada: ${timeLabel(snapshot.updated_at)}`
  text(title, margin, 43, 15, navy, true)
  text(updated, margin, 61, 9, muted)
  const metrics = [
    ...['Sekda', 'Kepala Dinas', 'Kepala BPKAD', 'APIP', 'Penyusun Harga', 'Penyusun ASB']
      .map((label, i) => ({label, count: summary.roles[i]})),
    {label: 'Total ASB', count: summary.totalPackages},
    {label: 'Paket integrasi SIPD', count: summary.integratedPackages},
  ]
  const metricGap = 7, metricWidth = (contentWidth - (metrics.length - 1) * metricGap) / metrics.length
  metrics.forEach(({label, count}, i) => {
    const x = margin + i * (metricWidth + metricGap)
    box(x, 72, metricWidth, 35, '#F6F8FB', 4)
    text(label, x + 8, 84, 7.5, muted)
    text(count.toLocaleString('id-ID'), x + 8, 100, 13, navy, true)
  })

  const groupH = 28, subH = 25
  const groups: [number, number, string, string][] = [
    [0, 0, 'No', navy], [1, 1, 'Provinsi', navy], [2, 2, 'Nama Paket', navy],
    [3, 3, 'Tahap 1\nAkun Sekda', '#315B95'], [4, 6, 'Tahap 2\nPimpinan & APIP', '#2D675C'],
    [7, 8, 'Tahap 3\nPenyusun', '#775718'], [9, 12, 'Tahap 4\nProses ASB', '#58427A'],
    [13, 14, 'Tahap 5\nIntegrasi SIPD', '#813848'], [15, 17, 'Ringkasan', '#41474F'],
  ]
  const headers = ['Status akun', 'Kepala Dinas', 'Kepala BPKAD', 'APIP', 'Harga', 'ASB',
    'PU', 'BPKAD', 'APIP', 'Perbaikan', 'Total paket', 'Siap integrasi', '% integrasi', 'Progres keseluruhan', 'Posisi akun']
  function tableHeader(top: number) {
    for (const [start, end, label, color] of groups) {
      const w = xs[end + 1] - xs[start], h = start < 3 ? groupH + subH : groupH
      box(xs[start], top, w, h, color)
      font(8, true, '#FFFFFF')
      const lines = label.split('\n')
      pdf.text(lines, xs[start] + w / 2, top + (h - (lines.length - 1) * 9) / 2 + 2.5, {align: 'center'})
    }
    headers.forEach((label, i) => {
      const index = i + 3
      cell(wrap(label, 7.2, columns[index] - 8, true), index, top + groupH, subH, {fill: '#E8EEF6', color: ink}, true)
    })
    return top + groupH + subH
  }
  let y = tableHeader(119)
  function nextTablePage() {
    pdf.addPage()
    text(title, margin, 42, 12, navy, true)
    text(updated, margin, 57, 8, muted)
    y = tableHeader(69)
  }
  rows.forEach((province, index) => {
    const info = provinceSummary(province)
    const stripe = {fill: index % 2 ? '#F8FAFC' : '#FFFFFF', color: ink}
    const phases = STEPS.map(step => {
      const state = stepSummary(province, step)
      const tone = step === 'perbaikan' && state.processing ? repair
        : state.complete ? done : state.processing || state.done ? pending : neutral
      return {label: state.label, tone}
    })
    const accountCells = ROLES.map(role => {
      const account = province.accounts[role]
      return {label: accountLabel(account), tone: account.status === 'ada' ? done : account.status === 'tc' ? pending : unknown}
    })
    const values = [
      {label: String(index + 1), tone: stripe},
      {label: provinceName(province.id, province.name), tone: stripe},
      {label: info.active.length === 1 ? info.active[0].name : `${info.active.length} Paket`, tone: stripe},
      ...accountCells, ...phases,
      {label: String(info.totalPackages), tone: stripe},
      {label: String(info.integratedPackages), tone: stripe},
      {label: info.percent === null ? 'N/D' : `${info.percent.toLocaleString('id-ID')}%`, tone: info.percent === null ? unknown : stripe},
      {label: 'N/D', tone: unknown},
      {label: info.accountStage ? `Tahap ${info.accountStage}` : 'T/C', tone: info.accountStage ? {fill: '#E3EEFD', color: '#1D4ED8'} : pending},
    ]
    const wrapped = values.map(({label}, i) => wrap(label, 7.2, columns[i] - 8, i === 1))
    const rowHeight = Math.max(14, ...wrapped.map(lines => 4 + lines.length * 9))
    if (y + rowHeight > bottom) nextTablePage()
    values.forEach(({tone}, i) => cell(wrapped[i], i, y, rowHeight, tone, i === 1))
    y += rowHeight
  })

  if (y + 38 > bottom) nextTablePage()
  const footerTone = {fill: navy, color: '#FFFFFF'}
  box(margin, y, xs[3] - margin, 18, navy)
  text('PROVINSI DENGAN AKUN TERCATAT', margin + 5, y + 12, 7, '#FFFFFF', true)
  const totals = [...summary.roles.map(String), '', '', '', '', String(summary.totalPackages),
    String(summary.integratedPackages), summary.integrationPercent === null ? 'N/D' : `${summary.integrationPercent.toLocaleString('id-ID')}%`, '', '']
  totals.forEach((value, i) => cell([value], i + 3, y, 18, footerTone, true))
  text('Tahap 4: hijau = selesai, kuning = proses atau selesai sebagian, merah = perbaikan aktif, putih = belum dimulai. T/C = data perlu dilengkapi; N/D = belum ada data.', margin, y + 31, 7.5, muted)

  const appendix = rows.map(province => ({province, ...provinceSummary(province)}))
    .filter(({province, active}) => active.length || province.notes || province.followUp || province.notesHistory?.length)
  if (appendix.length) {
    const gap = 10, cols = 3, cardWidth = (contentWidth - (cols - 1) * gap) / cols
    const pad = 10, leading = 12, appendixTop = 68
    const maxLines = Math.floor((bottom - appendixTop - 2 * pad) / leading)
    type CardLine = {value: string; size: number; color: string; bold: boolean; rule?: boolean; url?: string}
    type Card = {lines: CardLine[]; height: number}
    function detailLine(value: string, size = 8.5, color = ink, bold = false): CardLine[] {
      return wrap(value, size, cardWidth - 2 * pad, bold).map(part => ({value: part, size, color, bold}))
    }
    const spacer: CardLine = {value: '', size: 8.5, color: ink, bold: false}
    function appendixPage() {
      pdf.addPage()
      text('RINCIAN LAPORAN', margin, 43, 15, navy, true)
      text(updated, margin, 57, 8, muted)
      y = appendixTop
    }
    appendixPage()
    let gridRow: Card[] = []
    function drawGridRow() {
      const rowHeight = Math.max(...gridRow.map(card => card.height))
      if (y + rowHeight > bottom) appendixPage()
      gridRow.forEach((card, i) => {
        const x = margin + i * (cardWidth + gap)
        box(x, y, cardWidth, rowHeight, '#FFFFFF', 5)
        card.lines.forEach(({value, size, color, bold, rule, url}, j) => {
          const lineTop = y + pad + j * leading
          if (rule) {
            pdf.setDrawColor(line)
            pdf.line(x + pad, lineTop + leading / 2, x + cardWidth - pad, lineTop + leading / 2)
          } else if (value) {
            text(value, x + pad, lineTop + 9, size, color, bold)
            if(url)pdf.link(x + pad, lineTop, pdf.getTextWidth(value), leading, {url})
          }
        })
      })
      y += rowHeight + gap
      gridRow = []
    }
    for (const {province, active, totalPackages} of appendix) {
      const name = provinceName(province.id, province.name)
      const lines = [
        ...detailLine(name, 11, navy, true),
        ...detailLine(`Total Paket: ${totalPackages} (Diperbarui pada: ${timeLabel(province.totalUpdatedAt)})`, 8.5, muted),
      ]
      const blockStarts: number[] = []
      active.forEach((pkg, index) => {
        blockStarts.push(lines.length)
        const status = packageStatus(pkg)
        lines.push(index ? {...spacer, rule: true} : spacer, ...detailLine(pkg.name, 9, ink, true))
        lines.push(...detailLine(`Tanggal tercatat: ${timeLabel(pkg.createdAt)}`, 8, muted))
        const evidenceUrl = packageEvidenceComplete(pkg)?packageEvidenceLink(pkg.evidenceUrl):null
        if(evidenceUrl)lines.push({value:'Bukti dukung: Buka tautan',size:8,color:'#1D4ED8',bold:false,url:evidenceUrl})
        else lines.push(...detailLine('Bukti dukung: Belum lengkap',8,muted))
        if(pkg.picName&&pkg.picPhone)lines.push(...detailLine(`PIC Paket: ${pkg.picName} | ${pkg.picPhone}`,8,muted))
        if (status) lines.push(spacer, ...detailLine(`Status: ${status}`))
      })
      blockStarts.push(lines.length)
      lines.push(spacer, ...detailLine('Riwayat Catatan', 9, navy, true))
      const history = province.notesHistory?.length ? [...province.notesHistory].reverse()
        : province.notes || province.followUp ? [{createdAt: null, analysis: province.notes, followUp: province.followUp}] : []
      if (!history.length) lines.push(...detailLine('Belum ada catatan tersimpan.', 8.5, muted))
      history.forEach((entry, index) => {
        if (index > 0) {
          blockStarts.push(lines.length)
          lines.push(spacer)
        }
        lines.push(...detailLine(entry.createdAt ? timeLabel(entry.createdAt) : 'Tanggal catatan lama tidak tersedia', 8, muted))
        if (entry.analysis) lines.push(...detailLine(`Analisis / kendala: ${entry.analysis}`))
        if (entry.followUp) lines.push(...detailLine(`Tindak lanjut: ${entry.followUp}`))
      })
      const continued = detailLine(`${name} (lanjutan)`, 11, navy, true)
      let offset = 0
      while (offset < lines.length) {
        const heading = offset ? continued : []
        const limit = Math.min(lines.length, offset + maxLines - heading.length)
        const boundary = limit < lines.length ? blockStarts.findLast(start => start <= limit && start > offset) : undefined
        const end = boundary ?? limit
        const shown = lines.slice(offset, end)
        if (offset && shown[0]?.value === '') shown.shift()
        offset = end
        const cardLines = [...heading, ...shown]
        gridRow.push({lines: cardLines, height: 2 * pad + cardLines.length * leading})
        if (gridRow.length === cols) drawGridRow()
      }
    }
    if (gridRow.length) drawGridRow()
  }

  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page)
    text(`Dicetak ${timeLabel(new Date().toISOString())}`, margin, height - 16, 7, muted)
    text(`${page} / ${pdf.getNumberOfPages()}`, width - margin - 30, height - 16, 7, muted)
  }
  return pdf
}
