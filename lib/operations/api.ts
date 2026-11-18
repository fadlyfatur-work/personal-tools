import { z } from 'zod'
import { supabaseAdmin as db } from '@/lib/supabaseAdmin'
import { getToolsContext, ToolsError, toolsJson } from '@/lib/tools/server'
import { coverage, monitorState, monitorTarget } from './domain'
import type { Check, Monitor } from './types'

const id = z.string().uuid()
const text = (max: number) => z.string().trim().max(max)
const required = (max: number) => text(max).min(1)
const timestamp = z.string().datetime({ offset: true })
const evidence = text(2000).refine(v => { if (!v) return true; try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password } catch { return false } }, 'Bukti harus berupa URL HTTP/HTTPS tanpa kredensial.')
const deployment = z.object({ service_id: id, environment_id: id, version: required(120), deployed_at: timestamp, performer: required(160), status: z.enum(['planned','in_progress','succeeded','failed','cancelled']), changelog: text(12000), configuration_notes: text(6000), evidence_url: evidence, rollback_plan: text(6000) }).strict()
const monitor = z.object({ service_id: id, environment_id: id, name: required(120), url: required(2000).refine(v => { try { monitorTarget(v); return true } catch { return false } }, 'Gunakan target HTTP/HTTPS publik tanpa query/kredensial, pada port standar.'), expected_statuses: z.array(z.number().int().min(100).max(599)).min(1).max(10), interval_seconds: z.number().int().min(300).max(86400), timeout_ms: z.number().int().min(1000).max(10000), failure_threshold: z.number().int().min(1).max(10), recovery_threshold: z.number().int().min(1).max(10), active: z.boolean(), maintenance: z.boolean(), maintenance_note: text(1000) }).strict().refine(v => !v.maintenance || v.maintenance_note.length > 0, 'Isi penjelasan pemeliharaan.')

