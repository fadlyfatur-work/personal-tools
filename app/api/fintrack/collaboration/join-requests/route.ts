import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'

const schema = z.object({ code: z.string().trim().toUpperCase().length(10) })

export async function POST(req: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Kode undangan harus 10 karakter' }, { status: 400 })
  const codeHash = createHash('sha256').update(parsed.data.code).digest('hex')
  const { data, error } = await supabaseAdmin.rpc('fintrack_request_account_join', {
    p_actor_id: auth.identity.id,
    p_code_hash: codeHash,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data }, { status: 201 })
}
