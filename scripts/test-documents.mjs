// Run with the local app running: node scripts/test-documents.mjs
import assert from 'node:assert/strict'
import PizZip from 'pizzip'
import { documentsLiveSession } from './helpers/documents-live-session.mjs'

const { base, request, data } = await documentsLiveSession()
const templates = []
for (let offset = 0; offset <= 10000; offset += 100) {
  const batch = await data(`/api/documents/templates?offset=${offset}`)
  templates.push(...batch)
  if (batch.length < 100) break
}
assert.ok(templates.length > 0, 'Provide at least one configured template before running this smoke check.')
const catalog = await fetch(`${base}/documents`)
assert.equal(catalog.status, 200)
const alias = await fetch(`${base}/document`)
assert.equal(new URL(alias.url).pathname, '/documents')
for (const { code } of templates) {
  const { fields, version_id } = await data(`/api/documents/templates/${encodeURIComponent(code)}`)
  const single = Object.fromEntries(fields.single.map(field => [field.key, field.type === 'dateRange' ? { start: '2026-09-28', end: '2026-09-29' } : field.type === 'date' ? '2026-09-28' : 'Uji template']))
  const groups = Object.fromEntries(fields.groups.map(group => [group.name, [Object.fromEntries(group.fields.map(field => [field.key, field.type === 'date' ? '2026-09-28' : 'Uji template']))]]))
  const response = await request('/api/generate', { method: 'POST', body: JSON.stringify({ code, version_id, single, groups }) })
  assert.equal(response.status, 200, `Generation failed for ${code}`)
  assert.match(response.headers.get('content-type'), /wordprocessingml/)
  const zip = new PizZip(Buffer.from(await response.arrayBuffer()))
  const xml = zip.file('word/document.xml').asText()
  assert.ok(xml.includes('Uji template'), `Missing submitted data in ${code}`)
  assert.ok(!xml.includes('{{'), `Unresolved placeholders in ${code}`)
}
const missing = await request('/api/generate', { method: 'POST', body: JSON.stringify({ code: '__missing_template_smoke_test__', version_id: '00000000-0000-4000-8000-000000000000', single: {}, groups: {} }) })
assert.equal(missing.status, 404, 'An unknown template must not fall back to the first template.')
console.log(`Documents: catalog, alias, ${templates.length} template download(s), DOCX content, and unknown-template checks passed.`)
