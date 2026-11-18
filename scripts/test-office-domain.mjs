import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const source = fs.readFileSync('lib/office/domain.ts', 'utf8')
const context = { exports: {}, require, Date, URL }
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context)
const d = context.exports
const actor = { userId: 'a', workspaceId: 'w', role: 'admin' }
const task = { workspace_id: 'w', owner_id: 'b', visibility: 'private' }
assert.equal(d.canRead(actor, task), false, 'admins cannot read another owner private content')
assert.equal(d.canRead({ ...actor, userId: 'b' }, task), true)
assert.equal(d.canRead({ ...actor, workspaceId: 'x' }, task), false)
assert.equal(d.canEdit({ ...actor, role: 'member' }, { ...task, visibility: 'workspace' }), false)
assert.equal(d.canEdit(actor, { ...task, visibility: 'workspace' }), true)
assert.equal(d.reminderRecipient({owner_id:'owner',data:{assignee_id:'pic-a'}}),'pic-a')
assert.equal(d.reminderRecipient({owner_id:'owner',data:{assignee_id:'pic-b'}}),'pic-b','reminders route to the current PIC after reassignment')
assert.equal(d.reminderRecipient({owner_id:'owner',data:{assignee_id:null}}),'owner','unassigned task reminders route to its owner')
assert.throws(() => d.assertTaskClosure('done', [{ status: 'waiting' }], [], false), /tindak lanjut/i)
assert.throws(() => d.assertTaskClosure('done', [], [{ done: false }], false), /checklist/i)
assert.doesNotThrow(() => d.assertTaskClosure('done', [{ status: 'cancelled' }], [{ done: false }], true))
assert.equal(d.isOverdue({ status: 'waiting', due_date: '2026-10-25' }, new Date('2026-10-25T16:59:59Z')), false)
assert.equal(d.isOverdue({ status: 'waiting', due_date: '2026-10-25' }, new Date('2026-10-25T17:00:00Z')), true)
assert.equal(d.isOverdue({ status: 'done', due_date: '2026-10-24' }, new Date('2026-10-26T00:00:00Z')), false)
const id = '00000000-0000-4000-8000-000000000001'
const parsed = d.taskSchema.parse({ title: 'Pekerjaan', assignee_id: id, visibility: 'private', checklist: [] })
assert.equal(parsed.status, 'todo')
assert.equal(d.taskSchema.safeParse({ title: '', actor: 'spoof' }).success, false)
assert.equal(d.articleSchema.safeParse({ title: 'A', content: 'B', links: [{ kind: 'task', id }] }).success, true)
assert.equal(d.followupSchema.safeParse({ task_id: id, title: 'Hubungi', contact: 'Budi', requested_on: '2026-02-30', due_date: '2026-03-01' }).success, false)
assert.equal(d.attachmentUrlSchema.safeParse('javascript:alert(1)').success, false)
assert.equal(d.attachmentUrlSchema.safeParse('https://example.com/bukti').success, true)
const report = d.reportRows([{ id: 'a', occurred_on: '2026-10-25', data: { progress: 'Progres', result: 'Hasil' }, created_at: '2026-10-26T10:00:00Z' }], '2026-10-25', '2026-10-25', '2026-10-26T09:00:00Z')
assert.equal(report.length, 0, 'snapshot excludes later corrections/new activities')
console.log('Office domain: access, closure, current reminder routing, date, schema, and snapshot checks passed')
