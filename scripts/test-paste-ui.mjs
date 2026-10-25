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
    if (name === '@phosphor-icons/react') return new Proxy({}, { get: (_, name) => name })
    if (name.endsWith('.module.css')) return { default: {} }
    if (name === 'react/jsx-runtime') return jsxRuntime
    throw new Error(`Unexpected import: ${name}`)
  },
  fetch: async () => ({ ok: false, json: async () => ({ error: 'Unavailable' }) }),
  navigator: { clipboard: { writeText: async () => { throw new Error('Denied') } } },
}
const source = fs.readFileSync('app/paste/paste-workspace.tsx', 'utf8')
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
  visit(context.exports.PasteWorkspace())
  return nodes
}
const find = predicate => render().find(predicate)
const field = id => find(node => node.props?.id === id)
function textContent(node) {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textContent).join('')
  return textContent(node?.props?.children ?? '')
}
const button = text => find(node => node.type === 'button' && textContent(node) === text)
const hasText = text => render().some(node => typeof node.props?.children === 'string' && node.props.children.includes(text))
async function submit(index = 0) {
  render().filter(node => node.type === 'form')[index].props.onSubmit({ preventDefault() {} })
  await new Promise(resolve => setImmediate(resolve))
}

async function main() {
  assert.equal(button('Buat Kode').props.disabled, true)
  field('paste-text').props.onChange({ target: { value: 'Teks uji' } })
  await submit()
  assert.equal(field('paste-text').props.value, 'Teks uji')
  assert.ok(find(node => node.props?.role === 'alert'))
  assert.ok(hasText('Teks belum berhasil disimpan'))
  context.fetch = async () => { throw new Error('Offline') }
  await submit()
  assert.equal(field('paste-text').props.value, 'Teks uji')
  assert.equal(button('Buat Kode').props.disabled, false)
  context.fetch = async () => ({ ok: true, json: async () => ({ code: 'ABCDE' }) })
  await submit()
  assert.equal(field('paste-text').props.value, '')
  assert.ok(!hasText('Teks belum berhasil disimpan'))
  await button('Salin').props.onClick()
  assert.ok(hasText('salin secara manual'))
  let copied
  context.navigator.clipboard.writeText = async text => { copied = text }
  await button('Salin').props.onClick()
  assert.equal(copied, 'ABCDE')
  assert.ok(hasText('Kode tersalin.'))
  assert.equal(button('Ambil').props.disabled, true)
  field('paste-code').props.onChange({ target: { value: 'abcde' } })
  assert.equal(field('paste-code').props.value, 'ABCDE')
  let requestUrl
  context.fetch = async url => {
    requestUrl = url
    return { ok: true, json: async () => ({ content: 'Baris pertama\nBaris kedua' }) }
  }
  await submit(1)
  assert.equal(requestUrl, '/api/paste/ABCDE')
  assert.equal(field('paste-result').props.value, 'Baris pertama\nBaris kedua')
  await button('Salin teks').props.onClick()
  assert.equal(copied, 'Baris pertama\nBaris kedua')
  assert.ok(hasText('Teks tersalin.'))
  context.navigator.clipboard.writeText = async () => { throw new Error('Denied') }
  await button('Salin teks').props.onClick()
  assert.ok(hasText('Pilih teks hasil dan salin secara manual'))
  context.fetch = async () => ({ ok: false, json: async () => ({ error: 'Kode tidak ditemukan' }) })
  await submit(1)
  assert.ok(hasText('Kode tidak ditemukan'))
  assert.equal(field('paste-code').props['aria-invalid'], true)
  assert.equal(field('paste-result'), undefined)
  context.fetch = async () => { throw new Error('Offline') }
  await submit(1)
  assert.ok(hasText('Terjadi kesalahan, coba lagi'))
  assert.equal(button('Ambil').props.disabled, false)
  let finishRequest
  context.fetch = () => new Promise(resolve => { finishRequest = resolve })
  await submit(1)
  assert.equal(button('Mencari...').props.disabled, true)
  assert.ok(hasText('Sedang mencari teks...'))
  finishRequest({ ok: true, json: async () => ({ content: 'Selesai' }) })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(field('paste-result').props.value, 'Selesai')
  console.log('PASS: save/fetch success, HTTP/network errors, loading, uppercase codes, and clipboard success/denial.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
