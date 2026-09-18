import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAccountAccess, requireFintrackIdentity } from '@/lib/fintrackUser'
import { requireSensitivePin } from '@/lib/fintrackPin'

const schema = z.object({ account_id: z.string().uuid() })
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createInviteCode() {
  const bytes = randomBytes(10)
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const pinError = await requireSensitivePin(req, auth.identity.id)
  if (pinError) return pinError
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Dompet tidak valid' }, { status: 400 })
  const access = await getAccountAccess(auth.identity.id, parsed.data.account_id)
  if (access?.role !== 'owner') return NextResponse.json({ error: 'Hanya owner yang dapat membuat undangan' }, { status: 403 })

  const code = createInviteCode()
  const codeHash = createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseAdmin.from('fintrack_account_invites').insert({
    account_id: parsed.data.account_id,
    code_hash: codeHash,
    created_by: auth.identity.id,
    expires_at: expiresAt,
    max_uses: 1,
  })
  if (error) return NextResponse.json({ error: 'Gagal membuat kode undangan' }, { status: 500 })
  return NextResponse.json({ code, expires_at: expiresAt, account: access.account.name }, { status: 201 })
}
