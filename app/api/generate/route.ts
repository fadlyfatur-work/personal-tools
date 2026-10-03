import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { z } from 'zod'
import { documentTemplates } from '@/lib/documentTemplates'
import { clientKey, rateLimit } from '@/lib/rateLimit'
import { generateDateRange, formatPeriodeSurat, formatTanggalIndo } from '@/lib/dateHelper'
import type { TemplateConfig, DateRangeValue, SingleField } from '@/types/templateSurat'

const payloadSchema = z.object({
  code: z.string().min(1),
  single: z.record(z.string(), z.union([z.string(), z.object({ start: z.string(), end: z.string() })])),
  groups: z.record(z.string(), z.array(z.record(z.string(), z.string()))),
})

function validDate(value: string) {
  const date = new Date(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function fieldError(field: SingleField, value: string | DateRangeValue | undefined): string | undefined {
  if (field.type === 'dateRange') {
    if (!value && !field.required) return
    if (typeof value !== 'object') return `${field.label}: isi tanggal mulai dan selesai.`
    if (!value.start && !value.end && !field.required) return
    if (!validDate(value.start) || !validDate(value.end) || value.start > value.end) return `${field.label}: rentang tanggal tidak valid.`
  } else {
    if (value !== undefined && typeof value !== 'string') return `${field.label}: nilai tidak valid.`
    if (field.required && !value?.trim()) return `${field.label} wajib diisi.`
    if (value && field.type === 'select' && !field.options?.includes(value)) return `${field.label}: pilihan tidak valid.`
    if (value && field.type === 'date' && !validDate(value)) return `${field.label}: tanggal tidak valid.`
  }
}

function sanitizeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(`generate:${clientKey(req)}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const parsed = payloadSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Data surat tidak valid.' }, { status: 400 })
  const { code, single, groups } = parsed.data

  const { data: template, error: templateError } = Object.hasOwn(documentTemplates, code) ? { data: documentTemplates[code], error: null } : await supabase
    .from('templates')
    .select('file_path, name, fields')
    .eq('code', code)
    .single()

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
  }

  const config = template.fields as TemplateConfig
  for (const field of config.single) {
    const error = fieldError(field, single[field.key])
    if (error) return NextResponse.json({ error }, { status: 400 })
  }
  for (const group of config.groups) {
    const items = groups[group.name] || []
    if (items.length < (group.minItems ?? 0) || items.length > group.maxItems) {
      return NextResponse.json({ error: `${group.label} harus berisi ${group.minItems ?? 0} sampai ${group.maxItems} orang/baris.` }, { status: 400 })
    }
    for (const [index, item] of items.entries()) {
      for (const field of group.fields) {
        if (group.autoDateFrom && field.key === group.autoDateField) continue
        const error = fieldError(field, item[field.key])
        if (error) return NextResponse.json({ error: `${group.label} ${index + 1}: ${error}` }, { status: 400 })
      }
    }
  }

  let templateBuffer: Buffer
  try {
    templateBuffer = await readFile(path.join(process.cwd(), 'storage', 'data', path.basename(template.file_path)))
  } catch {
    return NextResponse.json({ error: 'File template lokal tidak ditemukan di storage/data' }, { status: 500 })
  }

  // --- Susun data akhir untuk docxtemplater ---
  const finalData: Record<string, string | Record<string, string>[]> = {}

  // 1. Field tunggal biasa (bertipe text/textarea/date)
  for (const f of config.single) {
    if (f.type === 'dateRange') continue // ditangani khusus di bawah
    const val = single[f.key]
    if (f.type === 'date' && typeof val === 'string' && val) {
      finalData[f.key] = validDate(val) ? formatTanggalIndo(val) : val
    } else {
      finalData[f.key] = typeof val === 'string' ? val : ''
    }
  }

  // 2. Field tunggal bertipe dateRange -> jadi teks periode + dasar perhitungan tanggal grup
  const dateRangeValues: Record<string, string[]> = {} // key: nama field -> daftar tanggal ISO
  for (const f of config.single) {
    if (f.type !== 'dateRange') continue
    const val = single[f.key] as DateRangeValue | undefined
    if (val && val.start && val.end) {
      finalData[f.key] = formatPeriodeSurat(val.start, val.end)
      if (config.groups.some(group => group.autoDateFrom === f.key)) dateRangeValues[f.key] = generateDateRange(val.start, val.end)
    } else {
      finalData[f.key] = ''
      dateRangeValues[f.key] = []
    }
  }

  // 3. Grup field -> flatten jadi key_1, key_2, dst
  const warnings: string[] = []

  for (const group of config.groups) {
    const items = groups[group.name] || []
    if (group.repeatRows) {
      finalData[group.name] = items.map((item, index) => ({
        ...Object.fromEntries(group.fields.map(field => [field.key, item[field.key] || ''])),
        nomor: String(index + 1),
        label_kepada: index === 0 ? 'Kepada:' : '',
      }))
      continue
    }

    // Kalau grup ini punya tanggal otomatis, timpa field tanggalnya dari dateRangeValues
    const autoDates = group.autoDateFrom ? dateRangeValues[group.autoDateFrom] || [] : null

    if (autoDates && autoDates.length > group.maxItems) {
      warnings.push(
        `Rentang tanggal "${group.autoDateFrom}" menghasilkan ${autoDates.length} hari, ` +
        `tapi template "${group.name}" hanya mendukung maksimal ${group.maxItems}. ` +
        `Hari ke-${group.maxItems + 1} dan seterusnya tidak akan muncul di dokumen.`
      )
    }

    for (let i = 0; i < group.maxItems; i++) {
      const item = items[i]
      for (const f of group.fields) {
        const flatKey = `${f.key}_${i + 1}`

        if (autoDates && group.autoDateField === f.key) {
          finalData[flatKey] = autoDates[i] ? formatTanggalIndo(autoDates[i]) : ''
        } else {
          finalData[flatKey] = item ? (item[f.key] || '') : ''
        }
      }
    }
  }

  // --- Render docx ---
  let buffer: Buffer
  try {
    const zip = new PizZip(templateBuffer)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      delimiters: { start: '{{', end: '}}' },
    })
    doc.render(finalData)
    buffer = doc.getZip().generate({ type: 'nodebuffer' })
  } catch (err) {
    console.error(err)
    const detail = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: `Gagal mengisi template: ${detail}` }, { status: 500 })
  }

  const today = new Date()
  const stamp = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${today.getFullYear()}`
  const activity = single['kegiatan_perjadin'] || single['nama_acara']
  const number = single['nomor_spt'] || single['nomor_surat']
  const namaKegiatan = sanitizeFileName(typeof activity === 'string' ? activity : '') || sanitizeFileName(template.name)
  const nomorSurat = sanitizeFileName(typeof number === 'string' ? number : '') || 'tanpa-nomor'
  const fileName = `${stamp}_${namaKegiatan}_${nomorSurat}.docx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'X-Warnings': encodeURIComponent(JSON.stringify(warnings)),
    },
  })
}
