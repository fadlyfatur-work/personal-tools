import { getToolsContext, toolsRoute } from '@/lib/tools/server'
import { officeRpc, parseId, officeReport, officeMembers } from '@/lib/office/server'
import { officeDocx } from '@/lib/office/docx'
import type { OfficeRecord } from '@/lib/office/domain'
export const dynamic = 'force-dynamic'
export function GET(request: Request) { return toolsRoute(request, async () => {
  const url = new URL(request.url)
  let title: string; let lines: string[]
  if (url.searchParams.get('meeting')) {
    const c = await getToolsContext(request)
    const result = await officeRpc<{ record: OfficeRecord }>('office_read', { p_actor: c.userId, p_workspace: c.workspaceId, p_kind: 'meetings', p_id: parseId(url.searchParams.get('meeting')!), p_offset: 0, p_search: '', p_filters: {} })
    const row = result.record; const d = row.data
    const people=await officeMembers(c)
    title = row.title
    lines = [`Status: ${row.status==='final'?'Final':'Draft'}; revisi ${row.revision}`, `Waktu: ${new Intl.DateTimeFormat('id-ID',{dateStyle:'full',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(String(d.held_at)))} (Asia/Jakarta)`, `Lokasi/media: ${d.location}`, `Pimpinan: ${d.chair}`, `Notulis: ${d.note_taker}`, `Peserta: ${d.participants}`, `Agenda\n${d.agenda}`, `Pembahasan\n${d.discussion}`, `Keputusan\n${d.decisions}`, `Ringkasan\n${d.summary}`, 'Action item', ...(d.action_items as { title: string; assignee_id: string | null; due_date: string | null }[]).map(item => `${item.title} | PIC: ${item.assignee_id?(people.find(person=>person.id===item.assignee_id)?.name??'Anggota tidak aktif'):'Belum ditetapkan'} | Tenggat: ${item.due_date ?? '-'}`)]
  } else {
    const result = await officeReport(request)
    title = `Laporan aktivitas ${result.from}–${result.to}`
    lines = [`Zona waktu: Asia/Jakarta. Batas snapshot: ${result.snapshot}`, 'Aktivitas dan hasil', ...result.activities.flatMap(row => [`${row.data.occurred_on} — ${row.title}`, `Progres: ${row.data.progress}`, `Hasil: ${row.data.result}`, `Kendala: ${row.data.obstacle}`, `Bukti: ${row.data.evidence_url || '-'}`]), 'Riwayat perubahan task pada periode', ...result.events.map(event => `${event.created_at}: ${event.snapshot.title} — ${event.snapshot.status} (revisi ${event.snapshot.revision}, ${event.action})`)]
  }
  const file = officeDocx(title, lines)
  return new Response(new Uint8Array(file), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="office.docx"', 'Cache-Control': 'private, no-store' } })
}) }
