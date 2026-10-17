import { AHSP_ACTIVE_REGULATIONS, parseAhspSearch } from './ahsp'

export const RAB_MAX_ROWS = 1000
export const RAB_MAX_SHEETS = 3
export const RAB_MAX_BYTES = 10 * 1024 * 1024
export const RAB_FIELDS = { name: 'Uraian pekerjaan', code: 'Kode', unit: 'Satuan', volume: 'Volume', price: 'Harga Satuan (Rupiah)', total: 'Total Harga (Rupiah)' } as const
export type RabCandidate = { id: string; code: string; name: string; unit: string; regulation: string; regulation_status: string }
export type RabCell = { text: string; value: number | null; formula: boolean; error?: boolean }
export type RabMerge = { from: number; to: number; left: number; right: number; ref: string }
export type RabMapping = { name: string; code: string; unit: string; volume: string; price: string; total: string; start: number }
export type RabSheet = { name: string; hidden: boolean; lastRow: number; cells: Record<string, RabCell>; merges: RabMerge[]; columns: string[]; mapping: RabMapping }
export type RabRow = {
  id: string; sheet: string; row: number; source: string; originalName: string; name: string; code: string; unit: string;
  volume: number | null; price: number | null; total: number | null;
  raw: Record<string, string>; refs: Record<string, string>; issues: string[]; reviewed: boolean;
  excluded: boolean; exclusion: string; status: 'pending' | 'review' | 'missing' | 'matched';
  candidate: RabCandidate | null; candidates: RabCandidate[]; manual: boolean; resolution: string;
  history: string[]; noMatch?: boolean;
}
export const rabText = (value: string) => value.normalize('NFKC').toLocaleLowerCase('id-ID').replace(/\s+/g, ' ').trim()
const rabUnitAliases = new Map([
  ['lumsum', 'ls'], ['lumpsum', 'ls'], ['lumsun', 'ls'],
  ['meterkubik', 'm3'], ['meterpersegi', 'm2'],
  ['m1', 'm'], ["m'", 'm'], ['meter', 'm'], ['meterpanjang', 'm'],
  ['kilogram', 'kg'], ['bh', 'buah'],
  ['org-bln', 'ob'], ['org/bln', 'ob'], ['orangbulan', 'ob'], ['orang-bulan', 'ob'],
  ['orang', 'org'], ['psg', 'pasang'],
])
export const rabUnit = (value: string) => {
  const unit = rabText(value).replace(/[.\s]/g, '')
  return rabUnitAliases.get(unit) ?? unit
}
export const rabPrimary = (candidate: RabCandidate) => (AHSP_ACTIVE_REGULATIONS as readonly string[]).includes(candidate.regulation)
export const rabPercent = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const rabMoney = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const rabRowKey = (row: Pick<RabRow, 'id' | 'name' | 'code'>) => JSON.stringify(!row.name.trim() || row.name === 'Uraian belum terbaca' ? [row.name, row.code, row.id] : [row.name, row.code])
export function groupRabRows(rows: RabRow[]) {
  const groups = new Map<string, RabRow[]>()
  for (const row of rows) if (!row.excluded) {
    const key = rabRowKey(row)
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }
  return [...groups].map(([key, members]) => {
    const decisions = new Set(members.map(row => JSON.stringify([row.status, row.candidate?.id ?? null, !!row.noMatch])))
    const mixed = decisions.size > 1
    const row = members.find(row => !row.reviewed) ?? members.find(row => row.status !== 'matched') ?? members[0]
    return { key, members, row, mixed, matched: !mixed && row.status === 'matched' }
  })
}
export function updateRabGroup(rows: RabRow[], target: RabRow, change: (row: RabRow) => RabRow) {
  const key = rabRowKey(target)
  return rows.map(row => !row.excluded && rabRowKey(row) === key ? change(row) : row)
}
const candidateNames = new WeakMap<RabCandidate, string>()
const candidateName = (candidate: RabCandidate) => {
  let text = candidateNames.get(candidate)
  if (text === undefined) { text = rabText(candidate.name); candidateNames.set(candidate, text) }
  return text
}
const regulationRank = (candidate: RabCandidate) => candidate.regulation === AHSP_ACTIVE_REGULATIONS[0] ? 0 : candidate.regulation === AHSP_ACTIVE_REGULATIONS[1] ? 1 : 2
export function rabNumber(cell?: RabCell): { value: number | null; issue: string } {
  if (!cell) return { value: null, issue: '' }
  if (cell.error) return { value: null, issue: 'Sel berisi kesalahan Excel.' }
  if (cell.value !== null && Number.isFinite(cell.value)) return { value: cell.value, issue: '' }
  const text = cell.text.trim().replace(/^Rp\.?\s*/i, '').replace(/\u00a0/g, '')
  if (!text || /^[-–—]$/.test(text)) return { value: null, issue: cell.formula ? 'Hasil tersimpan rumus belum tersedia.' : '' }
  if (/[\r\n]/.test(text)) return { value: null, issue: 'Beberapa angka berada dalam satu sel.' }
  let cleaned = text
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(text)) cleaned = text.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(text)) cleaned = text.replace(/,/g, '')
  else if (/^-?\d+[.,]\d{3}$/.test(text)) return { value: null, issue: 'Pemisah desimal/ribuan ambigu.' }
  else if (/^-?\d+,\d+$/.test(text)) cleaned = text.replace(',', '.')
  else if (!/^-?\d+(\.\d+)?$/.test(text)) return { value: null, issue: 'Angka berbentuk teks belum dapat dipastikan.' }
  const value = Number(cleaned)
  return Number.isFinite(value) ? { value, issue: '' } : { value: null, issue: 'Angka di luar batas.' }
}
export const rabColumn = (index: number): string => index > 26 ? rabColumn(Math.floor((index - 1) / 26)) + String.fromCharCode(65 + (index - 1) % 26) : String.fromCharCode(64 + index)
export const rabColumnIndex = (column: string) => [...column].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0)
const heading = (text: string) => /^(divisi\b|pekerjaan (persiapan|pelaksanaan|pembantu|penerapan smkk)$|apk,? antara|apd,? antara)/i.test(text.trim())
const subtotal = (text: string) => /^(sub\s*jumlah|jumlah\b|total(?:\s+(seluruh|harga|divisi)\b|\s*$)|ppn\b|###|catatan\s*:)/i.test(text.trim())
const hasRabPrice = (value: number | null, text = '') => value !== null || /^\s*(?:Rp\.?\s*)?[+-]?\d[\d.,]*\s*$/i.test(text)

export function detectRabMapping(sheet: Pick<RabSheet, 'cells' | 'columns' | 'merges' | 'lastRow'>): RabMapping {
  const mapping: RabMapping = { name: '', code: '', unit: '', volume: '', price: '', total: '', start: 1 }
  let header = 0, score = 0
  for (let row = 1; row <= Math.min(60, sheet.lastRow); row++) {
    const texts = sheet.columns.map(col => rabText(sheet.cells[`${col}${row}`]?.text ?? ''))
    const s = texts.reduce((n, text) => n + (/uraian|jenis pekerjaan/.test(text) ? 3 : /satuan|kuantitas|volume|^vol$|harga|kode/.test(text) ? 1 : 0), 0)
    if (s > score) { score = s; header = row }
  }
  if (header) {
    mapping.start = header + 1
    for (const merge of sheet.merges) if (merge.from <= header && merge.to >= header && merge.to <= header + 4) mapping.start = Math.max(mapping.start, merge.to + 1)
    for (const col of sheet.columns) {
      const text = rabText(Array.from({ length: Math.min(4, mapping.start - header) }, (_, n) => sheet.cells[`${col}${header + n}`]?.text ?? '').join(' '))
      if (/uraian|jenis pekerjaan/.test(text)) mapping.name = col
      else if (/jumlah.*harga|biaya|^total$/.test(text)) mapping.total = col
      else if (/harga satuan/.test(text)) mapping.price = col
      else if (/kuantitas|volume|^vol$/.test(text)) mapping.volume = col
      else if (/^satuan$/.test(text)) mapping.unit = col
      else if (/kode|mata pembayaran/.test(text)) mapping.code = col
    }
  }
  const nameScores = sheet.columns.map(col => ({ col, score: Array.from({ length: Math.min(80, Math.max(0, sheet.lastRow - mapping.start + 1)) }, (_, n) => sheet.cells[`${col}${n + mapping.start}`]?.text ?? '').filter(text => /[a-zA-Z]{4}/.test(text) && text.length > 12 && !subtotal(text)).length }))
  const best = nameScores.sort((a, b) => b.score - a.score)[0]
  if (best && (!mapping.name || best.score > (nameScores.find(n => n.col === mapping.name)?.score ?? 0) * 2)) mapping.name = best.col
  if (mapping.name && !mapping.code) {
    const previous = rabColumnIndex(mapping.name) - 1
    if (previous > 0) mapping.code = rabColumn(previous)
  }
  if (!mapping.unit && mapping.name) {
    const col = rabColumn(rabColumnIndex(mapping.name) + 1)
    if (sheet.columns.includes(col)) mapping.unit = col
  }
  const columnNumbers = sheet.columns.map(col => sheet.cells[`${col}${mapping.start}`]?.text.trim() ?? '').filter(Boolean)
  if (header && columnNumbers.length >= 4 && columnNumbers.every((text, index) => text === String(index + 1))) mapping.start++
  return mapping
}

export function extractRabRows(sheet: RabSheet, mapping: RabMapping): RabRow[] {
  const result: RabRow[] = []
  const consumed = new Set<number>()
  const last = Math.min(RAB_MAX_ROWS, sheet.lastRow)
  const read = (row: number, name: string, source: string, suffix = '', split = false): RabRow => {
    const issues: string[] = split ? ['Uraian dipisahkan dari sel gabungan; periksa pasangan angka.'] : []
    const raw: Record<string, string> = { name: sheet.cells[`${mapping.name}${Number(source.match(/\d+/)?.[0] ?? row)}`]?.text ?? name }, refs: Record<string, string> = { name: source }
    const readField = (key: 'code' | 'unit' | 'volume' | 'price' | 'total') => {
      const col = mapping[key]
      if (!col) return undefined
      const ref = `${col}${row}`
      const merge = sheet.merges.find(m => m.from <= row && m.to >= row && m.left <= rabColumnIndex(col) && m.right >= rabColumnIndex(col))
      const cell = sheet.cells[ref]
      refs[key] = merge?.ref ?? ref
      raw[key] = cell?.text ?? ''
      if (merge && merge.to > merge.from) {
        const origin = `${rabColumn(merge.left)}${merge.from}`
        raw[key] = sheet.cells[origin]?.text ?? ''
        issues.push(`${key === 'volume' ? 'Volume' : key === 'price' ? 'Harga satuan' : key === 'total' ? 'Total' : key === 'unit' ? 'Satuan' : 'Kode'} berada dalam sel gabungan ${merge.ref}.`)
        return undefined
      }
      return cell
    }
    const code = readField('code')?.text ?? '', unit = readField('unit')?.text ?? ''
    const values = (['volume', 'price', 'total'] as const).map(key => {
      const parsed = rabNumber(readField(key))
      if (parsed.issue) issues.push(`${key === 'volume' ? 'Volume' : key === 'price' ? 'Harga satuan' : 'Total'}: ${parsed.issue}`)
      return parsed.value
    })
    const priced = hasRabPrice(values[1], raw.price)
    const excluded = !priced && (subtotal(name) || heading(name))
    return { id: `${sheet.name}:${source}:${row}${suffix}`, sheet: sheet.name, row, source, originalName: name, name, code, unit,
      volume: values[0], price: values[1], total: values[2], raw, refs, issues: [...new Set(issues)], reviewed: issues.length === 0,
      excluded, exclusion: excluded ? 'Judul kelompok, subtotal, atau catatan.' : '', status: 'pending', candidate: null, candidates: [], manual: false, resolution: '', history: [] }
  }
  for (let row = mapping.start; row <= last; row++) {
    if (consumed.has(row)) continue
    const cell = sheet.cells[`${mapping.name}${row}`]
    const name = cell?.text.trim() ?? ''
    if (!name || !/[a-zA-Z]/.test(name)) continue
    const merge = sheet.merges.find(m => m.from === row && m.to > row && m.left === rabColumnIndex(mapping.name))
    if (merge) {
      const lines = name.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      const entries = lines.filter(line => !heading(line) && !subtotal(line))
      const physical = Array.from({ length: Math.min(merge.to, last) - row + 1 }, (_, n) => row + n).filter(r => Boolean(sheet.cells[`${mapping.unit}${r}`]?.text.trim()) || ['volume', 'price'].some(key => rabNumber(sheet.cells[`${mapping[key as keyof RabMapping]}${r}`]).value !== null))
      if (entries.length > 1 && physical.length > 1) {
        entries.forEach((line, index) => {
          const matchingCount = entries.length === physical.length
          const item = read(matchingCount ? physical[index] : row, line, merge.ref, `:${index}`, true)
          if (!matchingCount) { item.volume = item.price = item.total = null; item.issues.push('Jumlah uraian dan baris angka berbeda; isi pasangan angka secara manual.') }
          result.push(item)
        })
        for (let r = row; r <= Math.min(merge.to, last); r++) consumed.add(r)
        continue
      }
    }
    const item = read(row, name, `${mapping.name}${row}`)
    const helper = /^b$/i.test(name) && /^c$/i.test(item.unit) && /^a$/i.test(item.code)
    const hasFacts = Boolean(item.unit && item.unit !== '-') || [item.volume, item.price, item.total].some(v => v !== null)
    const priced = hasRabPrice(item.price, item.raw.price)
    if (!item.excluded && !priced && (!hasFacts || helper)) { item.excluded = true; item.reviewed = helper; item.exclusion = helper ? 'Baris penunjuk kolom Excel.' : 'Tidak memiliki satuan atau angka pendukung; periksa apakah judul atau pekerjaan, termasuk kelompok berkode.' }
    result.push(item)
  }
  // Retain numeric rows whose description was lost in a merge or column mapping.
  for (let row = mapping.start; row <= last; row++) {
    if (consumed.has(row) || result.some(item => item.row === row)) continue
    const unit = sheet.cells[`${mapping.unit}${row}`]?.text
    const code = sheet.cells[`${mapping.code}${row}`]?.text ?? ''
    const coded = code.length < 60 && /[.()]/.test(code) && /\d/.test(code) && !/\s[a-z]{3,}/i.test(code)
    const hasUnit = unit && /[a-zA-Z]/.test(unit) && !subtotal(unit) && unit.length <= 40
    const priceCell = sheet.cells[`${mapping.price}${row}`]
    const hasPrice = hasRabPrice(rabNumber(priceCell).value, priceCell?.text)
    if ((!hasPrice && !hasUnit && !coded) || !['volume', 'price', 'total'].some(key => rabNumber(sheet.cells[`${mapping[key as keyof RabMapping]}${row}`]).value !== null)) continue
    const item = read(row, 'Uraian belum terbaca', `${mapping.name}${row}`)
    item.reviewed = false; item.issues.push('Uraian pekerjaan belum terbaca. Perbaiki pemetaan atau isi uraian.'); result.push(item)
  }
  return result.sort((a, b) => a.row - b.row)
}

export function rabDifferences(row: Pick<RabRow, 'name' | 'unit'>, candidate: RabCandidate): string[] {
  const warnings: string[] = []
  if (!row.unit || !candidate.unit || row.unit === '-') warnings.push('Satuan belum lengkap.')
  else if (rabUnit(row.unit) !== rabUnit(candidate.unit)) warnings.push(`Satuan berbeda: ${row.unit} / ${candidate.unit}.`)
  const specs = (text: string) => rabText(text).match(/\d+(?:[.,]\d+)?/g)?.map(n => String(Number(n.replace(',', '.')))).sort() ?? []
  if (JSON.stringify(specs(row.name)) !== JSON.stringify(specs(candidate.name))) warnings.push('Angka spesifikasi dalam uraian berbeda atau belum lengkap.')
  const a = rabText(row.name), b = rabText(candidate.name)
  for (const [first, second] of [['manual', 'mekanis'], ['ac-wc', 'ac-bc']]) if ((a.includes(first) && b.includes(second)) || (a.includes(second) && b.includes(first))) warnings.push('Metode atau jenis pekerjaan berbeda.')
  if (a !== b) warnings.push('Uraian berbeda; periksa kelas, ukuran, dan metode pekerjaan.')
  return warnings
}
export function rabSuggestions(name: string, catalog: RabCandidate[], mode: 'like' | 'phrases' = 'phrases', query = '', unit = ''): RabCandidate[] {
  const input = rabText(query || name)
  const terms = mode === 'like' ? [input] : query ? parseAhspSearch(query, 'phrases').map(rabText) : [...new Set(input.match(/[\p{L}\p{N}][\p{L}\p{N}.,’'≥≤-]*/gu) ?? [])].filter(term => term.length > 2 && !['dan', 'dengan', 'untuk', 'dari', 'pada', 'yang', 'atau', 'pekerjaan'].includes(term))
  if (!input || !terms.length || (mode === 'phrases' && terms.length < 2)) return []
  const matches = catalog.map(candidate => {
    const text = candidateName(candidate)
    const exact = text === input
    const count = terms.filter(term => text.includes(term)).length
    return { candidate, exact, count, eligible: exact || (mode === 'like' ? text.includes(input) : count >= 2) }
  }).filter(item => item.eligible)
  const primaryExact = matches.some(item => item.exact && rabPrimary(item.candidate) && (!unit || rabUnit(unit) === rabUnit(item.candidate.unit)))
  return (primaryExact ? matches.filter(item => rabPrimary(item.candidate)) : matches).sort((a, b) => Number(b.exact) - Number(a.exact) || Number(rabPrimary(b.candidate)) - Number(rabPrimary(a.candidate)) || b.count - a.count || regulationRank(a.candidate) - regulationRank(b.candidate) || a.candidate.name.localeCompare(b.candidate.name, 'id') || a.candidate.id.localeCompare(b.candidate.id)).map(item => item.candidate)
}
export function matchRabRow(row: RabRow, catalog: RabCandidate[]): RabRow {
  if (row.excluded || row.manual || row.noMatch) return row
  const byLike = rabSuggestions(row.name, catalog, 'like', '', row.unit)
  const candidates = byLike.length ? byLike : rabSuggestions(row.name, catalog, 'phrases', '', row.unit)
  const exact = candidates.filter(candidate => rabText(candidate.name) === rabText(row.name) && rabDifferences(row, candidate).length === 0)
  const distinct = new Set(exact.map(c => `${rabText(c.name)}:${rabUnit(c.unit)}`))
  const candidate = row.reviewed && exact.length && distinct.size === 1 ? exact.find(rabPrimary) ?? exact[0] : null
  return { ...row, candidates: candidates.slice(0, 8), candidate, status: candidate ? 'matched' : candidates.length || !row.reviewed ? 'review' : 'missing' }
}
export function rabRecap(rows: RabRow[]) {
  const active = rows.filter(row => !row.excluded)
  const count = (fn: (row: RabRow) => boolean) => active.filter(fn).length
  const primary = count(row => row.status === 'matched' && !!row.candidate && rabPrimary(row.candidate))
  const additional = count(row => row.status === 'matched' && !!row.candidate && !rabPrimary(row.candidate))
  return { total: active.length, primary, additional, review: count(row => row.status === 'review'), missing: count(row => row.status === 'missing'), checkedMissing: count(row => !!row.noMatch), pending: count(row => row.status === 'pending'), excluded: rows.length - active.length, excludedReview: rows.filter(row => row.excluded && !row.reviewed).length, issues: active.filter(row => !row.reviewed && !row.noMatch).length,
    percent: active.length ? primary / active.length * 100 : 0,
    additionalPercent: active.length ? additional / active.length * 100 : 0,
    amount: active.reduce((sum, row) => sum + (row.total ?? 0), 0), missingAmounts: count(row => row.total === null),
  }
}
export function confirmRabNoMatch(row: RabRow): RabRow {
  return { ...row, candidate: null, status: 'missing', noMatch: true, manual: true, resolution: '', history: [...row.history, `${new Date().toISOString()}: diperiksa; tidak ada kecocokan, dilewati.`] }
}
export function includeRabRows(rows: RabRow[], ids: string[], catalog: RabCandidate[]): RabRow[] {
  const selected = new Set(ids)
  return rows.map(row => row.excluded && selected.has(row.id) ? matchRabRow({ ...row, excluded: false, exclusion: '', noMatch: false, candidate: null, candidates: [], manual: false, status: 'pending', resolution: '', history: [...row.history, `${new Date().toISOString()}: pengecualian dibatalkan; dimasukkan ke daftar pekerjaan.`] }, catalog) : row)
}
export function rabAmountWarning(row: Pick<RabRow, 'volume' | 'price' | 'total'>) {
  if (row.volume === null || row.price === null || row.total === null) return 'Data angka belum lengkap.'
  return Math.abs(row.volume * row.price - row.total) > Math.max(1, Math.abs(row.total) * .000001) ? 'Total sumber berbeda dari Volume × Harga Satuan.' : ''
}
