import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
export function loadSuiteModule(file, stubs = {}, cache = new Map()) {
  const full = path.resolve(file)
  if (cache.has(full)) return cache.get(full)
  const loaded = { exports: {} }
  cache.set(full, loaded.exports)
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { fileName:full, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  const require = name => {
    if (Object.hasOwn(stubs, name)) return stubs[name]
    if(name.endsWith('.module.css'))return{default:{}}
    if (name.startsWith('@/') || name.startsWith('.')) {
      const source = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(full), name)
      const target = [source, `${source}.ts`, `${source}.tsx`].find(item => fs.existsSync(item) && fs.statSync(item).isFile())
      if (!target) throw new Error(`Missing module: ${source}`)
      return loadSuiteModule(target, stubs, cache)
    }
    return nativeRequire(name)
  }
  vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require, process, Buffer, TextEncoder, TextDecoder, URL, Request, Response, Headers, FormData, File, Blob, ReadableStream, DecompressionStream, AbortController, setTimeout, clearTimeout, console, crypto: globalThis.crypto }, { filename: full })
  cache.set(full, loaded.exports)
  return loaded.exports
}
