export const AHSP_REGULATION = 'SE 47/2026'
export const AHSP_ACTIVE_REGULATIONS = ['SE 47/2026', 'PERMEN 08/2023']
export const reconciliationLabels: Record<string, string> = {
  cocok: 'Cocok', berbeda: 'Berbeda', belum_ditemukan: 'Belum ditemukan',
  perlu_ditinjau: 'Perlu ditinjau', hanya_regulasi: 'Hanya di regulasi',
}
export type AhspComponent = {
  id: string; group: 'tenaga' | 'bahan' | 'alat' | 'smkk'; name: string; code: string;
  unit: string; coefficient: number | null; expression: string; sourceLine: string;
}
export type AhspItem = {
  id: string; code: string; name: string; unit: string; field: string; division: string;
  regulation: string; ahsp_type: string; regulation_status: string;
  reconciliation_status: string; reconciliation_notes: string[];
  source_id: string | null; page_from: number | null; page_to: number | null;
  printed_page: string; analysis_status: 'extracted' | 'needs_review' | 'unavailable';
  components: AhspComponent[]; source_text: string; overhead_min: number | null;
  overhead_max: number | null; master_rows: number[]; output_quantity: number;
}
export type AhspSource = { id: string; title: string; annex: string; url: string; page_count: number; checked_at: string; sha256: string; assets: { url: string; page_start: number; page_end: number; preview_base_url?: string }[] }
export type AhspOptions = {
  total: number; fields: string[]; divisions: { field: string; division: string }[];
  units: string[]; statuses: { status: string; count: number }[];
  analysis: { status: string; count: number }[]; sources: AhspSource[];
  types?: AhspTypeCount[];
}
export type AhspTypeCount = { type: string; count: number }
export type AhspSearchStats = {
  input_count: number; found_terms: number; exact_found_terms: number; like_found_terms: number;
  exact_total: number; like_total: number; filtered_catalog_total: number; catalog_total: number;
  terms: { term: string; exact_count: number; like_count: number }[]; match: 'like' | 'exact';
}
export function ahspTypeLabel(type: string) { return type || 'Belum teridentifikasi' }
export type CalculationInput = { volume: number | null; overhead: number | null; prices: Record<string, number | null>; coefficients: Record<string, number | null> }

export function parseAhspSearch(value: string): string[] {
  const terms: string[] = []
  let current = ''; let depth = 0
  const flush = () => { const term = current.replace(/\s+/g, ' ').trim(); if (term) terms.push(term); current = '' }
  for (let index = 0; index < value.length; index++) {
    const char = value[index]
    if (char === '(') depth++
    if (char === ')') depth = Math.max(0, depth - 1)
    const decimalComma = char === ',' && /\d/.test(value[index - 1] ?? '') && /\d/.test(value[index + 1] ?? '')
    if (char === '\n' || char === '\r' || char === '\\' || (depth === 0 && (char === ';' || (char === ',' && !decimalComma)))) flush()
    else current += char
  }
  flush()
  const unique = new Map<string, string>()
  for (const term of terms) {
    const key = term.toLocaleLowerCase('id-ID')
    if (!unique.has(key)) unique.set(key, term)
  }
  return Array.from(unique.values())
}

export function parseAhspNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Accept an ungrouped decimal in either notation; mixed separators are ambiguous.
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function calculateAhsp(item: AhspItem, input: CalculationInput) {
  const errors: string[] = []
  const groups = { tenaga: 0, bahan: 0, alat: 0, smkk: 0 }
  if (!Number.isFinite(item.output_quantity) || item.output_quantity <= 0) errors.push('Basis volume pada analisis tidak valid.')
  if (item.analysis_status !== 'extracted' || item.components.length === 0) errors.push('Analisis komponen belum lengkap atau masih perlu ditinjau.')
  if (input.volume === null || !Number.isFinite(input.volume) || input.volume <= 0) errors.push('Isi volume pekerjaan lebih dari nol.')
  if (input.overhead === null || !Number.isFinite(input.overhead) || input.overhead < 0 || input.overhead > 100) errors.push('Isi persentase biaya umum dan keuntungan antara 0 dan 100.')
  else if ((item.overhead_min !== null && input.overhead < item.overhead_min) || (item.overhead_max !== null && input.overhead > item.overhead_max)) errors.push(`Persentase sesuai tabel sumber: ${item.overhead_min ?? 0}% sampai ${item.overhead_max ?? 100}%.`)
  const rows = item.components.map(component => {
    const coefficient = component.coefficient ?? input.coefficients[component.id]
    const price = input.prices[component.id]
    const validCoefficient = coefficient !== null && coefficient !== undefined && Number.isFinite(coefficient) && coefficient >= 0
    const validPrice = price !== null && price !== undefined && Number.isFinite(price) && price >= 0
    if (!validCoefficient) errors.push(`Isi koefisien ${component.name} berdasarkan rumus lampiran.`)
    if (!validPrice) errors.push(`Isi harga dasar ${component.name}.`)
    const amount = validCoefficient && validPrice ? coefficient * price : null
    if (amount !== null && !Number.isFinite(amount)) errors.push(`Nilai ${component.name} terlalu besar.`)
    if (amount !== null) groups[component.group] += amount
    return { ...component, activeCoefficient: coefficient, price, amount }
  })
  const direct = groups.tenaga + groups.bahan + groups.alat + groups.smkk
  const overheadAmount = input.overhead === null ? null : direct * input.overhead / 100
  const unitPrice = overheadAmount === null ? null : (direct + overheadAmount) / item.output_quantity
  const total = unitPrice === null || input.volume === null ? null : unitPrice * input.volume
  if (total !== null && !Number.isFinite(total)) errors.push('Hasil perhitungan terlalu besar.')
  return { rows, groups, errors, direct: errors.length ? null : direct, overheadAmount: errors.length ? null : overheadAmount, unitPrice: errors.length ? null : unitPrice, total: errors.length ? null : total }
}
