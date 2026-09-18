import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Registrasi manual sudah dinonaktifkan. Akun dibuat saat pertama kali masuk dengan Google.' },
    { status: 410 },
  )
}
