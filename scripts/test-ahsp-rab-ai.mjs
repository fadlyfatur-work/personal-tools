import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { z } from 'zod'

assert.ok(fs.existsSync('lib/ahspRabAi.ts'), 'AI import contract must exist')
const exports = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/ahspRabAi.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => name === 'zod' ? { z } : (() => { throw new Error(name) })(), JSON, Date, Set, Map, crypto: globalThis.crypto })
const ai = exports
const rendered = ai.renderAiTemplate({ model: '{{model}}', value: '{{object}}', text: 'Dokumen: {{text}}' }, { model: 'demo', object: { name: 'a"b' }, text: 'a"b\nbaris' })
assert.equal(rendered.text, 'Dokumen: a"b\nbaris')
assert.equal(rendered.value.name, 'a"b')
assert.throws(() => ai.renderAiTemplate({ x: '{{missing}}' }, {}), /Variabel/)
assert.throws(() => ai.renderAiTemplate({ x: 'a{{object}}' }, { object: [] }), /utuh/)
assert.equal(ai.readAiPath({ content: [{ text: 'hasil' }] }, 'content[0].text'), 'hasil')
assert.throws(() => ai.readAiPath({}, '__proto__.x'), /Jalur/)
assert.equal(ai.readAiPath({ x: 1 }, 'missing'), undefined)
const secret = 'test-secret-do-not-leak'
const safe = ai.redactAi({ headers: { Authorization: `Bearer ${secret}`, custom: secret }, url: `https://example.com?key=${secret}`, body: { image: 'data:image/png;base64,' + 'A'.repeat(200), text: 'hello' }, response: `echo ${secret}` }, [secret])
assert.ok(!JSON.stringify(safe).includes(secret))
assert.ok(!JSON.stringify(safe).includes('A'.repeat(100)))
assert.equal(safe.body.text, 'hello')
const profile = { ...ai.aiPreset('chat'), id: 'demo', name: 'Demo', model: 'demo-model', isDefault: true }
assert.equal(ai.aiProfileSchema.safeParse(profile).success, true)
const input = { items: [{ code: 'A', name: 'Galian tanah', unit: 'm3', volume: 12.5, price: 150000, total: 1875000, source_page: 1, raw: { volume: '12,50', price: '150.000,00', total: '1.875.000,00' }, issues: [] }] }
const items = ai.parseAiItems(JSON.stringify(input), profile, [1])
assert.equal(items[0].volume, 12.5)
assert.equal(ai.parseAiItems('```json\n'+JSON.stringify(input)+'\n```', profile, [1])[0].name, 'Galian tanah')
const ambiguous = ai.parseAiItems({ items: [{ name: 'Galian', unit: 'm3', volume: '1.234', price: 0, total: null, source_page: 1 }] }, profile, [1])[0]
assert.equal(ambiguous.volume, null, 'Ambiguous strings are never guessed')
assert.equal(ambiguous.price, 0, 'Zero source prices remain zero')
assert.ok(ambiguous.issues.length)
assert.throws(() => ai.parseAiItems({ items: [{ ...input.items[0], source_page: 9 }] }, profile, [1]), /halaman/)
assert.throws(() => ai.parseAiItems({ items: [] }, profile, [1]), /item/)
assert.throws(() => ai.parseAiItems({ items: Array(1001).fill(input.items[0]) }, profile, [1]), /1.000/)
assert.throws(() => ai.parseAiItems({ items: [{ name: '', source_page: 1 }] }, profile, [1]), /uraian/)
const mapped = { ...profile, itemsPath: 'data.rows', fieldMap: { name: 'description', volume: 'quantity', source_page: 'page' } }
assert.equal(ai.parseAiItems({ data: { rows: [{ description: 'Beton', quantity: 3, page: 2 }] } }, mapped, [2])[0].volume, 3)
const rows = ai.aiItemsToRows(items, 'dokumen.pdf', 'pdf')
assert.equal(rows[0].reviewed, false)
assert.equal(rows[0].raw.price, '150.000,00')
assert.equal(rows[0].document.page, 1)
assert.equal(rows[0].document.filename, 'dokumen.pdf')
assert.equal(rows[0].candidate, null)
assert.equal(rows[0].total, 1875000)
console.log('PASS: AI templates, response paths/mapping, redaction, typed/ambiguous amounts, limits, provenance and unconfirmed RAB rows.')
