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
