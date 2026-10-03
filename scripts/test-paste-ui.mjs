// Run: node scripts/test-paste-ui.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'

// Exercise the actual event handlers without a server or a Supabase write.
const state = []
let cursor = 0
const react = { ...React, useState(initial) {
  const index = cursor++
  if (!(index in state)) state[index] = initial
  return [state[index], value => { state[index] = value }]
} }
const context = {
  exports: {}, console,
  require: name => {
    if (name === 'react') return react
    if (name === 'next/link') return { default: 'a' }
    if (name === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`Unexpected import: ${name}`)
  },
  fetch: async () => ({ ok: false, json: async () => ({ error: 'Unavailable' }) }),
  navigator: { clipboard: { writeText: async () => { throw new Error('Denied') } } },
}
const source = fs.readFileSync('app/paste/page.tsx', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText
vm.runInNewContext(compiled, context)
function render() {
  cursor = 0
  const nodes = []
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(visit)
    nodes.push(node)
    visit(node.props?.children)
  }
  visit(context.exports.default())
  return nodes
}
const find = predicate => render().find(predicate)
const field = id => find(node => node.props?.id === id)
const button = text => find(node => node.type === 'button' && node.props.children === text)
const hasText = text => render().some(node => typeof node.props?.children === 'string' && node.props.children.includes(text))

async function main() {
  assert.equal(button('Buat Kode').props.disabled, true)
  field('paste-text').props.onChange({ target: { value: 'Teks uji' } })
  await button('Buat Kode').props.onClick()
  assert.equal(field('paste-text').props.value, 'Teks uji')
  assert.ok(find(node => node.props?.role === 'alert'))
  assert.ok(hasText('Teks belum berhasil disimpan'))
  context.fetch = async () => { throw new Error('Offline') }
  await button('Buat Kode').props.onClick()
  assert.equal(field('paste-text').props.value, 'Teks uji')
  assert.equal(button('Buat Kode').props.disabled, false)
  context.fetch = async () => ({ ok: true, json: async () => ({ code: 'ABCDE' }) })
  await button('Buat Kode').props.onClick()
  assert.equal(field('paste-text').props.value, '')
  assert.ok(!hasText('Teks belum berhasil disimpan'))
  await button('Salin').props.onClick()
  assert.ok(hasText('salin secara manual'))
  let copied
  context.navigator.clipboard.writeText = async text => { copied = text }
  await button('Salin').props.onClick()
  assert.equal(copied, 'ABCDE')
  assert.ok(hasText('Kode tersalin.'))
  console.log('PASS: HTTP/network failure preserves text; success resets form; clipboard success and denial are announced.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
