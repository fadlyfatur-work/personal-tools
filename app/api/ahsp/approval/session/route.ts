import { compare } from 'bcryptjs'
import { approvalCookie, approvalSourceHash, createApprovalToken, hasApprovalSession, isSameOrigin } from '@/lib/ahspApproval'
import { clientKey, rateLimit } from '@/lib/rateLimit'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return Response.json({ authenticated: await hasApprovalSession(request) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  if (Number(request.headers.get('content-length')) > 2000) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 413 })
  const limit = rateLimit(`ahsp-approval-pin:${clientKey(request)}`, 5, 15 * 60 * 1000)
  if (!limit.ok) return Response.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })
  let pin = ''
  try { const text = await request.text(); if (text.length > 2000) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 413 }); const body = JSON.parse(text); pin = typeof body.pin === 'string' ? body.pin : '' } catch { /* invalid JSON */ }
  const hash = process.env.AHSP_APPROVAL_PIN_HASH
  const secret = process.env.AHSP_APPROVAL_SESSION_SECRET
  if (!hash || !secret || secret.length < 32) return Response.json({ error: 'Akses approval belum dikonfigurasi di server.' }, { status: 503 })
  if (!/^\d{6,12}$/.test(pin)) return Response.json({ error: 'PIN tidak benar.' }, { status: 401 })
  try {
    const db = getSupabaseAdmin(), sourceHash = approvalSourceHash(request)
    const { data: lock, error: lockError } = await db.from('ahsp_approval_pin_limits').select('failures,locked_until').eq('source_hash', sourceHash).maybeSingle()
    if (lockError) throw lockError
    if (lock?.locked_until && new Date(lock.locked_until).getTime() > Date.now()) return Response.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429 })
    if (!await compare(pin, hash)) {
      const { error } = await db.rpc('ahsp_record_approval_pin_failure', { p_source_hash: sourceHash })
      if (error) throw error
      return Response.json({ error: 'PIN tidak benar.' }, { status: 401 })
    }
    const { error: clearError } = await db.from('ahsp_approval_pin_limits').delete().eq('source_hash', sourceHash)
    if (clearError) throw clearError
    return Response.json({ authenticated: true }, { headers: { 'Set-Cookie': approvalCookie(await createApprovalToken(), 20 * 60), 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Akses approval belum siap. Pastikan migrasi dan konfigurasi tersedia.' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Permintaan tidak valid.' }, { status: 403 })
  return Response.json({ authenticated: false }, { headers: { 'Set-Cookie': approvalCookie('', 0), 'Cache-Control': 'no-store' } })
}
