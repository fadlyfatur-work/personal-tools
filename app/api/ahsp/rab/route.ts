import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { AHSP_CATALOG_REGULATIONS } from '@/lib/ahsp'
import { clientKey, rateLimit } from '@/lib/rateLimit'
import type { RabCandidate } from '@/lib/ahspRab'

export const dynamic = 'force-dynamic'
type Catalog = { items: RabCandidate[]; loadedAt: string; expires: number }
let cached: Catalog | null = null
let pending: Promise<Catalog> | null = null

async function loadCatalog() {
  const db = getSupabaseAdmin()
  const items: RabCandidate[] = []
  for (let start = 0; start < 50000; start += 1000) {
    const { data, error } = await db.from('ahsp_items').select('id,code,name,unit,regulation,regulation_status').in('regulation', AHSP_CATALOG_REGULATIONS).order('id').range(start, start + 999)
    if (error) throw error
    items.push(...data)
    if (data.length < 1000) return { items, loadedAt: new Date().toISOString(), expires: Date.now() + 5 * 60 * 1000 }
  }
  throw new Error('Catalog limit')
}
export async function GET(request: Request) {
  const limit = rateLimit(`ahsp-rab:${clientKey(request)}`, 30, 60000)
  if (!limit.ok) return Response.json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })
  try {
    if (!cached || cached.expires <= Date.now()) {
      pending ??= loadCatalog().finally(() => { pending = null })
      cached = await pending
    }
    if (!cached.items.length) throw new Error('Empty catalog')
    return Response.json({ items: cached.items, loadedAt: cached.loadedAt }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Katalog AHSP gagal dimuat. Data Excel tetap tersedia; coba pencocokan lagi.' }, { status: 503 })
  }
}
