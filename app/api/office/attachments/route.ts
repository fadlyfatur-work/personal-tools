import { randomUUID } from 'node:crypto'
import { getToolsContext, toolsJson, toolsRoute, ToolsError } from '@/lib/tools/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { officeRpc, parseKind, parseId, readOfficeBody } from '@/lib/office/server'
import { attachmentUrlSchema } from '@/lib/office/domain'
export const dynamic = 'force-dynamic'
export function POST(request: Request) { return toolsRoute(request, async () => {
  const c = await getToolsContext(request, { write: true }); const query = new URL(request.url).searchParams
  const kind = parseKind(query.get('kind') ?? ''); const id = parseId(query.get('id') ?? '')
  if (kind === 'followups') throw new ToolsError(400, 'Tambahkan lampiran pada task terkait.')
  const allowed = await officeRpc<boolean>('office_access', { p_actor: c.userId, p_workspace: c.workspaceId, p_kind: kind, p_id: id, p_write: true })
  if (!allowed) throw new ToolsError(404, 'Data tidak ditemukan.')
  if (Number(request.headers.get('content-length')) > 11 * 1024 * 1024) throw new ToolsError(413, 'Lampiran maksimal 10 MiB.')
  const bytes = await readOfficeBody(request,11 * 1024 * 1024)
  let form:FormData
  try { form=await new Response(new Uint8Array(bytes),{headers:{'content-type':request.headers.get('content-type')??''}}).formData() } catch { throw new ToolsError(400,'Formulir lampiran tidak valid.') }
  const file = form.get('file'); const link = form.get('url'); const label = String(form.get('name') ?? '').trim().slice(0,200)
  if (typeof link === 'string' && link) {
    const parsed = attachmentUrlSchema.safeParse(link)
    if (!parsed.success || !label) throw new ToolsError(400, 'Isi nama bukti dan URL HTTP/HTTPS yang valid.')
    return toolsJson(await officeRpc('office_attachment_add', { p_actor: c.userId, p_workspace: c.workspaceId, p_kind: kind, p_id: id, p_name: label, p_url: parsed.data }), 201)
  }
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) throw new ToolsError(413, 'Pilih file berukuran 1 byte sampai 10 MiB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !['pdf','png','jpg','jpeg','webp','txt','csv','docx','xlsx','zip'].includes(extension)) throw new ToolsError(400, 'Format lampiran: PDF, gambar, TXT, CSV, DOCX, XLSX, atau ZIP.')
  const key = `${c.workspaceId}/${kind}/${id}/${randomUUID()}.${extension}`
  const name = (label || file.name).replace(/[\r\n\u0000-\u001f]/g, '').slice(0,200)
  const { error } = await supabaseAdmin.storage.from('office-private').upload(key, file, { contentType: 'application/octet-stream', upsert: false })
  if (error) throw new ToolsError(503, 'Lampiran gagal diunggah. Coba lagi.')
  try { return toolsJson(await officeRpc('office_attachment_add', { p_actor: c.userId, p_workspace: c.workspaceId, p_kind: kind, p_id: id, p_name: name, p_key: key, p_size: file.size }), 201) }
  catch (error) { await supabaseAdmin.storage.from('office-private').remove([key]); throw error }
}) }
export function GET(request: Request) { return toolsRoute(request, async () => {
  const c = await getToolsContext(request); const id = parseId(new URL(request.url).searchParams.get('id') ?? '')
  const { data, error } = await supabaseAdmin.from('office_attachments').select('kind,object_id,name,storage_key,url').eq('id',id).eq('workspace_id',c.workspaceId).maybeSingle()
  if (error) throw new ToolsError(503, 'Lampiran belum tersedia.')
  if (!data || !await officeRpc<boolean>('office_access', { p_actor: c.userId, p_workspace: c.workspaceId, p_kind: data.kind, p_id: data.object_id, p_write: false })) throw new ToolsError(404, 'Lampiran tidak ditemukan.')
  if (data.url) return toolsJson({ url: data.url })
  const result = await supabaseAdmin.storage.from('office-private').download(data.storage_key)
  if (result.error || !result.data) throw new ToolsError(503, 'Lampiran gagal diunduh. Coba lagi.')
  return new Response(result.data, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(data.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}) }
