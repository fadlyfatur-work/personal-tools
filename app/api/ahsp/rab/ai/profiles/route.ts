import { z } from 'zod'
import { aiProfileSchema, type AiConfig } from '@/lib/ahspRabAi'
import { checkAiAccess, openAiKey, readAiJson, sealAiKey, validateAiUrl } from '@/lib/ahspRabAiServer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
export const dynamic = 'force-dynamic'
const migrationError = 'Profil AI belum dapat diakses. Pastikan migrasi 202610250002_ahsp_ai_profiles.sql sudah diterapkan dan konfigurasi database tersedia.'
const fields = 'id,name,config,is_default,updated_at'
const dto = (row: { id: string; name: string; config: unknown; is_default: boolean }) => ({ ...(row.config as AiConfig), id: row.id, name: row.name, isDefault: row.is_default, hasKey: true })
export async function GET(request: Request) {
  const denied = checkAiAccess(request); if (denied) return denied
  try {
    const { data, error } = await getSupabaseAdmin().from('ahsp_ai_profiles').select(fields).order('updated_at', { ascending: false }).limit(20)
    if (error) return Response.json({ error: migrationError }, { status: 503 })
    return Response.json({ profiles: (data || []).map(dto) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: migrationError }, { status: 503 }) }
}
export async function POST(request: Request) {
  const denied = checkAiAccess(request); if (denied) return denied
  try {
    const schema = z.object({ id: z.uuid().optional(), config: aiProfileSchema, apiKey: z.string().max(4096).optional() })
    const input = schema.parse(await readAiJson(request, 150000))
    validateAiUrl(input.config.endpoint.replaceAll('{{model}}', encodeURIComponent(input.config.model)))
    if (Object.keys(input.config.headers).length > 20) throw new Error('Maksimal 20 header.')
    const db = getSupabaseAdmin()
    let encrypted = '', plain = input.apiKey || ''
    if (!plain && input.id) {
      const { data, error } = await db.from('ahsp_ai_profiles').select('encrypted_key').eq('id', input.id).maybeSingle()
      if (error || !data) throw new Error('Profil tidak ditemukan. Muat ulang daftar profil.')
      encrypted = data.encrypted_key; plain = openAiKey(encrypted)
    }
    if (!plain || plain.length < 8) throw new Error('Isi API key minimal 8 karakter untuk profil baru.')
    if (JSON.stringify(input.config).includes(plain)) throw new Error('Gunakan variabel {{api_key}} pada template/header; masukkan key hanya pada kolom API key.')
    if (!encrypted) encrypted = sealAiKey(plain)
    const { data: id, error } = await db.rpc('ahsp_ai_save_profile', { p_id: input.id || null, p_name: input.config.name, p_config: input.config, p_encrypted_key: encrypted, p_is_default: input.config.isDefault })
    if (error) return Response.json({ error: migrationError + ' Maksimal 20 profil.' }, { status: 503 })
    return Response.json({ id }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return Response.json({ error: error instanceof z.ZodError ? 'Periksa nama, URL, model, dan format JSON profil.' : error instanceof Error ? error.message : 'Profil gagal disimpan.' }, { status: 400 }) }
}
export async function DELETE(request: Request) {
  const denied = checkAiAccess(request); if (denied) return denied
  const input = z.object({ id: z.uuid() }).safeParse(await readAiJson(request, 1000).catch(() => null))
  if (!input.success) return Response.json({ error: 'Identitas profil tidak valid.' }, { status: 400 })
  try {
    const { error } = await getSupabaseAdmin().from('ahsp_ai_profiles').delete().eq('id', input.data.id)
    return error ? Response.json({ error: migrationError }, { status: 503 }) : Response.json({ deleted: true })
  } catch { return Response.json({ error: migrationError }, { status: 503 }) }
}
