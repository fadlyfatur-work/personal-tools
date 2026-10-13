import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const search = async args => {
  const result = await db.rpc('ahsp_search_items', args)
  if (result.error) throw new Error(result.error.message)
  return result.data
}
const terms = ['Petugas pengatur lalu lintas', 'Peralatan P3K', 'Rambu petunjuk', 'Rambu peringatan', 'Rambu informasi', 'Kerucut lalu lintas (traffic cone)', 'Tongkat pengatur lalu lintas (Warning Lights Stick)', 'Lampu/alat penerangan sementara']
const catalog = await search({ p_terms: [] })
assert.equal(catalog.catalog_types.reduce((sum, type) => sum + type.count, 0), catalog.total)
assert.equal(catalog.items.length, Math.min(30, catalog.total))
const like = await search({ p_terms: terms, p_match: 'like' })
assert.equal(like.search_stats.input_count, 8)
assert.equal(like.search_stats.terms.length, 8)
assert.equal(like.search_stats.like_total, like.total)
assert.equal(like.matched_types.reduce((sum, type) => sum + type.count, 0), like.total)
const exact = await search({ p_terms: terms, p_match: 'exact' })
assert.equal(exact.total, like.search_stats.exact_total)
assert.equal(exact.search_stats.found_terms, like.search_stats.exact_found_terms)
const overlap = await search({ p_terms: ['Rambu', 'Rambu petunjuk'], p_match: 'like' })
assert.equal(overlap.total, overlap.search_stats.terms[0].like_count, 'A narrower overlapping term does not duplicate work items')
assert.ok(overlap.search_stats.terms.reduce((sum, term) => sum + term.like_count, 0) > overlap.total)
const pageTwo = await search({ p_terms: terms, p_match: 'like', p_page: 2 })
assert.equal(pageTwo.total, like.total)
assert.deepEqual(pageTwo.search_stats, like.search_stats, 'Statistics describe all matches, not only the current page')
assert.ok(pageTwo.items.every(item => !like.items.some(first => first.id === item.id)))
const stressStart = Date.now()
const stress = await search({ p_terms: Array.from({ length: 50 }, (_, i) => `uji item ${i}`), p_match: 'exact' })
assert.equal(stress.search_stats.input_count, 50)
assert.equal(stress.search_stats.terms.length, 50)
assert.equal(stress.total, 0)
const stressMs = Date.now() - stressStart
console.log(JSON.stringify({ catalog: catalog.total, like: like.total, exact: exact.total, foundTerms: like.search_stats.found_terms, exactTerms: exact.search_stats.found_terms, overlapUnique: overlap.total, types: catalog.catalog_types }, null, 2))
console.log(`PostgreSQL search: per-term counts, exact/like union, overlapping terms, types, pagination, and 50 terms (${stressMs} ms) passed.`)
