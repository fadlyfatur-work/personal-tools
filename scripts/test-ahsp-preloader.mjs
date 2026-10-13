import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync('app/ahsp/initial-preloader.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
for (const reduced of [false, true]) {
  let effectIndex = 0
  const effects = [], timers = [], exits = []
  const body = { style: { overflow: 'auto' } }
  const exports = {}
  const jsx = (type, props) => ({ type, props })
  const imports = {
    'next/link': { default: 'a' }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    './catalog.module.css': { default: new Proxy({}, { get: (_, key) => key }) },
    react: { useEffect(callback, deps) {
      const index = effectIndex++, previous = effects[index]
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.(); effects[index] = { deps, cleanup: callback() }
      }
    } },
  }
  vm.runInNewContext(code, { exports, require: name => imports[name], document: { body }, window: { matchMedia: () => ({ matches: reduced }) },
    setTimeout: (callback, delay) => { const timer = { callback, delay, canceled: false }; timers.push(timer); return timer }, clearTimeout: timer => { timer.canceled = true } })
  const onExit = visible => exits.push(visible)
  const render = pending => { effectIndex = 0; return exports.default({ pending, onExit }) }
  let tree = render(true)
  assert.equal(body.style.overflow, 'hidden')
  assert.equal(timers.length, 0, 'Loading has no artificial completion timer')
  assert.equal(tree.props['data-ready'], false)
  assert.equal(tree.props.children[0].props.role, 'status')
  assert.equal(tree.props.children[1].props.href, '/menu', 'The loading screen provides a way out')
  tree = render(false)
  assert.equal(tree.props['data-ready'], true)
  assert.equal(timers[0].delay, reduced ? 0 : 180)
  timers[0].callback()
  assert.deepEqual(exits, [false])
  for (const effect of effects) effect?.cleanup?.()
  assert.equal(body.style.overflow, 'auto', 'Unmount restores the prior scroll setting')
  assert.equal(timers[0].canceled, true, 'Unmount cleans up the exit timer')
}
console.log('AHSP preloader: indeterminate loading, escape link, status announcement, 180ms exit, reduced-motion exit, scroll restoration and timer cleanup passed.')
