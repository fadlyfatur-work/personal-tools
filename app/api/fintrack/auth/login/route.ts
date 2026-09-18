import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Login PIN lama sudah dinonaktifkan. Gunakan Masuk dengan Google.' },
    { status: 410 },
  )
}
