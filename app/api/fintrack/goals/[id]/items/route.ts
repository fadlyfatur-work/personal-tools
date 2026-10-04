import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { getOwnedGoal } from '@/lib/fintrackGoalServer'

export const dynamic = 'force-dynamic'
const itemSchema = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60), estimated_amount: z.number().finite().positive().max(999999999999) })

async function write(req: NextRequest, context: { params: Promise<{ id: string }> }, method: 'POST' | 'PATCH' | 'DELETE') {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Tujuan tidak valid' }, { status: 400 })
  const goal = await getOwnedGoal(auth.identity.id, id)
  if (!goal || goal.status === 'archived') return NextResponse.json({ error: 'Tujuan tidak tersedia' }, { status: 404 })
  const raw = await req.json().catch(() => null)
  const parsed = (method === 'DELETE' ? z.object({ id: z.string().uuid() }) : method === 'PATCH' ? itemSchema.required({ id: true }) : itemSchema).safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Isi item dan estimasi biaya yang valid.' }, { status: 400 })
  let result
  if (method === 'DELETE') {
    result = await supabaseAdmin.from('fintrack_goal_items').delete().eq('goal_id', id).eq('id', parsed.data.id!).select('id').maybeSingle()
  } else {
    const value = parsed.data as z.infer<typeof itemSchema>
    const payload = { name: value.name, estimated_amount: value.estimated_amount }
    result = method === 'POST'
      ? await supabaseAdmin.from('fintrack_goal_items').insert({ ...payload, goal_id: id }).select().single()
      : await supabaseAdmin.from('fintrack_goal_items').update(payload).eq('goal_id', id).eq('id', value.id!).select().maybeSingle()
  }
  if (result.error) return NextResponse.json({ error: 'Item gagal disimpan' }, { status: 500 })
  if (!result.data) return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })
  return NextResponse.json({ data: result.data }, { status: method === 'POST' ? 201 : 200 })
}
export const POST = (req: NextRequest, context: { params: Promise<{ id: string }> }) => write(req, context, 'POST')
export const PATCH = (req: NextRequest, context: { params: Promise<{ id: string }> }) => write(req, context, 'PATCH')
export const DELETE = (req: NextRequest, context: { params: Promise<{ id: string }> }) => write(req, context, 'DELETE')
