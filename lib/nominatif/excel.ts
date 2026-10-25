import PizZip from 'pizzip'
import original from './template-original.json'
import { documentErrors, type Calculation, type Trip } from './calculate'

type Value = string | number
type Cell = Value | { formula: string; value: Value }
type Layout = { xml: string; index: number; extra?: number; at?: number }
const source = new PizZip(original.archive, { base64: true })
const templates: Record<string, Layout> = Object.fromEntries(original.sheetNames.map((name, i) => [name, { xml: source.file(`xl/worksheets/sheet${i + 1}.xml`)!.asText(), index: i + 1 }]))
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const escape = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const column = (index: number): string => index > 26 ? column(Math.floor((index - 1) / 26)) + String.fromCharCode(65 + (index - 1) % 26) : String.fromCharCode(64 + index)
const serial = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000) + 25569
export const dateLabel = (date: string) => date ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : ''

export function terbilang(value: number): string {
  const words = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
  const spell = (n: number): string => {
    if (n < 12) return words[n]
    if (n < 20) return `${spell(n - 10)} belas`
    if (n < 100) return `${spell(Math.floor(n / 10))} puluh ${spell(n % 10)}`.trim()
    if (n < 200) return `seratus ${spell(n - 100)}`.trim()
    if (n < 1000) return `${spell(Math.floor(n / 100))} ratus ${spell(n % 100)}`.trim()
    if (n < 2000) return `seribu ${spell(n - 1000)}`.trim()
    for (const [unit, label] of [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1e3, 'ribu']] as const) {
      if (n >= unit) return `${spell(Math.floor(n / unit))} ${label} ${spell(n % unit)}`.trim()
    }
    return ''
  }
  return `${value === 0 ? 'nol' : spell(value)} rupiah`
}

