import { z } from 'zod'
import { AI_LIMITS, aiProfileSchema } from '@/lib/ahspRabAi'
import { callAiModel, checkAiAccess, openAiKey, readAiJson } from '@/lib/ahspRabAiServer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 150
const inputSchema = z.object({ profileId: z.uuid().optional(), draft: aiProfileSchema.optional(), apiKey: z.string().max(4096).optional(), stage: z.enum(['ocr', 'structure']), text: z.string().max(AI_LIMITS.text).optional(), image: z.string().max(AI_LIMITS.bytes).optional(), mime: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(), page: z.number().int().positive().optional(), pages: z.array(z.number().int().positive()).min(1).max(AI_LIMITS.pages) })
let active = 0
export async function POST(request: Request) {
  const denied = checkAiAccess(request); if (denied) return denied
  if (active >= 2) return Response.json({ error: 'Dua proses AI sedang berjalan. Tunggu sebelum mencoba lagi.' }, { status: 429 })
  active++
  try {
    const input = inputSchema.parse(await readAiJson(request, AI_LIMITS.bytes))
    if (new Set(input.pages).size !== input.pages.length) throw new Error('Halaman yang diproses harus unik.')
    if (input.stage === 'structure' && !input.text?.trim()) throw new Error('Teks OCR belum tersedia.')
    if (input.stage === 'ocr') {
      if (!input.page || !input.pages.includes(input.page) || !input.image || !input.mime) throw new Error('Gambar dan halaman OCR belum lengkap.')
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.image)) throw new Error('Lampiran gambar bukan base64 yang valid.')
      const head = Buffer.from(input.image.slice(0, 64), 'base64')
      const valid = input.mime === 'image/jpeg' ? head[0] === 255 && head[1] === 216 && head[2] === 255 : input.mime === 'image/png' ? head.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP'
      if (!valid) throw new Error('Isi lampiran tidak sesuai jenis gambar.')
    }
    const db = getSupabaseAdmin()
    let saved: { config: unknown; encrypted_key: string } | null = null
    if (input.profileId) {
      const { data, error } = await db.from('ahsp_ai_profiles').select('config,encrypted_key').eq('id', input.profileId).maybeSingle()
      if (error) return Response.json({ error: 'Database profil AI belum siap. Terapkan migrasi profil AI terlebih dahulu.' }, { status: 503 })
      saved = data
    }
    if (!saved && !input.draft) return Response.json({ error: 'Profil API tidak ditemukan. Pilih profil yang tersimpan.' }, { status: 404 })
    const config = aiProfileSchema.parse(input.draft || saved?.config)
    const key = input.apiKey || (saved ? openAiKey(saved.encrypted_key) : '')
    if (key.length < 8) throw new Error('API key belum tersedia.')
    const { data: allowed, error: quotaError } = await db.rpc('ahsp_ai_take_request')
    if (quotaError) return Response.json({ error: 'Pencatatan kuota AI belum siap. Periksa migrasi database.' }, { status: 503 })
    if (!allowed) return Response.json({ error: 'Batas bersama 120 panggilan AI per jam tercapai. Coba pada jam berikutnya.' }, { status: 429 })
    const result = await callAiModel(config, key, input, undefined, request.signal)
    return Response.json(result, { status: result.trace.ok ? 200 : 422, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof z.ZodError ? 'Periksa profil, tahap, halaman, dan batas masukan AI.' : error instanceof Error && /ukuran|Teks OCR|Lampiran|lampiran|halaman|Halaman|Gambar/.test(error.message) ? error.message : 'Proses AI gagal disiapkan. Periksa konfigurasi enkripsi dan database server.' }, { status: 400 })
  } finally { active-- }
}
