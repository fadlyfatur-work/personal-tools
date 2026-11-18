import 'server-only'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getToolsContext, ToolsError } from '@/lib/tools/server'
import { mutationSchema, officeKinds, schemas, type OfficeKind, type OfficeRecord } from './domain'
import { getAuthorizedTemplate } from '@/lib/documents/server'
import type { ToolsContext } from '@/lib/tools/types'

export async function officeRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name, args)
  if (error) {
    if(['PGRST202','PGRST205','42P01','42883'].includes(error.code||''))throw new ToolsError(503,'Office belum disiapkan oleh pengelola. Data Anda belum dimuat. Coba lagi setelah penyiapan selesai.','OFFICE_SETUP_REQUIRED')
    const code = error.message.match(/OFFICE_[A-Z_]+/)?.[0]
    const errors: Record<string, [number, string]> = {
      OFFICE_NOT_FOUND: [404, 'Data tidak ditemukan atau tidak dapat diakses.'], OFFICE_FORBIDDEN: [403, 'Anda tidak dapat mengubah data ini.'],
      OFFICE_CONFLICT: [409, 'Data telah berubah. Muat versi terbaru sebelum menyimpan kembali.'], OFFICE_FOLLOWUPS_OPEN: [409, 'Selesaikan atau batalkan seluruh tindak lanjut terlebih dahulu.'],
      OFFICE_CHECKLIST_CONFIRM: [409, 'Konfirmasikan checklist yang belum selesai.'], OFFICE_FINAL_REVISE: [409, 'Buka revisi rapat sebelum menyunting notulensi final.'],
      OFFICE_REOPEN_REQUIRED: [409, 'Buka kembali task terlebih dahulu.'], OFFICE_INVALID_ASSIGNEE: [400, 'PIC harus menjadi anggota workspace.'], OFFICE_PRIVATE_ASSIGNEE: [400, 'Task pribadi hanya dapat ditugaskan kepada pemiliknya. Ubah lingkup untuk menugaskan anggota lain.'],
      OFFICE_TASK_CLOSED: [409, 'Buka kembali task sebelum menambahkan tindak lanjut aktif.'], OFFICE_INVALID: [400, 'Periksa kembali isian Anda.'],
    }
    const [status, message] = errors[code ?? ''] ?? [503, 'Layanan Office belum tersedia. Coba lagi setelah konfigurasi database diperiksa.']
    throw new ToolsError(status, message, code ?? 'OFFICE_UNAVAILABLE')
  }
  return data as T
}
export function parseKind(value: string): OfficeKind {
  if (!(officeKinds as readonly string[]).includes(value)) throw new ToolsError(404, 'Halaman tidak ditemukan.')
  return value as OfficeKind
}
export function parseId(value: string) { const parsed = z.string().uuid().safeParse(value); if (!parsed.success) throw new ToolsError(404, 'Data tidak ditemukan.'); return parsed.data }
export async function readOfficeBody(request: Request, maximum: number) {
  if (Number(request.headers.get('content-length')) > maximum) throw new ToolsError(413, 'Isian terlalu besar.')
  const reader = request.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []; let length = 0
  try { for (;;) { const next = await reader.read(); if (next.done) break; length += next.value.byteLength; if (length > maximum) { await reader.cancel(); throw new ToolsError(413, 'Isian terlalu besar.') } chunks.push(next.value) } }
  finally { reader.releaseLock() }
  return Buffer.concat(chunks)
}
export async function officeRead(request: Request, kind: OfficeKind | 'notifications', id?: string) {
  const c = await getToolsContext(request)
  const url = new URL(request.url)
  const filters = Object.fromEntries(['status','category','assignee_id','owner_id','contact','task_id','from','to','overdue'].map(key => [key, url.searchParams.get(key) ?? '']))
  if (filters.task_id) parseId(filters.task_id)
  if (filters.assignee_id) parseId(filters.assignee_id)
  if (filters.owner_id) parseId(filters.owner_id)
  for (const key of ['from','to']) if (filters[key] && !z.string().date().safeParse(filters[key]).success) throw new ToolsError(400,'Filter tanggal tidak valid.')
  return officeRpc('office_read', { p_actor: c.userId, p_workspace: c.workspaceId, p_kind: kind, p_id: id ?? null, p_search: (url.searchParams.get('q') ?? '').slice(0, 200), p_offset: Math.trunc(Math.min(10000, Math.max(0, Number(url.searchParams.get('offset')) || 0))), p_filters: filters })
}
export async function officeWrite(request: Request, kind: OfficeKind | 'notifications', id?: string) {
  const c = await getToolsContext(request)
  let body: unknown
  try { body = JSON.parse((await readOfficeBody(request, 262144)).toString('utf8')) } catch (error) { if (error instanceof ToolsError) throw error; throw new ToolsError(400, 'Isian tidak valid.') }
  const parsed = mutationSchema.safeParse(body)
  if (!parsed.success) throw new ToolsError(400, 'Periksa bentuk isian Anda.')
  const command = parsed.data
  if (c.role === 'viewer' && command.action !== 'seen') throw new ToolsError(403, 'Peran Anda hanya dapat membaca workspace.')
  const allowedActions: Record<OfficeKind | 'notifications',string[]> = { tasks:['save','reopen'],followups:['save','note'],activities:['save'],meetings:['save','reopen','convert'],knowledge:['save','restore'],notifications:['seen'] }
  if (!allowedActions[kind].includes(command.action)) throw new ToolsError(400, 'Tindakan tidak tersedia untuk catatan ini.')
  let data: Record<string, unknown> = command.data
  if (command.action === 'save') {
    if (kind === 'notifications') throw new ToolsError(400, 'Tindakan tidak tersedia.')
    const confirm = data.confirm_incomplete === true
    const clean = { ...data }; delete clean.confirm_incomplete
    const result = schemas[kind].safeParse(clean)
    if (!result.success) throw new ToolsError(400, result.error.issues.map(row => `${row.path.join('.')}: ${row.message}`).join('; '))
    data = { ...result.data, ...(kind === 'tasks' && confirm ? { confirm_incomplete: true } : {}) }
    if (kind === 'knowledge') {
      for (const link of (data.links ?? []) as { kind: string; code?: string }[]) if (link.kind === 'template') await getAuthorizedTemplate(request, link.code!)
    }
  } else if (command.action === 'convert') {
    data = { action_item_id: parseId(String(data.action_item_id ?? '')) }
  } else if (command.action === 'restore') {
    const version = z.number().int().positive().safeParse(data.version)
    if (!version.success) throw new ToolsError(400, 'Versi tidak valid.')
    data = { version: version.data }
    if (kind === 'knowledge' && id) {
      const allowed = await officeRpc<boolean>('office_access',{p_actor:c.userId,p_workspace:c.workspaceId,p_kind:kind,p_id:id,p_write:true})
      if (!allowed) throw new ToolsError(404,'Artikel tidak ditemukan.')
      const { data: event, error } = await supabaseAdmin.from('office_events').select('snapshot').eq('workspace_id',c.workspaceId).eq('kind',kind).eq('object_id',id).eq('revision',version.data).maybeSingle()
      if (error) throw new ToolsError(503,'Riwayat versi belum tersedia.')
      if (!event) throw new ToolsError(404,'Versi tidak ditemukan.')
      for (const link of (event.snapshot.data.links ?? []) as { kind:string;code?:string }[]) if(link.kind==='template') await getAuthorizedTemplate(request,link.code!)
    }
  } else if (command.action === 'note') {
    const content = z.string().trim().min(1).max(10000).safeParse(data.content)
    if (!content.success) throw new ToolsError(400, 'Isi komunikasi wajib diisi, maksimal 10.000 karakter.')
    data = { content: content.data }
  }
  if (!id && command.action !== 'save') throw new ToolsError(400, 'Tindakan membutuhkan data tersimpan.')
  return officeRpc('office_mutate', { p_actor: c.userId, p_workspace: c.workspaceId, p_kind: kind, p_action: command.action, p_id: id ?? null, p_revision: command.revision ?? null, p_data: data })
}
export type OfficeReport = { from:string; to:string; snapshot:string; activities:OfficeRecord[]; events:{ created_at:string; action:string; snapshot:OfficeRecord }[] }
export async function officeReport(request:Request):Promise<OfficeReport> {
  const c=await getToolsContext(request); const url=new URL(request.url); const date=z.string().date()
  const from=date.safeParse(url.searchParams.get('from')),to=date.safeParse(url.searchParams.get('to'))
  if(!from.success||!to.success||from.data>to.data||(Date.parse(to.data)-Date.parse(from.data))/86400000>366)throw new ToolsError(400,'Pilih periode laporan maksimal 366 hari.')
  const requestedSnapshot=url.searchParams.get('snapshot')
  if(requestedSnapshot&&!z.string().datetime({offset:true}).safeParse(requestedSnapshot).success)throw new ToolsError(400,'Batas waktu laporan tidak valid.')
  const result=await officeRpc<OfficeReport>('office_report',{p_actor:c.userId,p_workspace:c.workspaceId,p_from:from.data,p_to:to.data,p_snapshot:requestedSnapshot??new Date().toISOString()})
  if(result.activities.length>2000||result.events.length>2000||Buffer.byteLength(JSON.stringify(result))>2*1024*1024)throw new ToolsError(413,'Laporan terlalu besar. Pilih periode lebih pendek.')
  return result
}
export async function officeMembers(c:Pick<ToolsContext,'userId'|'workspaceId'|'name'>) {
  const { data: members, error }=await supabaseAdmin.from('tools_workspace_members').select('user_id').eq('workspace_id',c.workspaceId).limit(200)
  if(error)throw new ToolsError(503,'Daftar anggota belum tersedia.')
  const ids=[...new Set([c.userId,...(members??[]).map(row=>row.user_id)])]
  const {data:profiles,error:profileError}=await supabaseAdmin.from('tools_profiles').select('user_id,name').in('user_id',ids)
  if(profileError)throw new ToolsError(503,'Daftar anggota belum tersedia.')
  return ids.map(id=>({id,name:profiles?.find(row=>row.user_id===id)?.name||(id===c.userId?c.name:'Anggota workspace')}))
}
