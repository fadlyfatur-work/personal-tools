import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { requireSensitivePin } from '@/lib/fintrackPin'

const schema = z.object({ decision: z.enum(['accepted', 'rejected']) })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const pinError = await requireSensitivePin(req, auth.identity.id)
  if (pinError) return pinError
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Keputusan tidak valid' }, { status: 400 })
  const { id } = await params
  const { data, error } = await supabaseAdmin.rpc('fintrack_review_join_request', {
    p_actor_id: auth.identity.id,
    p_request_id: id,
    p_decision: parsed.data.decision,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
