import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadSuiteModule } from './helpers/load-suite-module.mjs'

assert.ok(fs.existsSync('lib/tools/policy.ts'), 'Suite account policy must exist before shared login can be used')
const policy = loadSuiteModule('lib/tools/policy.ts')
for (const unsafe of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/fintrack', '/tools/login', 'javascript:alert(1)', '/office\n']) {
  assert.equal(policy.safeToolsReturn(unsafe), '/office/tasks', unsafe)
}
assert.equal(policy.safeToolsReturn('/documents/admin?tab=tags'), '/documents/admin?tab=tags')
assert.equal(policy.safeToolsReturn('/monitoring'), '/monitoring')
assert.equal(policy.safeToolsReturn('/tools/users'), '/tools/users')
assert.equal(policy.safeToolsReturn('/tools/workspaces'), '/tools/workspaces')
assert.equal(policy.safeToolsReturn('/tools/invitation?token=test-invitation'), '/tools/invitation?token=test-invitation')
assert.equal(policy.canWriteWorkspace('viewer'), false)
assert.equal(policy.canWriteWorkspace('member'), true)
assert.equal(policy.canManageWorkspace('member'), false)
assert.equal(policy.canManageWorkspace('admin'), true)
assert.equal(policy.TOOLS_AUTH_COOKIE === 'fintrack_pin_session', false)
assert.equal(policy.isSameOriginMutation(new Request('https://app.test/api/x', { method: 'POST', headers: { origin: 'https://evil.test' } })), false)
assert.equal(policy.isSameOriginMutation(new Request('https://app.test/api/x', { method: 'POST', headers: { origin: 'https://app.test' } })), true)
assert.equal(policy.isSameOriginMutation(new Request('https://app.test/api/x', { method: 'GET' })), true)
for (const file of ['app/auth/callback/route.ts', 'app/api/fintrack/auth/login/route.ts', 'app/api/fintrack/auth/logout/route.ts']) {
  assert.ok(!fs.readFileSync(file, 'utf8').includes('auth.signOut()'), `${file} must not globally sign out suite sessions`)
}
console.log('PASS: suite return paths, roles, origin boundary, separate cookie, FinTrack local logout.')
