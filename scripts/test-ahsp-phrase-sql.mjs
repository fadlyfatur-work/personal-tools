import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '../.next/ahsp-sql-test/node_modules/@electric-sql/pglite/dist/index.js'

const db = new PGlite()
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table ahsp_items (
      id text primary key, code text, name text, unit text default 'ls',
      field text default 'Umum', division text default 'sample', regulation text default 'SE 47/2026',
      ahsp_type text default 'Normatif', analysis_status text default 'extracted', source_id text,
      page_from integer, page_to integer, sipasti_status text default 'both', components jsonb default '[]'
    );
    insert into ahsp_items (id, code, name) values
      ('three', 'Z', 'Mobilisasi dan Demobilisasi Alat Berat Excavator'),
      ('two', 'A', 'Mobilisasi dan Demobilisasi Alat   Berat'),
      ('reverse', 'B', 'EXCAVATOR untuk Alat Berat'),
      ('one', 'C', 'Pengoperasian Excavator'),
      ('none', 'Alat Berat Excavator', 'Pekerjaan lain'),
      ('literal', 'D', 'Material 20%_ khusus');
    update ahsp_items set components = '[{"name":"Alat Berat Excavator","code":"EX"}]' where id = 'none';
    update ahsp_items set field = 'Bina Marga', regulation = 'PERMEN 08/2023', unit = 'jam',
      analysis_status = 'unavailable', sipasti_status = 'database_only' where id = 'reverse';
    insert into ahsp_items (id, code, name, division)
      select 'page-' || n, lpad(n::text, 3, '0'), 'Alat Berat Excavator ' || n, 'pages' from generate_series(1,65) n;
    insert into ahsp_items (id, code, name, regulation) values ('inactive', '0', 'Alat Berat Excavator', 'OLD');
  `)
  await db.exec(readFileSync('supabase/migrations/202610130007_ahsp_inline_matching.sql', 'utf8'))
  const oldSql = readFileSync('supabase/migrations/202610130008_ahsp_sipasti_reconciliation.sql', 'utf8')
  const start = oldSql.indexOf('create or replace function public.ahsp_search_items(')
  await db.exec(oldSql.slice(start, oldSql.indexOf('$$;', start) + 3))
  const search = async (terms = [], match = 'like', filters = {}) => {
    const args = { p_terms: terms, p_match: match, ...filters }
    const entries = Object.entries(args)
    const { rows } = await db.query(`select ahsp_search_items(${entries.map(([key], i) => `${key} => $${i + 1}`).join(',')}) as result`, entries.map(([, value]) => value))
    return rows[0].result
  }
  const scenarios = [
    [[], 'like'], [['Excavator'], 'like'], [['Pengoperasian Excavator'], 'exact'],
    [['EX'], 'exact', { p_scope: 'components' }], [['20%_'], 'like'],
    [['Alat Berat', 'Excavator'], 'like', { p_scope: 'jobs', p_page: 2 }],
    [[], 'like', { p_field: 'Bina Marga', p_sipasti: 'database_only' }],
    [['Alat Berat'], 'like', { p_unit: 'ls', p_division: 'sample', p_analysis: 'extracted', p_regulation: 'SE 47/2026' }],
  ]
  const baseline = await Promise.all(scenarios.map(args => search(...args)))
  await db.exec(readFileSync('supabase/migrations/202610140001_ahsp_phrase_search.sql', 'utf8'))
  for (const [index, args] of scenarios.entries()) {
    const result = await search(...args)
    delete result.search_stats.match
    result.items.forEach(item => delete item.matched_phrase_count)
    assert.deepEqual(result, baseline[index], `Existing search behavior is preserved: ${JSON.stringify(args)}`)
  }
  const terms = ['Mobilisasi dan Demobilisasi', 'Alat Berat', 'Excavator']
  const result = await search(terms, 'phrases', { p_division: 'sample', p_scope: 'components' })
  assert.equal(result.total, 3, 'Only names with two or more matching phrases qualify; codes and components cannot supply matches')
  assert.deepEqual(result.items.map(item => item.id), ['three', 'two', 'reverse'])
  assert.deepEqual(result.items.map(item => item.matched_phrase_count), [3, 2, 2])
  assert.ok(result.items.every(item => item.matched_components.length === 0))
  assert.equal(result.search_stats.match, 'phrases')
  assert.equal(result.search_stats.like_total, result.total)
  assert.deepEqual(result.search_stats.terms.map(term => term.like_count), [2, 3, 2], 'Per-phrase counts include only qualifying results')
  assert.equal(result.matched_types.reduce((sum, row) => sum + row.count, 0), result.total)
  assert.equal((await search(['Excavator', 'EXCAVATOR'], 'phrases')).total, 0, 'Repeated phrases cannot satisfy the threshold')
  assert.equal((await search([], 'phrases')).total, 0)
  assert.deepEqual((await search(['Material', '20%_'], 'phrases')).items.map(item => item.id), ['literal'], 'Percent and underscore are literal text, not SQL wildcards')
  for (const filters of [
    { p_field: 'Bina Marga' }, { p_unit: 'jam' }, { p_regulation: 'PERMEN 08/2023' },
    { p_analysis: 'unavailable' }, { p_sipasti: 'database_only' },
  ]) {
    const filtered = await search(terms, 'phrases', { p_division: 'sample', ...filters })
    assert.deepEqual(filtered.items.map(item => item.id), ['reverse'], 'Metadata filters still apply to phrase search')
  }
  const page1 = await search(terms, 'phrases', { p_division: 'pages' })
  const page2 = await search(terms, 'phrases', { p_division: 'pages', p_page: 2 })
  const page3 = await search(terms, 'phrases', { p_division: 'pages', p_page: 3 })
  assert.equal(page1.total, 65)
  assert.deepEqual([page1.items.length, page2.items.length, page3.items.length], [30, 30, 5])
  assert.equal(new Set([...page1.items, ...page2.items, ...page3.items].map(item => item.id)).size, 65)
  assert.deepEqual(page2.search_stats, page1.search_stats)
  assert.deepEqual(page3.search_stats, page1.search_stats)
  console.log('AHSP PostgreSQL: >=2 distinct name phrases, ranking, filters, totals, pagination, and existing modes passed.')
} finally {
  await db.close()
}
