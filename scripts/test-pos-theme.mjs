import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = fs.readFileSync('lib/pos/theme.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
function browser(saved, blocked = false) {
  let raw = saved
  const events = new Map()
  let subscribe, getSnapshot, serverSnapshot
  const context = { exports: {}, window: { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) }, localStorage: { getItem() { if (blocked) throw Error('blocked'); return raw }, setItem(key, value) { if (blocked) throw Error('blocked'); raw = value } }, require: () => ({ useSyncExternalStore(sub, get, server) { subscribe = sub; getSnapshot = get; serverSnapshot = server; return get() } }) }
  vm.runInNewContext(compiled, context)
  context.exports.usePosTheme()
  return { api: context.exports, subscribe: callback => subscribe(callback), snapshot: () => getSnapshot(), server: () => serverSnapshot(), raw: () => raw, external(value, key = 'personal-tools-pos-theme-v1') { raw = value; events.get('storage')?.({ key }) }, listeners: () => events.size }
}
const first = browser(null)
assert.equal(first.server().preference, 'system', 'SSR must follow CSS system preference')
const unsubscribe = first.subscribe(() => {})
assert.equal(first.snapshot().preference, 'system')
first.api.setPosTheme('dark')
assert.equal(first.snapshot().preference, 'dark')
assert.equal(first.raw(), 'dark')
const reload = browser(first.raw())
reload.subscribe(() => {})
assert.equal(reload.snapshot().preference, 'dark', 'Manual preference must survive refresh')
first.external('light')
assert.equal(first.snapshot().preference, 'light', 'Theme should synchronize between tabs')
first.external('invalid')
assert.equal(first.snapshot().preference, 'system')
first.api.setPosTheme('system')
assert.equal(first.raw(), 'system')
first.external('dark', 'unrelated-key')
assert.equal(first.snapshot().preference, 'system', 'Other storage keys must be ignored')
unsubscribe()
assert.equal(first.listeners(), 0)
const unavailable = browser(null, true)
unavailable.subscribe(() => {})
unavailable.api.setPosTheme('dark')
assert.equal(unavailable.snapshot().preference, 'dark', 'Blocked storage must not prevent changing theme')
assert.match(unavailable.snapshot().error, /halaman ini/)
console.log('POS theme: system default, manual preference, reload, tab sync and blocked storage passed')

const css = fs.readFileSync('app/aplikasi-pos/pos.module.css', 'utf8')
const blocks = [css.match(/\.workspace \{([^}]+)\}/)[1], css.match(/\.workspace\[data-theme="dark"\] \{([^}]+)\}/)[1]]
const pairs = [['--text', '--canvas'], ['--text', '--surface'], ['--muted', '--surface'], ['--muted', '--surface-subtle'], ['--on-accent', '--green'], ['--accent-text', '--pale'], ['--danger-text', '--error-surface'], ['--warning-text', '--warning-surface'], ['--success-text', '--success-surface']]
function luminance(hex) {
  const expanded = hex.length === 4 ? [...hex.slice(1)].map(c => c + c).join('') : hex.slice(1)
  return expanded.match(/../g).map(c => parseInt(c, 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0)
}
let lowest = Infinity
for (const [index, block] of blocks.entries()) {
  const tokens = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]+)/g)].map(match => [match[1], match[2]]))
  for (const [foreground, background] of pairs) {
    const values = [luminance(tokens[foreground]), luminance(tokens[background])]
    const ratio = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
    assert.ok(ratio >= 4.5, `${index ? 'Dark' : 'Light'} ${foreground}/${background}: ${ratio.toFixed(2)}`)
    lowest = Math.min(lowest, ratio)
  }
}
console.log(`POS theme: ${pairs.length * blocks.length} semantic text pairs pass AA; minimum ${lowest.toFixed(2)}:1`)
