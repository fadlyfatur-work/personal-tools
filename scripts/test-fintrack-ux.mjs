import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const exports = {}
const code = ts.transpileModule(fs.readFileSync('lib/fintrackUx.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
vm.runInNewContext(code, { exports, URLSearchParams })
const { loginCallbackMessage, activityAccount, sheetCloseState } = exports
assert.match(loginCallbackMessage('oauth'), /Google/)
assert.match(loginCallbackMessage('identity'), /email/i)
assert.match(loginCallbackMessage('bootstrap'), /profil/i)
assert.equal(loginCallbackMessage('arbitrary internal detail'), '')
assert.equal(activityAccount('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111')
assert.equal(activityAccount('not-an-id'), '__all__')
assert.equal(sheetCloseState(false, false, false), 'close')
assert.equal(sheetCloseState(true, false, false), 'confirm')
assert.equal(sheetCloseState(true, true, false), 'wait')
assert.equal(sheetCloseState(true, true, true), 'close', 'A successful save may close the sheet')
console.log('FinTrack UX helpers passed')