function checked<T>(result: { data: T; error: { code?: string } | null }): T {
  if (result.error) throw new ToolsError(result.error.code === '23505' ? 409 : 503, result.error.code === '23505' ? 'Nama sudah digunakan. Muat ulang daftar.' : 'Data operasi belum tersedia. Periksa konfigurasi atau coba lagi.')
  return result.data
}
async function body(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new ToolsError(400, 'Isian tidak tersedia.')
  const chunks: Uint8Array[] = []; let bytes = 0
  for (;;) {
    const chunk = await reader.read()
    if (chunk.done) break
    bytes += chunk.value.byteLength
    if (bytes > 40000) { await reader.cancel(); throw new ToolsError(413, 'Isian terlalu besar.') }
    chunks.push(chunk.value)
  }
  const value = Buffer.concat(chunks).toString('utf8')
  try { return JSON.parse(value) } catch { throw new ToolsError(400, 'Format isian tidak valid.') }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new ToolsError(400, parsed.error.issues[0]?.message || 'Periksa isian formulir.')
  return parsed.data
}
async function pair(workspace: string, service: string, environment: string) {
  const found = checked(await db.from('tools_environments').select('id').eq('workspace_id', workspace).eq('service_id', service).eq('id', environment).maybeSingle())
  if (!found) throw new ToolsError(404, 'Layanan dan environment tidak ditemukan pada workspace ini.')
}
async function inventory(workspace: string, cursor?: { at: string; id: string }) {
  let releases = db.from('operations_deployments').select('*').eq('workspace_id', workspace).order('deployed_at', { ascending: false }).order('id', { ascending: false }).limit(201)
  if (cursor) releases = releases.or(`deployed_at.lt.${cursor.at},and(deployed_at.eq.${cursor.at},id.lt.${cursor.id})`)
  const results = await Promise.all([
    db.from('tools_services').select('id,name').eq('workspace_id', workspace).order('name').limit(100),
    db.from('tools_environments').select('id,name,service_id').eq('workspace_id', workspace).order('name').limit(300),
    releases,
  ])
  const found = checked(results[2]) || [], deployments = found.slice(0,200), last = deployments.at(-1)
  const rollbacks = deployments.length ? checked(await db.from('operations_rollbacks').select('*').eq('workspace_id', workspace).in('deployment_id', deployments.map(d => d.id)).order('performed_at', { ascending: false }).limit(300)) || [] : []
  return { services: checked(results[0]) || [], environments: checked(results[1]) || [], deployments, rollbacks, nextCursor: found.length > 200 && last ? `?cursor=${encodeURIComponent(last.deployed_at)}&cursor_id=${last.id}` : null }
}
export async function deploymentRead(request: Request) {
  const ctx = await getToolsContext(request)
  const query = new URL(request.url).searchParams
  const cursor = query.has('cursor') ? parse(z.object({ at: timestamp, id }), { at: query.get('cursor'), id: query.get('cursor_id') }) : undefined
  return toolsJson(await inventory(ctx.workspaceId, cursor))
}
export async function deploymentWrite(request: Request) {
  const ctx = await getToolsContext(request, { write: true }), raw = await body(request)
  const action = parse(z.object({ action: z.enum(['service','environment','create','update','rollback']) }).passthrough(), raw).action
  if (action === 'service') {
    const input = parse(z.object({ action: z.literal('service'), name: required(120) }).strict(), raw)
    const count = await db.from('tools_services').select('id', { head: true, count: 'exact' }).eq('workspace_id', ctx.workspaceId)
    checked(count)
    if ((count.count || 0) >= 100) throw new ToolsError(400, 'Batas 100 layanan per workspace tercapai.')
    return toolsJson(checked(await db.from('tools_services').insert({ name: input.name, workspace_id: ctx.workspaceId }).select('id').single()), 201)
  }
  if (action === 'environment') {
    const input = parse(z.object({ action: z.literal('environment'), service_id: id, name: required(80) }).strict(), raw)
    const service = checked(await db.from('tools_services').select('id').eq('id', input.service_id).eq('workspace_id', ctx.workspaceId).maybeSingle())
    if (!service) throw new ToolsError(404, 'Layanan tidak ditemukan.')
    const count = await db.from('tools_environments').select('id', { head: true, count: 'exact' }).eq('workspace_id', ctx.workspaceId)
    checked(count)
    if ((count.count || 0) >= 300) throw new ToolsError(400, 'Batas 300 environment per workspace tercapai.')
    return toolsJson(checked(await db.from('tools_environments').insert({ service_id: input.service_id, name: input.name, workspace_id: ctx.workspaceId }).select('id').single()), 201)
  }
  if (action === 'rollback') {
    const input = parse(z.object({ action: z.literal('rollback'), deployment_id: id, target_version: required(120), performed_at: timestamp, performer: required(160), result: required(6000), status: z.enum(['planned','succeeded','failed']) }).strict(), raw)
    const original = checked(await db.from('operations_deployments').select('id').eq('id', input.deployment_id).eq('workspace_id', ctx.workspaceId).maybeSingle())
    if (!original) throw new ToolsError(404, 'Catatan deployment tidak ditemukan.')
    return toolsJson(checked(await db.from('operations_rollbacks').insert({ deployment_id: input.deployment_id, target_version: input.target_version, performed_at: input.performed_at, performer: input.performer, result: input.result, status: input.status, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select('id').single()), 201)
  }
  const input = parse(z.object({ action: z.enum(['create','update']), id: id.optional(), revision: z.number().int().positive().optional(), data: deployment }).strict(), raw)
  await pair(ctx.workspaceId, input.data.service_id, input.data.environment_id)
  if (action === 'create') return toolsJson(checked(await db.from('operations_deployments').insert({ ...input.data, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select('id').single()), 201)
  if (!input.id || !input.revision) throw new ToolsError(400, 'Identitas dan revisi catatan wajib diisi.')
  const updated = checked(await db.from('operations_deployments').update({ ...input.data, revision: input.revision + 1 }).eq('workspace_id', ctx.workspaceId).eq('id', input.id).eq('revision', input.revision).select('id').maybeSingle())
  if (!updated) throw new ToolsError(409, 'Catatan sudah berubah. Muat ulang sebelum menyunting.')
  return toolsJson(updated)
}
export async function monitoringRead(request: Request) {
  const ctx = await getToolsContext(request), now = Date.now(), from = now - 86400000
  const [base, monitorsResult, checksResult, incidentsResult, notificationsResult] = await Promise.all([
    inventory(ctx.workspaceId), db.from('operations_monitors').select('*').eq('workspace_id', ctx.workspaceId).order('name').limit(50),
    db.from('operations_check_slots').select('*').eq('workspace_id', ctx.workspaceId).gte('scheduled_at', new Date(from - 86400000).toISOString()).order('scheduled_at', { ascending: false }).limit(15000),
    db.from('operations_incidents').select('*').eq('workspace_id', ctx.workspaceId).order('opened_at', { ascending: false }).limit(100),
    db.from('operations_notifications').select('*').eq('workspace_id', ctx.workspaceId).eq('recipient_id', ctx.userId).order('created_at', { ascending: false }).limit(100),
  ])
  const checks = (checked(checksResult) || []) as Check[]
  const monitors = (checked(monitorsResult) || []).map(m => {
    const history = checks.filter(c => c.monitor_id === m.id)
    return { ...m, display_state: monitorState(m), stats: coverage(history, Math.max(from, Date.parse(m.created_at)), now, m.interval_seconds), history: history.slice(0, 30) } as Monitor
  })
  return toolsJson({ ...base, monitors, incidents: checked(incidentsResult) || [], notifications: checked(notificationsResult) || [], range: { from: new Date(from).toISOString(), to: new Date(now).toISOString() } })
}
export async function monitoringWrite(request: Request) {
  const raw = await body(request), action = parse(z.object({ action: z.enum(['create','update','delete','read']) }).passthrough(), raw).action
  const ctx = await getToolsContext(request, { write: action !== 'read' })
  if (action === 'read') {
    const input = parse(z.object({ action: z.literal('read'), id }).strict(), raw)
    checked(await db.from('operations_notifications').update({ read_at: new Date().toISOString() }).eq('workspace_id', ctx.workspaceId).eq('recipient_id', ctx.userId).eq('id', input.id))
    return toolsJson({ saved: true })
  }
  if (action === 'delete') {
    const input = parse(z.object({ action: z.literal('delete'), id, revision: z.number().int().positive() }).strict(), raw)
    const deleted = checked(await db.from('operations_monitors').delete().eq('workspace_id', ctx.workspaceId).eq('id', input.id).eq('revision', input.revision).select('id').maybeSingle())
    if (!deleted) throw new ToolsError(409, 'Monitor sudah berubah. Muat ulang daftar.')
    return toolsJson({ deleted: true })
  }
  const input = parse(z.object({ action: z.enum(['create','update']), id: id.optional(), revision: z.number().int().positive().optional(), data: monitor }).strict(), raw)
  await pair(ctx.workspaceId, input.data.service_id, input.data.environment_id)
  if (action === 'create') return toolsJson(checked(await db.from('operations_monitors').insert({ ...input.data, workspace_id: ctx.workspaceId, created_by: ctx.userId }).select('id').single()), 201)
  if (!input.id || !input.revision) throw new ToolsError(400, 'Identitas dan revisi monitor wajib diisi.')
  const updated = checked(await db.from('operations_monitors').update({ ...input.data, revision: input.revision + 1, state: 'unknown', disabled_reason: null, last_checked_at: null, consecutive_failures: 0, consecutive_successes: 0, next_due_at: new Date().toISOString() }).eq('workspace_id', ctx.workspaceId).eq('id', input.id).eq('revision', input.revision).select('id').maybeSingle())
  if (!updated) throw new ToolsError(409, 'Monitor sudah berubah. Muat ulang sebelum menyunting.')
  return toolsJson(updated)
}
