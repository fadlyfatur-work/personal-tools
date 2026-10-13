import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const counts = {}
for (const status of ['database_only', 'sipasti_only', 'both']) {
  const counted = await db.from('ahsp_items').select('id', { head: true, count: 'exact' }).in('regulation', ['SE 47/2026', 'PERMEN 08/2023']).eq('sipasti_status', status)
  if (counted.error) throw counted.error
  const result = await db.rpc('ahsp_search_items', { p_sipasti: status })
  if (result.error) throw result.error
  assert.equal(result.data.total, counted.count)
  assert.equal(result.data.search_stats.filtered_catalog_total, counted.count)
  assert.ok(result.data.items.every(item => item.sipasti_status === status))
  assert.equal(result.data.matched_types.reduce((sum, type) => sum + type.count, 0), counted.count)
  counts[status] = counted.count
}
const unfiltered = await db.rpc('ahsp_search_items', {})
if (unfiltered.error) throw unfiltered.error
assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), unfiltered.data.total, 'Every catalogue item has exactly one reconciliation tag')
const filtered = await db.rpc('ahsp_search_items', { p_sipasti: 'both', p_field: 'SMKK', p_terms: ['Rambu'], p_match: 'like' })
if (filtered.error) throw filtered.error
assert.ok(filtered.data.total > 0)
assert.equal(filtered.data.search_stats.like_total, filtered.data.total)
assert.equal(filtered.data.search_stats.terms[0].like_count, filtered.data.total)
assert.ok(filtered.data.items.every(item => item.sipasti_status === 'both' && item.field === 'SMKK'))
const row = await db.from('ahsp_items').select('code,name,components,analysis_status,source_id,sipasti_origin').eq('sipasti_origin', true).eq('sipasti_status', 'sipasti_only')
if (row.error) throw row.error
assert.equal(row.data.length, counts.sipasti_only)
assert.ok(row.data.every(item => item.components.length === 0 && item.analysis_status === 'unavailable' && item.source_id === null))
const collision = await db.from('ahsp_items').select('name,sipasti_status').eq('field', 'Sumber Daya Air').eq('code', 'A.3.08.3.4.b.6.f')
if (collision.error) throw collision.error
assert.equal(collision.data.filter(item => item.sipasti_status === 'both').length, 1)
assert.equal(collision.data.filter(item => item.sipasti_status === 'database_only').length, 2)
console.log(JSON.stringify({ total: unfiltered.data.total, counts, combined_filter_results: filtered.data.total, source_only_count: row.data.length, collision_check: 'passed' }, null, 2))
console.log('SIPASTI PostgreSQL: status counts, filtered statistics, combined search, provenance and code-collision checks passed.')
