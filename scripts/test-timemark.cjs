const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = fs.readFileSync('app/timemark/render.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const scope = { exports: {} }
vm.runInNewContext(compiled, scope)
const { draw, dimensions } = scope.exports
const photo = { naturalWidth: 1200, naturalHeight: 1600 }
const settings = { date: '2026-09-29', time: '09:02', address: 'Alamat pengujian '.repeat(20), id: 'TEST-001', language: 'id-ID', scale: 100, x: 0, y: 100, logoSize: 10, logoX: 0, logoY: 0, accent: '#ffc800', text: '#ffffff', opacity: 95, vertical: true, hour12: false }
const texts = []
const context = new Proxy({ measureText: text => ({ width: text.length * 22 }), fillText: (...args) => texts.push(args) }, { get: (target, key) => key in target ? target[key] : () => {} })
const canvas = { getContext: () => context }
assert.deepEqual(Array.from(dimensions(photo, 90)), [1600, 1200])
draw(canvas, photo, null, 0, settings)
assert.equal(canvas.width, 1200)
assert.equal(canvas.height, 1600)
assert.ok(texts.some(([text]) => text === '09:02'))
assert.ok(texts.some(([text]) => text === 'ID Foto: TEST-001'))
assert.ok(texts.every(([, x, y, max]) => Number.isFinite(x) && Number.isFinite(y) && max > 0))
texts.length = 0
draw(canvas, photo, photo, 90, { ...settings, hour12: true }, false, 800)
assert.equal(canvas.width, 800)
assert.equal(canvas.height, 600)
assert.ok(texts.some(([text]) => text === '9:02 AM'))
texts.length = 0
draw(canvas, photo, null, 0, settings, true)
assert.equal(texts.length, 0)
console.log('Timemark: portrait, landscape, preview scaling, original view, ID, and 12-hour rendering passed.')
