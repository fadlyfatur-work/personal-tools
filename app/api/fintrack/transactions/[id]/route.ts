import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { requireSensitivePin } from '@/lib/fintrackPin'

const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().positive().finite(),
  from_account_id: z.string().uuid().nullable().optional(),
  to_account_id: z.string().uuid().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(240).nullable().optional(),
  transaction_date: z.iso.date(),
  allow_negative: z.boolean().default(false),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const parsed = transactionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { id } = await params
  const { data, error } = await supabaseAdmin.rpc('fintrack_replace_transaction', {
    p_actor_id: auth.identity.id,
    p_transaction_id: id,
    p_type: parsed.data.type,
    p_amount: parsed.data.amount,
    p_from_account_id: parsed.data.from_account_id || null,
    p_to_account_id: parsed.data.to_account_id || null,
    p_category_id: parsed.data.category_id || null,
    p_note: parsed.data.note || null,
    p_transaction_date: parsed.data.transaction_date,
    p_allow_negative: parsed.data.allow_negative,
  })
  if (error?.message.includes('FINTRACK_NEGATIVE_BALANCE')) {
    return NextResponse.json({ error: 'Saldo dompet akan menjadi negatif.', code: 'NEGATIVE_BALANCE' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const pinError = await requireSensitivePin(req, auth.identity.id)
  if (pinError) return pinError
  const { id } = await params
  const { data, error } = await supabaseAdmin.rpc('fintrack_void_transaction', {
    p_actor_id: auth.identity.id,
    p_transaction_id: id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
