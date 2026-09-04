export interface SingleField {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'date' | 'dateRange'
}

export interface GroupField {
  name: string
  label: string
  maxItems: number
  fields: SingleField[]
  // dua properti ini opsional — hanya dipakai kalau grup punya tanggal otomatis
  // yang mengikuti sebuah field dateRange (seperti kasus 'agenda' mengikuti 'periode_surat')
  autoDateFrom?: string
  autoDateField?: string
}

export interface TemplateConfig {
  single: SingleField[]
  groups: GroupField[]
}

export interface DateRangeValue {
  start: string // ISO date, misal '2026-08-21'
  end: string
}