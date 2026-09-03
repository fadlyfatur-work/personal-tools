import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/generateCode'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { content } = await req.json()

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return NextResponse.json({ error: 'Teks tidak boleh kosong' }, { status: 400 })
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