function encodeCell(ref: string, value: Cell, style: number) {
  const attrs = `r="${ref}" s="${style}"`
  if (value === '') return `<c ${attrs}/>`
  if (typeof value === 'number') return `<c ${attrs}><v>${value}</v></c>`
  if (typeof value === 'object') return `<c ${attrs}${typeof value.value === 'string' ? ' t="str"' : ''}><f>${escape(value.formula)}</f><v>${typeof value.value === 'string' ? escape(value.value) : value.value}</v></c>`
  return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${escape(value)}</t></is></c>`
}

function renderSheet(layout: Layout, values: Record<string, Cell>) {
  const pending = new Map(Object.entries(values))
  let xml = layout.xml.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g, cell => {
    const ref = cell.match(/\br="([A-Z]+\d+)"/)![1]
    if (!pending.has(ref)) return cell
    const value = pending.get(ref)!
    pending.delete(ref)
    return encodeCell(ref, value, Number(cell.match(/\bs="(\d+)"/)?.[1] || 0))
  })
  const byRow = new Map<number, string[]>()
  for (const [ref, value] of pending) {
    const row = Number(ref.replace(/\D/g, ''))
    const cells = byRow.get(row) || []
    cells.push(encodeCell(ref, value, 0)); byRow.set(row, cells)
  }
  xml = xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g, (row, n) => {
    const extra = byRow.get(Number(n)); byRow.delete(Number(n))
    if (!extra) return row
    const opening = row.slice(0, row.indexOf('>') + 1).replace(/\/>$/, '>')
    const cells = [...row.matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].map(m => m[0]).concat(extra)
    const index = (cell: string) => Array.from(cell.match(/r="([A-Z]+)/)![1]).reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)
    cells.sort((a, b) => index(a) - index(b))
    return opening + cells.join('') + '</row>'
  })
  if (byRow.size) xml = xml.replace('</sheetData>', [...byRow].sort(([a], [b]) => a - b).map(([r, cells]) => `<row r="${r}">${cells.join('')}</row>`).join('') + '</sheetData>')
  return xml
}

function expand(layout: Layout, at: number, count: number): Layout {
  if (count === 1) return layout
  const extra = count - 1
  const shift = (ref: string) => ref.replace(/\d+/g, n => String(Number(n) > at ? Number(n) + extra : Number(n)))
  let xml = layout.xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g, (row, n) => Number(n) === at
    ? Array.from({ length: count }, (_, i) => row.replace(/\br="([A-Z]*)(\d+)"/g, (_: string, col: string) => `r="${col}${at + i}"`)).join('')
    : Number(n) > at ? row.replace(/\br="([A-Z]*)(\d+)"/g, (_: string, col: string, r: string) => `r="${col}${Number(r) + extra}"`) : row)
  xml = xml.replace(/<mergeCell ref="([^"]+)"\/>/g, (tag, ref: string) => ref.split(':').every(c => Number(c.replace(/\D/g, '')) === at)
    ? Array.from({ length: count }, (_, i) => tag.replace(/\d+/g, String(at + i))).join('') : `<mergeCell ref="${shift(ref)}"/>`)
  xml = xml.replace(/<mergeCells count="\d+"/, `<mergeCells count="${[...xml.matchAll(/<mergeCell ref=/g)].length}"`)
  return { ...layout, xml, extra, at }
}

export function createWorkbook(trip: Trip, result: Calculation): Uint8Array {
  if (result.total === null) throw new Error('Lengkapi input sebelum ekspor.')
  const errors = documentErrors(trip, result.people)
  if (errors.length) throw new Error(errors.join('\n'))
  const zip = new PizZip(original.archive, { base64: true })
  const sheets: { name: string; xml: string; layout: Layout }[] = []
  const add = (name: string, layout: Layout, values: Record<string, Cell>) => sheets.push({ name: name === 'DATA' ? ' DATA' : name, xml: renderSheet(layout, values), layout })
  add('XXXXX', templates.XXXXX, {})
  add('00000', templates['00000'], {})
  const formula = (expression: string, value: Value): Cell => /^DATA!H\d+$/.test(expression) ? value : ({ formula: expression.replace(/\bDATA!/g, "' DATA'!"), value })
  const ppkNip = `NIP. ${trip.signerNip}`, treasurerNip = `NIP. ${trip.treasurerNip}`
  const mode = { plane: 'Pesawat ekonomi', train: 'Kereta api', land: 'Kendaraan darat', sea: 'Kapal / transportasi air' }[trip.activity === 'localShort' ? 'land' : trip.transport]
  const personData = result.people.map(p => {
    const lines = result.lines.filter(l => l.personId === p.id)
    const amount = (name: string) => lines.filter(l => l.component === name).reduce((sum, l) => sum + l.amount, 0)
    const dailyLines = lines.filter(l => l.component.startsWith('Uang harian'))
    const daily = dailyLines.reduce((sum, l) => sum + l.amount, 0)
    const main = lines.find(l => l.component === 'Transportasi utama PP' || l.component === 'Tiket pesawat ekonomi PP')!
    const hotel = lines.find(l => l.component === 'Penginapan')!
    const representation = lines.find(l => l.component === 'Uang representasi')!
    const meal = amount('Potongan uang makan'), snack = amount('Potongan uang snack')
    const taxi = amount('Transfer di kota asal') + amount('Transfer di kota tujuan') + amount('Transpor lokal riil')
    return { p, daily, dailyLines, main, hotel, representation, meal, snack, taxi, total: lines.reduce((sum, l) => sum + l.amount, 0) }
  })
  const values: Record<string, Cell> = {}
  personData.forEach((d, i) => {
    const r = i + 3
    const daily = d.dailyLines.find(l => l.component !== 'Uang harian kegiatan') || { rate: 0, quantity: 0, amount: 0 }
    const meeting = d.dailyLines.find(l => l.component === 'Uang harian kegiatan') || { rate: 0, quantity: 0, amount: 0 }
    const row: Cell[] = [i + 1, trip.budget!, trip.sptNumber!, dateLabel(trip.sptDate!), d.p.spdNumber?.trim() || trip.documentNumber!, dateLabel(trip.documentDate!), d.p.name, d.p.nip, d.p.jobTitle!, d.p.grade, d.p.position, result.days, trip.origin, trip.destination, trip.purpose, serial(trip.start), formula(`P${r}+L${r}-1`, serial(trip.end)), mode, d.main.amount, daily.rate, daily.quantity, Number(d.p.mealRate || 0), Number(d.p.mealDays || 0), formula(`-V${r}*W${r}`, d.meal), Number(d.p.snackRate || 0), Number(d.p.snackDays || 0), formula(`-Y${r}*Z${r}`, d.snack), formula(`T${r}*U${r}+X${r}+AA${r}`, daily.amount + d.meal + d.snack), meeting.rate, meeting.quantity, formula(`AC${r}*AD${r}`, meeting.amount), 0, 0, 0, d.representation.rate, d.representation.quantity, formula(`AI${r}*AJ${r}`, d.representation.amount), d.hotel.rate, d.hotel.quantity, result.lines.find(l => l.personId === d.p.id && l.component === 'Transpor lokal riil')?.amount || 0, formula(`AL${r}*AM${r}`, d.hotel.amount), result.lines.find(l => l.personId === d.p.id && l.component === 'Transfer di kota asal')?.amount || 0, result.lines.find(l => l.personId === d.p.id && l.component === 'Transfer di kota tujuan')?.amount || 0, formula(`AP${r}+AQ${r}+AN${r}`, d.taxi), formula(`AB${r}+AE${r}+AH${r}+S${r}+AK${r}+AO${r}+AR${r}`, d.total), 0, formula(`AS${r}`, d.total), formula(`T${r}*U${r}+AE${r}+AH${r}`, d.daily), result.ruleName, trip.mode === 'estimate' ? 'Estimasi pengajuan' : 'Realisasi biaya', Number(d.p.advance || 0), trip.satker!, trip.output || '', trip.signer!, trip.signerNip!, trip.treasurer!, trip.treasurerNip!, trip.issueCity!]
    row.forEach((v, c) => { values[`${column(c + 1)}${r}`] = v })
  })
  add('DATA', templates[' DATA'], values)
  const count = result.people.length, lsTotal = 14 + count, kpnTotal = 15 + count
  const ls: Record<string, Cell> = { C2: trip.purpose, C3: trip.output || '', C4: trip.satker!, C5: trip.budget!, B8: `Bendahara Pengeluaran ${trip.satker}`, B9: trip.bank || '' }
  const kpn: Record<string, Cell> = { D4: trip.purpose, D5: trip.satker!, D6: trip.budget!, B9: `Bendahara Pengeluaran ${trip.satker}`, B10: trip.bank || '' }
  personData.forEach((d, i) => {
    const r = i + 3, n = i + 14, k = i + 15
    const data = (col: string, value: Value) => formula(`DATA!${col}${r}`, value)
    const daily = d.dailyLines.find(l => l.component === 'Uang harian kegiatan')
    Object.assign(ls, { [`A${n}`]: i + 1, [`B${n}`]: data('G', d.p.name), [`C${n}`]: data('H', d.p.nip), [`E${n}`]: data('J', d.p.grade), [`F${n}`]: data('M', trip.origin), [`H${n}`]: data('N', trip.destination), [`I${n}`]: data('L', result.days), [`J${n}`]: daily?.rate || 0, [`K${n}`]: 0, [`L${n}`]: data('AE', daily?.amount || 0), [`M${n}`]: data('AV', d.daily), [`N${n}`]: data('X', d.meal), [`O${n}`]: data('AA', d.snack), [`P${n}`]: formula(`M${n}+N${n}+O${n}`, d.daily + d.meal + d.snack), [`Q${n}`]: data('S', d.main.amount), [`R${n}`]: data('AK', d.representation.amount), [`S${n}`]: data('AO', d.hotel.amount), [`T${n}`]: data('AR', d.taxi), [`U${n}`]: formula(`SUM(P${n}:T${n})`, d.total), [`V${n}`]: data('P', serial(trip.start)), [`W${n}`]: data('Q', serial(trip.end)), [`X${n}`]: data('E', d.p.spdNumber?.trim() || trip.documentNumber!) })
    Object.assign(kpn, { [`A${k}`]: i + 1, [`B${k}`]: data('G', d.p.name), [`D${k}`]: data('H', d.p.nip), [`E${k}`]: data('J', d.p.grade), [`H${k}`]: data('M', trip.origin), [`J${k}`]: data('N', trip.destination), [`K${k}`]: data('P', serial(trip.start)), [`L${k}`]: data('Q', serial(trip.end)), [`M${k}`]: data('L', result.days), [`N${k}`]: formula(`'nominatif-LS'!U${n}`, d.total) })
  })
  for (const col of ['L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U']) ls[`${col}${lsTotal}`] = formula(`SUM(${col}14:${col}${lsTotal - 1})`, personData.reduce((sum, _, i) => { const cell = ls[`${col}${i + 14}`]; return sum + Number(typeof cell === 'object' ? cell.value : cell) }, 0))
  Object.assign(ls, { [`U${20 + count}`]: trip.issueCity!, [`V${20 + count}`]: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(trip.documentDate!)), [`W${20 + count}`]: Number(trip.documentDate!.slice(0, 4)), [`U${21 + count}`]: 'Pejabat Pembuat Komitmen', [`U${23 + count}`]: trip.signer!, [`U${24 + count}`]: ppkNip })
  Object.assign(kpn, { [`N${kpnTotal}`]: formula(`SUM(N15:N${kpnTotal - 1})`, result.total), [`J${17 + count}`]: trip.issueCity!, [`K${17 + count}`]: new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(trip.documentDate!)), [`M${17 + count}`]: Number(trip.documentDate!.slice(0, 4)), [`J${23 + count}`]: trip.signer!, [`J${24 + count}`]: ppkNip })
  add('nominatif-LS', expand(templates['nominatif-LS'], 14, count), ls)
  add('nominatif-KPN', expand(templates['nominatif-KPN'], 15, count), kpn)

  // Individual document sheets are filled below from their DATA row.
  personData.forEach((d, i) => {
    const r = i + 3, suffix = i ? `-${i + 1}` : ''
    const data = (col: string, value: Value) => formula(`DATA!${col}${r}`, value)
    const spd = d.p.spdNumber?.trim() || trip.documentNumber!, employeeNip = `NIP. ${d.p.nip}`
    const spdValues: Record<string, Cell> = { AG7: i + 1, AC8: data('E', spd), U12: `Pejabat Pembuat Komitmen, ${trip.satker}`, U15: data('G', d.p.name), W16: data('H', d.p.nip), V18: data('J', d.p.grade), V20: data('I', d.p.jobTitle!), U25: data('O', trip.purpose), U29: data('R', mode), V31: data('M', trip.origin), V32: data('N', trip.destination), V34: data('L', result.days), W34: `(${terbilang(result.days).replace(' rupiah', '')}) hari`, V35: data('P', serial(trip.start)), V36: data('Q', serial(trip.end)), V47: trip.satker!, V50: data('B', trip.budget!), U52: `${trip.sptNumber} / ${dateLabel(trip.sptDate!)}`, AH55: trip.issueCity!, AH56: dateLabel(trip.documentDate!), AF66: data('M', trip.origin), AF67: data('N', trip.destination), AF68: data('P', serial(trip.start)), M107: data('M', trip.origin), M109: data('Q', serial(trip.end)) }
    // Endorsements for arrival/departure stay blank for the officers who witness them.
    for (const row of [59, 71, 114]) spdValues[`V${row}`] = 'Pejabat Pembuat Komitmen'
    spdValues.D113 = 'Pejabat Pembuat Komitmen'
    for (const ref of ['V62', 'V75', 'C119', 'V119']) spdValues[ref] = trip.signer!
    for (const ref of ['V63', 'V76', 'C120', 'V120']) spdValues[ref] = ppkNip
    spdValues.AS3 = i + 1
    spdValues.V23 = d.p.costLevel || ''
    add(`SPPD-Form${suffix}`, templates['SPPD-Form'], spdValues)
    const daily = d.dailyLines[0], mixed = d.dailyLines.length > 1
    const receipt: Record<string, Cell> = { AB7: data('B', trip.budget!), AB9: trip.year, N15: 'Pejabat Pembuat Komitmen Satuan Kerja', N16: trip.satker!, N17: data('AS', d.total), N20: data('E', spd), N21: dateLabel(trip.documentDate!), N22: `${trip.origin} – ${trip.destination}`, J24: terbilang(d.total).toUpperCase(), AA27: `${trip.issueCity},`, AD27: dateLabel(trip.documentDate!), B32: trip.signer!, B33: ppkNip, W32: d.p.name, W33: employeeNip, O37: 'Setuju dan lunas dibayar tanggal: ................................', N41: trip.treasurer!, O42: treasurerNip, V47: data('E', spd), V48: dateLabel(trip.documentDate!), B53: 1, B54: 2, B55: 3, B56: 4, B57: 5, B58: 6, B59: 7, X53: data('S', d.main.amount), AF53: mode, M54: mixed ? 1 : daily.quantity, Q54: mixed ? d.daily : daily.rate, AF54: mixed ? `${result.days} hari, tarif kegiatan + perjalanan` : `${daily.quantity} hari`, X54: formula('M54*Q54', d.daily), M55: data('Z', Number(d.p.snackDays || 0)), Q55: -Number(d.p.snackRate || 0), X55: formula('M55*Q55', d.snack), M56: data('W', Number(d.p.mealDays || 0)), Q56: -Number(d.p.mealRate || 0), X56: formula('M56*Q56', d.meal), M57: data('AJ', d.representation.quantity), Q57: data('AI', d.representation.rate), X57: formula('M57*Q57', d.representation.amount), X58: data('AR', d.taxi), M59: data('AM', d.hotel.quantity), Q59: data('AL', d.hotel.rate), X59: formula('M59*Q59', d.hotel.amount), I60: dateLabel(trip.start), Q60: dateLabel(trip.end), X61: formula('SUM(X53:X59)', d.total), F63: terbilang(d.total).toUpperCase(), Y66: `${trip.issueCity},`, AB66: dateLabel(trip.documentDate!), D69: formula('X61', d.total), W69: formula('X61', d.total), C74: trip.treasurer!, D75: treasurerNip, W74: d.p.name, W75: employeeNip, K80: formula('X61', d.total), K82: data('AY', Number(d.p.advance || 0)), K84: formula('K80-K82', d.total - Number(d.p.advance || 0)), R92: trip.signer!, R93: ppkNip }
    receipt.A4 = i + 1
    receipt.AN10 = formula('N17', d.total)
    receipt.J53 = `${trip.origin}  - ${trip.destination}`
    receipt.AB8 = trip.receiptNumber || ''
    receipt.Q55 = formula(`-DATA!Y${r}`, -Number(d.p.snackRate || 0))
    receipt.Q56 = formula(`-DATA!V${r}`, -Number(d.p.mealRate || 0))
    receipt.Q54 = mixed ? data('AV', d.daily) : data(daily.component === 'Uang harian kegiatan' ? 'AC' : 'T', daily.rate)
    receipt.M54 = mixed ? 1 : data(daily.component === 'Uang harian kegiatan' ? 'AD' : 'U', daily.quantity)
    add(`Kwitansi${suffix}`, templates.Kwitansi, receipt)
    if (i === 0) {
      const control: Record<string, Cell> = { G5: trip.budget!, G6: trip.fileType || 'Perjalanan dinas', G7: `Bendahara Pengeluaran ${trip.satker}`, G8: trip.address || '', G9: trip.npwp || '', G11: trip.purpose, I13: formula(`'nominatif-LS'!U${lsTotal}`, result.total!), I14: 0, I15: 0, I16: formula('SUM(I14:I15)', 0), I17: formula('I13-I16', result.total!) }
      control.I14 = Number(trip.ppn || 0)
      control.I15 = Number(trip.pph || 0)
      control.I16 = formula('SUM(I14:I15)', Number(trip.ppn || 0) + Number(trip.pph || 0))
      control.I17 = formula('I13-I16', result.total! - Number(trip.ppn || 0) - Number(trip.pph || 0))
      control.B22 = personData.map(d => d.p.name).join(', ')
      add('Kartu Kendali TA.2018', templates['Kartu Kendali TA.2018'], control)
    }
    const envelope: Record<string, Cell> = { A1: i + 1, E2: spd, C3: `${trip.origin} – ${trip.destination} / ${dateLabel(trip.start)} – ${dateLabel(trip.end)}`, C5: d.p.name, C6: 'RINCIAN BIAYA', D8: 'Uang Transport', O8: data('S', d.main.amount), U8: formula('O8', d.main.amount), D9: 'Uang Harian', L9: 1, O9: data('AV', d.daily), U9: formula('L9*O9', d.daily), D10: 'Potongan makan / snack', L10: 1, O10: formula(`DATA!X${r}+DATA!AA${r}`, d.meal + d.snack), U10: formula('L10*O10', d.meal + d.snack), D11: 'Uang Representasi', L11: data('AJ', d.representation.quantity), O11: data('AI', d.representation.rate), U11: formula('L11*O11', d.representation.amount), D12: 'Angkutan Lainnya (Taksi)', O12: data('AR', d.taxi), U12: formula('O12', d.taxi), D13: 'Uang Penginapan ', L13: data('AM', d.hotel.quantity), O13: data('AL', d.hotel.rate), U13: formula('L13*O13', d.hotel.amount), U14: formula('SUM(U8:U13)', d.total) }
    add(`Amplop${suffix}`, templates.Amplop, envelope)
    const lamp: Record<string, Cell> = { I2: i + 1, D13: data('G', d.p.name), D14: data('H', d.p.nip), D15: data('I', d.p.jobTitle!), D19: dateLabel(trip.documentDate!), D20: data('E', spd), D27: 'Rincian transportasi tanpa bukti pengeluaran', B48: trip.signer!, B49: ppkNip, G42: `${trip.issueCity},`, H42: dateLabel(trip.documentDate!), G48: d.p.name, G49: employeeNip }
    for (const [j, expense] of (d.p.expenses || []).entries()) Object.assign(lamp, { [`B${28 + j}`]: j + 1, [`D${28 + j}`]: expense.description, [`H${28 + j}`]: Number(expense.amount) })
    lamp.H33 = formula('SUM(H28:H31)', (d.p.expenses || []).reduce((sum, e) => sum + Number(e.amount), 0))
    add(`Lamp-Transport${suffix}`, templates['Lamp-Transport'], lamp)
  })
  let workbook = source.file('xl/workbook.xml')!.asText()
  const definedNames = [...workbook.matchAll(/<definedName\b[^>]*>[\s\S]*?<\/definedName>/g)].map(m => m[0])
  const names = sheets.flatMap((s, i) => definedNames.filter(n => n.includes(`localSheetId="${s.layout.index - 1}"`)).map(n => {
    let value = n.replace(/localSheetId="\d+"/, `localSheetId="${i}"`).split(escape(original.sheetNames[s.layout.index - 1])).join(escape(s.name))
    if (s.layout.extra) value = value.replace(/\$(\d+)/g, (_: string, r: string) => `$${Number(r) > s.layout.at! ? Number(r) + s.layout.extra! : r}`)
    return value
  }))
  workbook = workbook.replace(/<sheets>[\s\S]*?<\/sheets>/, `<sheets>${sheets.map((s, i) => `<sheet name="${escape(s.name)}" sheetId="${i + 1}"${i < 2 ? ' state="veryHidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets>`)
    .replace(/<definedNames>[\s\S]*?<\/definedNames>/, `<definedNames>${names.join('')}</definedNames>`)
    .replace(/<calcPr\b[^>]*\/>/, '<calcPr calcId="191029" fullCalcOnLoad="1"/>')
  zip.file('xl/workbook.xml', workbook)
  zip.file('xl/_rels/workbook.xml.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/><Relationship Id="theme" Type="${rel}/theme" Target="theme/theme1.xml"/></Relationships>`)
  let types = source.file('[Content_Types].xml')!.asText()
  sheets.forEach((s, i) => {
    const path = `xl/worksheets/sheet${i + 1}.xml`
    zip.file(path, s.xml)
    const rels = source.file(`xl/worksheets/_rels/sheet${s.layout.index}.xml.rels`)
    if (rels) {
      let relationships = rels.asText()
      if (i >= 10) {
        // Drawing and control parts belong to one sheet; copy their dependency tree.
        const copies = new Map<string, string>()
        const copy = (oldPath: string): string => {
          if (copies.has(oldPath)) return copies.get(oldPath)!
          const newPath = oldPath.replace(/([^/]+)$/, `employee${i + 1}-$1`)
          copies.set(oldPath, newPath)
          zip.file(newPath, source.file(oldPath)!.asUint8Array())
          const contentType = source.file('[Content_Types].xml')!.asText().match(new RegExp(`<Override PartName="/${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`))?.[0]
          if (contentType) types = types.replace('</Types>', contentType.replace(oldPath, newPath) + '</Types>')
          const oldRels = oldPath.replace(/([^/]+)$/, '_rels/$1.rels')
          if (source.file(oldRels)) {
            const xml = source.file(oldRels)!.asText().replace(/Target="\.\.\/([^"]+)"/g, (_: string, target: string) => `Target="../${copy(`xl/${target}`).slice(3)}"`)
            zip.file(newPath.replace(/([^/]+)$/, '_rels/$1.rels'), xml)
          }
          return newPath
        }
        relationships = relationships.replace(/Target="\.\.\/([^"]+)"/g, (_: string, target: string) => `Target="../${copy(`xl/${target}`).slice(3)}"`)
      }
      zip.file(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, relationships)
    }
    if (i >= 10) types = types.replace('</Types>', `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`)
  })
  zip.file('[Content_Types].xml', types)
  return zip.generate({ type: 'uint8array', compression: 'DEFLATE' })
}
