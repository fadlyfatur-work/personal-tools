// Run with the local app running: node scripts/test-documents.mjs
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import PizZip from 'pizzip'

process.loadEnvFile('.env.local')
const base = process.env.DOCUMENTS_TEST_URL || 'http://localhost:3000'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data: templates, error } = await supabase.from('templates').select('code, fields').order('name')
assert.ifError(error)
assert.ok(templates.length > 0, 'Provide at least one configured template before running this smoke check.')
const catalog = await fetch(`${base}/documents`)
assert.equal(catalog.status, 200)
const alias = await fetch(`${base}/document`)
assert.equal(new URL(alias.url).pathname, '/documents')
for (const { code, fields } of templates) {
  const single = Object.fromEntries(fields.single.map(field => [field.key, field.type === 'dateRange' ? { start: '2026-09-28', end: '2026-09-29' } : field.type === 'date' ? '2026-09-28' : 'Uji template']))
  const groups = Object.fromEntries(fields.groups.map(group => [group.name, [Object.fromEntries(group.fields.map(field => [field.key, field.type === 'date' ? '2026-09-28' : 'Uji template']))]]))
  const response = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, single, groups }) })
  assert.equal(response.status, 200, `Generation failed for ${code}`)
  assert.match(response.headers.get('content-type'), /wordprocessingml/)
  const zip = new PizZip(Buffer.from(await response.arrayBuffer()))
  const xml = zip.file('word/document.xml').asText()
  assert.ok(xml.includes('Uji template'), `Missing submitted data in ${code}`)
  assert.ok(!xml.includes('{{'), `Unresolved placeholders in ${code}`)
}
const missing = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '__missing_template_smoke_test__', single: {}, groups: {} }) })
assert.equal(missing.status, 404, 'An unknown template must not fall back to the first template.')
console.log(`Documents: catalog, alias, ${templates.length} template download(s), DOCX content, and unknown-template checks passed.`)
