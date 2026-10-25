export const TEMPLATE_STORAGE_KEY = 'nominatif-template-v1'
export const templateFields = ['satker', 'output', 'fileType', 'signer', 'signerNip', 'treasurer', 'treasurerNip', 'bank', 'address', 'npwp'] as const
export type NominatifTemplate = Record<typeof templateFields[number], string>

export function pickTemplate(value: object): NominatifTemplate {
  return Object.fromEntries(templateFields.map(key => {
    const entry = (value as Record<string, unknown>)[key]
    return [key, typeof entry === 'string' ? entry.slice(0, 250) : '']
  })) as NominatifTemplate
}

export function readTemplate(raw: string): NominatifTemplate | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const template = pickTemplate(value)
    return templateErrors(template).length ? null : template
  } catch { return null }
}

export function templateErrors(value: Partial<NominatifTemplate>) {
  const errors: string[] = []
  for (const [key, label] of [['satker', 'Satuan kerja'], ['signer', 'Nama PPK'], ['treasurer', 'Nama bendahara']] as const) {
    if (!value[key]?.trim()) errors.push(`${label}: lengkapi untuk ekspor dokumen.`)
  }
  for (const [key, label] of [['signerNip', 'NIP PPK'], ['treasurerNip', 'NIP bendahara']] as const) {
    if (!/^\d{18}$/.test(value[key] || '')) errors.push(`${label}: isi 18 digit.`)
  }
  return errors
}
