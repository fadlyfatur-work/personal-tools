import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Reset PIN lama sudah dinonaktifkan. Identitas akun dipulihkan melalui Google.' },
    { status: 410 },
  )
}
