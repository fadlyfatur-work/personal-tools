import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { generateDateRange, formatPeriodeSurat, formatTanggalIndo } from '@/lib/dateHelper'
import type { TemplateConfig, DateRangeValue } from '@/types/templateSurat'

interface GeneratePayload {
  code: string
  single: Record<string, string | DateRangeValue>
  groups: Record<string, Record<string, string>[]>
}

function sanitizeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function POST(req: NextRequest) {
  const { code, single, groups } = await req.json() as GeneratePayload

  if (!code) {
    return NextResponse.json({ error: 'Kode template wajib diisi' }, { status: 400 })
  }

  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('file_path, name, fields')
    .eq('code', code)
    .single()

  if (templateError || !template) {
    return NextResponse.json({ error: 'Template tidak ditemukan' }, { status: 404 })
  }

  const config = template.fields as TemplateConfig

  let templateBuffer: Buffer
  try {
    templateBuffer = await readFile(path.join(process.cwd(), 'storage', 'data', path.basename(template.file_path)))
  } catch {
    return NextResponse.json({ error: 'File template lokal tidak ditemukan di storage/data' }, { status: 500 })
  }

  // --- Susun data akhir untuk docxtemplater ---
  const finalData: Record<string, string> = {}

  // 1. Field tunggal biasa (bertipe text/textarea/date)
  for (const f of config.single) {
    if (f.type === 'dateRange') continue // ditangani khusus di bawah
    const val = single[f.key]
    if (f.type === 'date' && typeof val === 'string' && val) {
      const formatted = formatTanggalIndo(val)
      finalData[f.key] = formatted.includes('NaN') ? val : formatted
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
      dateRangeValues[f.key] = generateDateRange(val.start, val.end)
    } else {
      finalData[f.key] = ''
      dateRangeValues[f.key] = []
    }
  }

  // 3. Grup field -> flatten jadi key_1, key_2, dst
  const warnings: string[] = []

  for (const group of config.groups) {
    const items = groups[group.name] || []

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
  const namaKegiatan = sanitizeFileName(typeof single['kegiatan_perjadin'] === 'string' ? single['kegiatan_perjadin'] : '') || template.name
  const nomorSurat = sanitizeFileName(typeof single['nomor_spt'] === 'string' ? single['nomor_spt'] : '') || 'tanpa-nomor'
  const fileName = `${stamp}_${namaKegiatan}_${nomorSurat}.docx`

return new NextResponse(new Uint8Array(buffer), {
    headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'X-Warnings': encodeURIComponent(JSON.stringify(warnings)),
    },
})
}