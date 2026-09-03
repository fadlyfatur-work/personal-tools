import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const { data, error } = await supabase
    .from('clipboard')
    .select('content')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Kode tidak ditemukan' }, { status: 404 })
  }

  return NextResponse.json({ content: data.content })
}