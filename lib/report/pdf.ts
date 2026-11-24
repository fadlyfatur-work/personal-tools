import {jsPDF} from 'jspdf'
import {
  ROLES, STEPS, STATUS_LABELS, PACKAGE_ENVIRONMENT_LABELS, accountLabel, timeLabel, provinceName, provinceSummary,
  sortProvinces, summarize, type PackageEnvironment, type ReportSnapshot,
} from './model'
import {exportPackageDetails,exportPackageGroups} from './export-data'

const ink = '#1F2937', muted = '#596678', navy = '#203C65', line = '#D7E0EA'
const neutral = {fill: '#FFFFFF', color: ink}
const done = {fill: '#DCF5E6', color: '#146C3B'}
const pending = {fill: '#FFF1D6', color: '#8A5A00'}
const repair = {fill: '#FCE4E4', color: '#B42318'}
const unknown = {fill: '#F1F3F6', color: muted}
const environmentColors = {staging: '#4338CA', production: '#0F6B5B'}
const packageNameForPdf = (name: string) => name.replace(/\p{Cf}/gu, '').replace(/\s+/gu, ' ').trim()
  .replaceAll('≤', '<=').replaceAll('≥', '>=')
const recordedDateForPdf = (value: string | null) => value
  ? new Intl.DateTimeFormat('id-ID', {dateStyle: 'medium', timeZone: 'Asia/Jakarta'}).format(new Date(value))
  : 'Belum tersedia'

