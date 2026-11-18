import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { checkTarget, type CheckResult } from '@/lib/operations/network'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) {
  const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
  const secret = process.env.TOOLS_WORKER_SECRET
  if (!secret || secret.length < 32) return response({ error: 'Worker belum dikonfigurasi.' }, 503)
  const supplied = Buffer.from(request.headers.get('authorization') || ''), expected = Buffer.from(`Bearer ${secret}`)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return response({ error: 'Akses ditolak.' }, 401)
  try {
    const reminders = await db.rpc('office_process_reminders', { p_now: new Date().toISOString() })
    if (reminders.error && !['PGRST202','42883'].includes(reminders.error.code)) return response({ error: 'Pengingat belum dapat diproses.' }, 503)
    const reminderStatus = reminders.error ? 'setup_required' : 'processed'
    const jobs = await db.rpc('operations_claim_checks', { p_limit: 8 })
    if (jobs.error) return response({ error: 'Antrean pemeriksaan belum tersedia.' }, 503)
    let accepted = 0
    const queue = [...(jobs.data || [])] as { slot: { id: string; lease_token: string }; monitor: { url: string; timeout_ms: number; expected_statuses: number[]; active: boolean; maintenance: boolean } }[]
    await Promise.all(Array.from({ length: 2 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const result: CheckResult | { outcome: string } = !job.monitor.active ? { outcome: 'paused' } : job.monitor.maintenance ? { outcome: 'maintenance' } : await checkTarget(job.monitor)
        const saved = await db.rpc('operations_finish_check', { p_slot: job.slot.id, p_lease: job.slot.lease_token, p_result: result })
        if (saved.error) throw new Error('RESULT_STORE_FAILED')
        if (saved.data) accepted++
      }
    }))
    return response({ accepted, claimed: jobs.data?.length || 0, reminders: reminderStatus, reminders_created: reminders.error ? 0 : reminders.data })
  } catch { return response({ error: 'Pemeriksaan belum selesai. Slot dapat dicoba ulang setelah lease berakhir.' }, 503) }
}
