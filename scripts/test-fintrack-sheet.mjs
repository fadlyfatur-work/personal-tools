import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const effects = [], refs = [], frames = new Map()
let frameId = 0, now = 0, closed = 0, reduced = false, restored = false
const jsx = (type, props) => ({ type, props })
const trigger = { isConnected: true, focus() { restored = true } }
class HTMLElement {}
Object.setPrototypeOf(trigger, HTMLElement.prototype)
const document = { activeElement: trigger, body: { style: { overflow: 'auto' } } }
const source = fs.readFileSync('app/fintrack/components/transaction-sheet.tsx', 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
const context = { exports: {}, require(name) {
  if (name === 'react') return { useRef(value) { const ref = { current: value }; refs.push(ref); return ref }, useEffect(fn) { effects.push(fn) } }
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
  throw Error(name)
}, HTMLElement, document, performance: { now: () => now }, matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }), requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId }, cancelAnimationFrame(id) { frames.delete(id) } }
vm.runInNewContext(code, context)
const tree = context.exports.TransactionSheet({ children: close => ({ close }), onClose() { closed++ } })
const panel = tree.props.children
refs[0].current = { style: { setProperty() {} }, showModal() {}, close() {} }
refs[1].current = { style: {}, offsetHeight: 600 }
const cleanups = effects.map(fn => fn())
function flush() {
  for (let i = 0; frames.size && i < 200; i++) {
    now += 16
    const pending = [...frames.values()]; frames.clear()
    pending.forEach(fn => fn(now))
  }
  assert.equal(frames.size, 0, 'spring settles')
}
flush()
assert.ok(Math.abs(refs[2].current.y) < .5)
const handle = panel.props.children[0].props
const target = { setPointerCapture() {}, hasPointerCapture() { return true }, releasePointerCapture() {} }
const event = (y, time) => ({ isPrimary: true, button: 0, pointerId: 1, clientY: y, timeStamp: time, currentTarget: target })
handle.onPointerDown(event(0, 0)); handle.onPointerMove(event(50, 200)); handle.onPointerUp(event(50, 400)); flush()
assert.equal(closed, 0, 'short slow drag returns')
handle.onPointerDown(event(0, 500)); handle.onPointerMove(event(200, 600)); handle.onPointerCancel(event(200, 610)); flush()
assert.equal(closed, 0, 'cancelled drag returns')
handle.onPointerDown(event(0, 700)); handle.onPointerMove(event(80, 730)); handle.onPointerUp(event(80, 735)); flush()
assert.equal(closed, 1, 'fast flick dismisses')
refs[2].current.y = 0
panel.props.children[1].close()
now += 16
const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now))
const before = refs[2].current.y
handle.onPointerDown(event(20, 800))
assert.equal(refs[2].current.y, before, 'interruption preserves current position')
handle.onPointerCancel(event(20, 810)); flush()
assert.equal(closed, 1, 'interrupted close can return')
refs[2].current.reduced = true
tree.props.onCancel({ preventDefault() {} })
assert.equal(closed, 2, 'Escape closes immediately with reduced motion')
assert.equal(refs[1].current.style.transform, 'none')
cleanups.forEach(fn => fn?.())
assert.equal(document.body.style.overflow, 'auto')
assert.ok(restored, 'focus restored to trigger')
console.log('PASS: spring, short drag, flick, cancellation, interruption, Escape, reduced motion, focus restoration')
