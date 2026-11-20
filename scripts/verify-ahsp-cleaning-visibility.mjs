import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const root = 'anti-slop/ahsp-master-2026-11-19/cleaning-1502'
const removed = JSON.parse(readFileSync(`${root}/removal-backup.json`, 'utf8')).rows
const corrected = JSON.parse(readFileSync(`${root}/unit-update-backup.json`, 'utf8')).after_update
assert.equal(removed.length, 44)
assert.equal(corrected.length, 12)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const removedIds = removed.map(item => item.id)
const [items, versions, units] = await Promise.all([
  db.from('ahsp_items').select('id').in('id', removedIds),
  db.from('ahsp_catalog_versions').select('id').in('id', removedIds),
  db.from('ahsp_items').select('id,unit').in('id', corrected.map(item => item.id)),
])
for (const query of [items, versions, units]) assert.ifError(query.error)
assert.equal(items.data.length, 0)
assert.equal(versions.data.length, 0)
assert.equal(units.data.length, 12)
const unitById = new Map(units.data.map(row => [row.id, row.unit]))
for (const item of corrected) assert.equal(unitById.get(item.id), item.unit)

const searchResults = await Promise.all([...new Set(removed.map(item => item.regulation))].map(async regulation => {
  const codeItems = removed.filter(item => item.regulation === regulation)
  const params = {
    p_terms: codeItems.map(item => item.code), p_page: 1, p_field: 'Bina Marga', p_division: '', p_unit: '',
    p_regulation: regulation, p_analysis: '', p_scope: 'jobs', p_match: 'exact', p_sipasti: '',
  }
  const first = await db.rpc('ahsp_search_items', params)
  assert.ifError(first.error)
  const pages = [first.data]
  for (let page = 2; page <= Math.ceil(first.data.total / first.data.pageSize); page += 1) {
    const next = await db.rpc('ahsp_search_items', { ...params, p_page: page })
    assert.ifError(next.error)
    pages.push(next.data)
  }
  return pages.flatMap(result => result.items.flatMap(group => group.versions ?? []))
}))
const visibleCodes = searchResults.flat()
const stillSearchable = removed.filter(item => visibleCodes.some(version => version.code === item.code && version.regulation === item.regulation))
const report = {
  checked_at: new Date().toISOString(),
  removed_ids_in_table: items.data.length,
  removed_ids_in_catalog_view: versions.data.length,
  removed_codes_searchable_in_same_field_and_regulation: stillSearchable.length,
  corrected_units_confirmed: corrected.length,
  corrected_unit_counts: corrected.reduce((counts, item) => ((counts[item.unit] = (counts[item.unit] ?? 0) + 1), counts), {}),
  remaining_searchable_codes: stillSearchable.map(item => ({
    removed_id: item.id,
    code: item.code,
    name: item.name,
    regulation: item.regulation,
    remaining_catalog_versions: visibleCodes.filter(version => version.code === item.code && version.regulation === item.regulation),
  })),
}
writeFileSync(`${root}/visibility-check.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
