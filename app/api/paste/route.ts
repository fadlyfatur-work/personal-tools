import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/generateCode'
import { NextRequest, NextResponse } from 'next/server'
import { clientKey, rateLimit } from '@/lib/rateLimit'

const MAX_CONTENT_LENGTH = 100_000

export async function POST(req: NextRequest) {
  const limit = rateLimit(`paste:${clientKey(req)}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
  }

  const body = await req.json().catch(() => null)
  const content = body && typeof body === 'object' ? (body as { content?: unknown }).content : null

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return NextResponse.json({ error: 'Teks tidak boleh kosong' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Teks terlalu panjang. Maksimal ${MAX_CONTENT_LENGTH.toLocaleString('id-ID')} karakter.` },
      { status: 413 },
    )
  }

  let code: string = ''
  let success = false

  for (let i = 0; i < 5; i++) {
    code = generateCode(5)
    const { error: insertError } = await supabase
      .from('clipboard')
      .insert({ code, content })

    if (!insertError) {
      success = true
      break
    }
  }

  if (!success) {
    return NextResponse.json({ error: 'Gagal menyimpan, coba lagi' }, { status: 500 })
  }

  return NextResponse.json({ code })
}