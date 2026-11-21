import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { hasApprovalSession, isSameOrigin } from '@/lib/ahspApproval'
import { clientKey, rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const querySchema = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
const bodySchema = z.object({ itemId: z.uuid() }).strict()

export async function GET(request: Request) {
  if (!await hasApprovalSession(request)) return Response.json({ error: 'Masukkan PIN admin untuk melihat arsip.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return Response.json({ error: 'Halaman arsip tidak valid.' }, { status: 400 })
  try {
    const start = (parsed.data.page - 1) * 30
    const { data, error, count } = await getSupabaseAdmin().from('ahsp_items')
      .select('id,code,name,unit,field,regulation,archived_at', { count: 'exact' })
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false }).order('id', { ascending: false })
      .range(start, start + 29)
    if (error) throw error
    return Response.json({ items: data ?? [], total: count ?? 0, page: parsed.data.page, pageSize: 30 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Daftar arsip belum dapat dimuat. Periksa migrasi katalog dan coba lagi.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request: Request) {
  if (!await hasApprovalSession(request)) return Response.json({ error: 'Masukkan PIN admin.' }, { status: 401 })
  if (!isSameOrigin(request)) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  const limit = rateLimit(`ahsp-archive:${clientKey(request)}`, 30, 60 * 1000)
  if (!limit.ok) return Response.json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })
  let parsed
  try {
    const text = await request.text()
    if (text.length > 1000) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 413 })
    parsed = bodySchema.safeParse(JSON.parse(text))
  } catch { return Response.json({ error: 'Data item tidak valid.' }, { status: 400 }) }
  if (!parsed.success) return Response.json({ error: 'Identitas item tidak valid.' }, { status: 400 })
  try {
    const { data, error } = await getSupabaseAdmin().rpc('ahsp_archive_item', { p_item_id: parsed.data.itemId })
    if (error) throw error
    return Response.json({ result: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Item belum dapat diarsipkan. Pastikan migrasi katalog sudah diterapkan.' }, { status: 503 })
  }
}