export function createReportPdf(snapshot: ReportSnapshot): jsPDF {
  const pdf = new jsPDF({orientation: 'landscape', format: 'a3', unit: 'pt', compress: true})
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight()
  const margin = 30, contentWidth = width - 2 * margin, bottom = height - 35
  const summary = summarize(snapshot.document), rows = sortProvinces(snapshot.document.provinces)
  const widths = [24, 112, 152, 82, 60, 53, 53, 53, 42, 49, 49, 54, 54, 54, 58, 63, 49, 59, 58]
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
  function environmentBadge(environment: PackageEnvironment, x: number, top: number, cellWidth?: number) {
    const label = PACKAGE_ENVIRONMENT_LABELS[environment]
    font(7.2, true, '#FFFFFF')
    const badgeWidth = pdf.getTextWidth(label) + 9
    if (cellWidth !== undefined) x += (cellWidth - badgeWidth) / 2
    pdf.setFillColor(environmentColors[environment])
    pdf.roundedRect(x, top, badgeWidth, 10.5, 2, 2, 'F')
    pdf.text(label, x + 4.5, top + 7.7)
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

  const groupH = 28, subH = 25, accountColumn = 5, stageColumn = 11, integrationColumn = 15
  const groups: [number, number, string, string][] = [
    [0, 0, 'No', navy], [1, 1, 'Provinsi', navy], [2, 2, 'Paket Terkonfirmasi', navy],
    [3, 3, 'Status Aplikasi\nPenyusunan', navy], [4, 4, 'Bukti dukung\nmanual', navy],
    [5, 5, 'Tahap 1\nAkun Sekda', '#315B95'], [6, 8, 'Tahap 2\nPimpinan & APIP', '#2D675C'],
    [9, 10, 'Tahap 3\nPenyusun', '#775718'], [11, 14, 'Tahap 4\nProses ASB', '#58427A'],
    [15, 15, 'Tahap 5\nIntegrasi SIPD', '#813848'], [16, 18, 'Ringkasan', '#41474F'],
  ]
  const headers = ['Status akun', 'Kepala Dinas', 'Kepala BPKAD', 'APIP', 'Harga', 'ASB',
    'PU', 'BPKAD', 'APIP', 'Perbaikan', 'Siap integrasi', '% integrasi', 'Progres keseluruhan', 'Posisi tahapan']
  function tableHeader(top: number) {
    for (const [start, end, label, color] of groups) {
      const w = xs[end + 1] - xs[start], h = start < accountColumn ? groupH + subH : groupH
      box(xs[start], top, w, h, color)
      font(8, true, '#FFFFFF')
      const lines = label.split('\n')
      pdf.text(lines, xs[start] + w / 2, top + (h - (lines.length - 1) * 9) / 2 + 2.5, {align: 'center'})
    }
    headers.forEach((label, i) => {
      const index = i + accountColumn
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
  function tableValue(column: number, label: string, tone: typeof neutral, bold = false) {
    return {column, lines: wrap(label, 7.2, columns[column] - 8, bold), tone, bold}
  }
  const requiredHeight = (values: ReturnType<typeof tableValue>[]) =>
    Math.max(14, ...values.map(({lines}) => 4 + lines.length * 9))
  rows.forEach((province, index) => {
    const info = provinceSummary(province)
    const stripe = {fill: index % 2 ? '#F8FAFC' : '#FFFFFF', color: ink}
    const shared = [
      tableValue(0, String(index + 1), stripe),
      tableValue(1, provinceName(province.id, province.name), stripe, true),
      ...ROLES.map((role, i) => {
        const account = province.accounts[role]
        return tableValue(accountColumn + i, accountLabel(account), account.status === 'ada' ? done : account.status === 'tc' ? pending : unknown)
      }),
      tableValue(integrationColumn, String(info.integratedPackages), stripe),
      tableValue(integrationColumn + 1, info.percent === null ? 'N/D' : `${info.percent.toLocaleString('id-ID')}%`, info.percent === null ? unknown : stripe),
      tableValue(integrationColumn + 2, `${info.overallPercent.toLocaleString('id-ID')}%`, stripe),
      tableValue(integrationColumn + 3, info.positionStage ? `Tahap ${info.positionStage}` : 'T/C',
        info.positionStage === 4 ? {fill: '#EDE6F6', color: '#58427A'} : info.positionStage ? {fill: '#E3EEFD', color: '#1D4ED8'} : pending),
    ]
    const minimumHeight = requiredHeight(shared)
    const packageRows = (info.confirmed.length ? info.confirmed : [null]).map(pkg => {
      const values = [
        tableValue(2, pkg ? packageNameForPdf(pkg.name) : '0 Paket', stripe),
        tableValue(3, pkg?.environment ? '' : '—', stripe),
        tableValue(4, pkg ? (pkg.evidenceChecked ? 'Ada' : 'T/C') : '—', pkg ? (pkg.evidenceChecked ? done : pending) : stripe),
        ...STEPS.map((step, i) => {
          const status = pkg?.[step] ?? '-'
          const tone = status === 'selesai' ? done : status === 'proses' ? (step === 'perbaikan' ? repair : pending) : neutral
          return tableValue(stageColumn + i, status === '-' ? '—' : STATUS_LABELS[status], tone)
        }),
      ]
      return {values, height: Math.max(minimumHeight, requiredHeight(values)), environment: pkg?.environment}
    })
    const groupHeight = packageRows.reduce((sum, row) => sum + row.height, 0)
    if (y + groupHeight > bottom && groupHeight <= bottom - 69 - groupH - subH) nextTablePage()
    for (let start = 0; start < packageRows.length;) {
      if (y + packageRows[start].height > bottom) nextTablePage()
      let end = start, height = 0
      while (end < packageRows.length && y + height + packageRows[end].height <= bottom) {
        height += packageRows[end].height
        end++
      }
      for (const {column, lines, tone, bold} of shared) cell(lines, column, y, height, tone, bold)
      for (const row of packageRows.slice(start, end)) {
        for (const {column, lines, tone, bold} of row.values) cell(lines, column, y, row.height, tone, bold)
        if (row.environment) environmentBadge(row.environment, xs[3], y + (row.height - 10.5) / 2, columns[3])
        y += row.height
      }
      start = end
    }
  })

  if (y + 38 > bottom) nextTablePage()
  const footerTone = {fill: navy, color: '#FFFFFF'}
  box(margin, y, xs[accountColumn] - margin, 18, navy)
  text('PROVINSI DENGAN AKUN TERCATAT', margin + 5, y + 12, 7, '#FFFFFF', true)
  const totals = [...summary.roles.map(String), '', '', '', '',
    String(summary.integratedPackages), summary.integrationPercent === null ? 'N/D' : `${summary.integrationPercent.toLocaleString('id-ID')}%`, `${summary.overallProgressPercent?.toLocaleString('id-ID') ?? 'N/D'}%`, '']
  totals.forEach((value, i) => cell([value], i + accountColumn, y, 18, footerTone, true))
  text('Tahap 4: hijau selesai, kuning proses, merah perbaikan, putih belum dimulai. T/C perlu dilengkapi; N/D belum ada data. Bobot progres: Tahap 1-3 30%, Tahap 4 60%, integrasi 5%, lainnya 5%; paket 0% bila belum terkonfirmasi.', margin, y + 31, 7.5, muted)

  const detailStatuses = ['confirmed','checking','unconfirmed','cancelled'] as const
  const appendix = detailStatuses.map(status => ({
    status,
    label: status === 'confirmed' ? 'Terkonfirmasi' : status === 'checking' ? 'Dalam konfirmasi' : status === 'unconfirmed' ? 'Belum terkonfirmasi' : 'Dibatalkan',
    tone: status === 'confirmed' ? done : status === 'checking' ? pending : status === 'unconfirmed' ? {fill:'#FCE9E8',color:'#9B1C1C'} : {fill:'#FBE8E7',color:'#9B302A'},
    rows: rows.flatMap(province => exportPackageGroups(province)
      .filter(group => group.status === status)
      .flatMap(group => group.packages.map(pkg => ({province, pkg})))),
  })).filter(group => group.rows.length)
  if (appendix.length) {
    type DetailColumn = {label:string;weight:number}
    const leading = 10, cellPad = 4, appendixTop = 67
    function appendixPage() {
      pdf.addPage()
      text('RINCIAN LAPORAN', margin, 43, 15, navy, true)
      text(updated, margin, 57, 8, muted)
      y = appendixTop
    }
    appendixPage()
    function detailColumns(status:typeof detailStatuses[number]):DetailColumn[] {
      return status === 'confirmed'
        ? [{label:'Provinsi',weight:10},{label:'Nama paket',weight:18},{label:'Tanggal tercatat',weight:8},{label:'Aplikasi',weight:8},{label:'Status proses',weight:25},{label:'PIC paket',weight:12},{label:'Bukti dukung',weight:9},{label:'Catatan terbaru',weight:20}]
        : [{label:'Provinsi',weight:12},{label:'Nama paket',weight:24},{label:'Tanggal tercatat',weight:9},{label:'Aplikasi',weight:9},{label:'Catatan / alasan',weight:56}]
    }
    function drawDetailHeading(label:string,tone:typeof neutral,columns:DetailColumn[],columnWidths:number[],columnXs:number[]) {
      const titleHeight=19,headerHeight=25
      box(margin,y,contentWidth,titleHeight,tone.fill)
      text(label,margin+6,y+13,9,tone.color,true)
      y+=titleHeight
      columns.forEach((column,index)=>{
        box(columnXs[index],y,columnWidths[index],headerHeight,navy)
        const lines=wrap(column.label,7.5,columnWidths[index]-8,true)
        font(7.5,true,'#FFFFFF')
        pdf.text(lines,columnXs[index]+4,y+(headerHeight-(lines.length-1)*8)/2+2,{lineHeightFactor:1.15})
      })
      y+=headerHeight
    }
    function valueFor(pkg:NonNullable<ReturnType<typeof exportPackageGroups>[number]['packages'][number]>,province:ReportSnapshot['document']['provinces'][number],status:typeof detailStatuses[number]):string[] {
      const details=exportPackageDetails(pkg)
      const getDetail=(prefix:string)=>details.find(detail=>detail.startsWith(prefix))?.slice(prefix.length).trim()||''
      const common=[provinceName(province.id,province.name),packageNameForPdf(pkg.name),recordedDateForPdf(pkg.createdAt),pkg.environment?PACKAGE_ENVIRONMENT_LABELS[pkg.environment]:'-']
      if(status==='confirmed')return [...common,getDetail('Status:'),getDetail('PIC Paket:'),getDetail('Bukti dukung:'),pkg.note.trim()||'Tidak ada catatan']
      return [...common,pkg.note.trim()||pkg.inactiveReason.trim()||'-']
    }
    for(const group of appendix){
      const columns=detailColumns(group.status),weights=columns.reduce((sum,column)=>sum+column.weight,0)
      const columnWidths=columns.map(column=>contentWidth*column.weight/weights),columnXs=[margin]
      columnWidths.forEach(width=>columnXs.push(columnXs.at(-1)!+width))
      const drawHeader=()=>drawDetailHeading(group.label,group.tone,columns,columnWidths,columnXs)
      if(y+19+25+34>bottom)appendixPage()
      drawHeader()
      for(const {province,pkg} of group.rows){
        const values=valueFor(pkg,province,group.status)
        const wrapped=values.map((value,index)=>wrap(value||'-',7.5,columnWidths[index]-cellPad*2,index===1))
        const maxLineCount=Math.max(1,...wrapped.map(lines=>lines.length))
        let offset=0,rowPart=0
        while(offset<maxLineCount){
          if(y+24>bottom){appendixPage();drawHeader()}
          const availableLines=Math.max(1,Math.floor((bottom-y-8)/leading))
          const end=Math.min(maxLineCount,offset+availableLines)
          const visibleLines=wrapped.map(lines=>lines.slice(offset,end))
          const visibleCount=Math.max(1,...visibleLines.map(lines=>lines.length))
          const rowHeight=Math.max(18,visibleCount*leading+8)
          const rowFill=rowPart%2?'#F8FAFC':'#FFFFFF'
          visibleLines.forEach((lines,index)=>{
            box(columnXs[index],y,columnWidths[index],rowHeight,rowFill)
            font(7.5,index===1,ink)
            if(lines.length)pdf.text(lines,columnXs[index]+cellPad,y+cellPad+7.5,{lineHeightFactor:1.2})
          })
          y+=rowHeight
          offset=end
          rowPart++
          if(offset<maxLineCount){appendixPage();drawHeader()}
        }
      }
      y+=12
    }
  }

  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page)
    text(`Dicetak ${timeLabel(new Date().toISOString())}`, margin, height - 16, 7, muted)
    text(`${page} / ${pdf.getNumberOfPages()}`, width - margin - 30, height - 16, 7, muted)
  }
  return pdf
}
