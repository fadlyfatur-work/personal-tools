import { z } from 'zod'

export const officeKinds = ['tasks', 'followups', 'activities', 'meetings', 'knowledge'] as const
export type OfficeKind = typeof officeKinds[number]
export type OfficeRecord = { id: string; workspace_id: string; owner_id: string; visibility: 'private' | 'workspace'; title: string; status: string; revision: number; created_at: string; updated_at: string; data: Record<string, unknown>; task_id?: string }
type Actor = { userId: string; workspaceId: string; role: string }
type Scoped = { workspace_id: string; owner_id: string; visibility: string }
export function canRead(actor: Actor, row: Scoped) { return actor.workspaceId === row.workspace_id && (row.owner_id === actor.userId || row.visibility === 'workspace') }
export function canEdit(actor: Actor, row: Scoped) { return actor.role !== 'viewer' && canRead(actor, row) && (row.owner_id === actor.userId || ['admin', 'owner'].includes(actor.role)) }
export function reminderRecipient(task: { owner_id:string; data:{ assignee_id?:string|null } }) { return task.data.assignee_id || task.owner_id }
export function assertTaskClosure(status: string, followups: { status: string }[], checklist: { done: boolean }[], confirm: boolean) {
  if (!['done', 'cancelled'].includes(status)) return
  if (followups.some(row => !['done', 'cancelled'].includes(row.status))) throw new Error('Tutup seluruh tindak lanjut terlebih dahulu.')
  if (status === 'done' && checklist.some(row => !row.done) && !confirm) throw new Error('Konfirmasikan checklist yang belum selesai.')
}
export function isOverdue(row: { status: string; due_date?: string | null }, now = new Date()) {
  if (!row.due_date || ['done', 'cancelled'].includes(row.status)) return false
  return now.getTime() >= new Date(`${row.due_date}T00:00:00+07:00`).getTime() + 86400000
}
const uuid = z.string().uuid()
const text = z.string().trim().max(20000)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(value); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value }, 'Tanggal tidak valid')
export const attachmentUrlSchema = z.string().url().max(2048).refine(value => ['https:', 'http:'].includes(new URL(value).protocol), 'Gunakan URL HTTP/HTTPS')
const visibility = z.enum(['private', 'workspace']).default('private')
const base = { title: z.string().trim().min(1).max(200), visibility }
const checklist = z.array(z.object({ id: uuid, text: z.string().trim().min(1).max(500), done: z.boolean() }).strict()).max(100).default([])
export const taskSchema = z.object({ ...base, description: text.default(''), assignee_id: uuid.nullable().default(null), status: z.enum(['todo', 'doing', 'waiting', 'done', 'cancelled']).default('todo'), priority: z.enum(['low', 'normal', 'high']).default('normal'), category: z.string().trim().max(100).default(''), due_date: date.nullable().default(null), checklist }).strict()
export const followupSchema = z.object({ title: base.title, task_id: uuid, contact: z.string().trim().min(1).max(200), requested_on: date, due_date: date, status: z.enum(['waiting', 'needed', 'done', 'cancelled']).default('waiting'), result: text.default(''), reminder_at: z.string().datetime({ offset: true }).nullable().default(null) }).strict().refine(value => value.due_date >= value.requested_on, { message: 'Target respons tidak boleh sebelum permintaan', path: ['due_date'] })
export const activitySchema = z.object({ task_id: uuid, occurred_on: date, progress: z.string().trim().min(1).max(10000), obstacle: text.default(''), result: text.default(''), evidence_url: attachmentUrlSchema.or(z.literal('')).default('') }).strict()
const actionItem = z.object({ id: uuid, title: base.title, assignee_id: uuid.nullable(), due_date: date.nullable() }).strict()
export const meetingSchema = z.object({ ...base, status: z.enum(['draft', 'final']).default('draft'), held_at: z.string().datetime({ offset: true }), location: z.string().max(300).default(''), chair: z.string().max(200).default(''), note_taker: z.string().max(200).default(''), participants: text.default(''), agenda: text.default(''), discussion: text.default(''), decisions: text.default(''), summary: text.default(''), action_items: z.array(actionItem).max(100).default([]) }).strict().refine(value => new Set(value.action_items.map(row => row.id)).size === value.action_items.length, { message: 'ID action item ganda', path: ['action_items'] })
export const articleSchema = z.object({ ...base, status: z.enum(['draft', 'published', 'archived']).default('draft'), content: text.default(''), category: z.string().trim().max(100).default(''), tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]), revision_note: z.string().trim().max(1000).default(''), links: z.array(z.union([z.object({ kind: z.enum(['task', 'meeting']), id: uuid }).strict(),z.object({ kind: z.literal('template'), code: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/) }).strict()])).max(30).default([]) }).strict()
export const schemas = { tasks: taskSchema, followups: followupSchema, activities: activitySchema, meetings: meetingSchema, knowledge: articleSchema }
export const mutationSchema = z.object({ action: z.enum(['save', 'reopen', 'restore', 'convert', 'note', 'seen']).default('save'), revision: z.number().int().positive().optional(), data: z.record(z.string(), z.unknown()).default({}) }).strict()
export function reportRows<T extends { occurred_on: string; created_at: string }>(activities: T[], from: string, to: string, snapshot: string) { return activities.filter(row => row.occurred_on >= from && row.occurred_on <= to && row.created_at <= snapshot) }
export const statusLabels: Record<string, string> = { todo: 'Belum mulai', doing: 'Berjalan', waiting: 'Menunggu', needed: 'Perlu tindak lanjut', done: 'Selesai', cancelled: 'Dibatalkan', draft: 'Draft', final: 'Final', published: 'Terbit', archived: 'Arsip' }
