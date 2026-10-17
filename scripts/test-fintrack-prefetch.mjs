import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { QueryClient, queryOptions } from '@tanstack/react-query'

const calls = []
const exports = {}
const imports = {
  '@tanstack/react-query': { queryOptions },
  './fintrackRequest': { fintrackRequest: async url => {
    calls.push(url)
    return Response.json({ data: url.includes('/goals') ? [] : { transactions: [] } })
  } },
}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/fintrackClient.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, require: name => imports[name] })

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
const params = new URLSearchParams({ month: '2026-10', details: '0', page: '1', include_transfers: '1' }).toString()
const activity = () => exports.fintrackActivityOptions('user-a', params)
await Promise.all([client.prefetchQuery(activity()), client.prefetchQuery(activity())])
await client.fetchQuery(activity())
assert.equal(calls.length, 1, 'Prefetch and page must share fresh data and in-flight requests')
await client.fetchQuery(exports.fintrackActivityOptions('user-b', params))
assert.equal(calls.length, 2, 'Activity caches must be scoped to user')
await client.prefetchQuery(exports.fintrackGoalsOptions())
await client.fetchQuery(exports.fintrackGoalsOptions())
assert.equal(calls.length, 3, 'Goals page and composer reuse preloaded goals')
await client.invalidateQueries({ queryKey: ['fintrack', 'goals'] })
await client.fetchQuery(exports.fintrackGoalsOptions())
assert.equal(calls.length, 4, 'Writes can invalidate preloaded goals')
client.clear()
console.log('PASS: warm-cache reuse, in-flight deduplication, user scope, and invalidation.')
