import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '../.next/ahsp-sql-test/node_modules/@electric-sql/pglite/dist/index.js'

const db = new PGlite()
try {
  await db.exec('create role anon; create role authenticated; create role service_role;')
  for (const file of ['202610120001_ahsp_catalog.sql', '202610130007_ahsp_inline_matching.sql', '202610130008_ahsp_sipasti_reconciliation.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  await db.exec(`
    insert into ahsp_sources (id,title,annex,url,sha256,page_count,checked_at)
      values ('se47','SE 47/2026','Lampiran V','https://example.test/se47','test',50,now());
    insert into ahsp_items (id,code,name,unit,field,regulation,ahsp_type,analysis_status,reconciliation_status,components)
      values
      ('00000000-0000-4000-8000-000000000001','','Papan Informasi Keselamatan konstruksi','bh','SMKK','PERMEN 08/2023','Normatif','needs_review','belum_ditemukan','[{"name":"Komponen Permen","code":"OLD"}]'),
      ('00000000-0000-4000-8000-000000000002','1.22.(2l)','Papan Informasi Keselamatan Konstruksi','Buah','SMKK','SE 47/2026','Informatif','unavailable','cocok','[{"name":"Komponen terbaru","code":"NEW"}]'),
      ('00000000-0000-4000-8000-000000000003','A','  PAPAN   INFORMASI KESELAMATAN KONSTRUKSI  ','bh.','SMKK','SE 182/2025','Normatif','unavailable','belum_ditemukan','[]'),
      ('00000000-0000-4000-8000-000000000004','0','Ｐａｐａｎ Informasi Keselamatan Konstruksi','kg','Bina Marga','SE 47/2026','Normatif','unavailable','belum_ditemukan','[]'),
      ('00000000-0000-4000-8000-000000000005','A.2','Papan Informasi Keselamatan Konstruksi tambahan','Buah','SMKK','SE 47/2026','Normatif','unavailable','belum_ditemukan','[]');
    update ahsp_items set analysis_status='extracted',source_id='se47',page_from=41,page_to=41
      where id='00000000-0000-4000-8000-000000000002';
    insert into ahsp_items (id,code,name,unit,field,regulation,analysis_status,reconciliation_status)
      select md5('latest-'||n)::uuid,'P'||lpad(n::text,3,'0'),'Item unik '||n,'Buah','Pages','SE 47/2026','unavailable','belum_ditemukan' from generate_series(1,65) n;
    insert into ahsp_items (id,code,name,unit,field,regulation,analysis_status,reconciliation_status)
      select md5('old-'||n)::uuid,'','ITEM UNIK '||n,'bh','Pages','PERMEN 08/2023','unavailable','belum_ditemukan' from generate_series(1,65) n;
  `)
  const before = (await db.query('select to_jsonb(i) as item from ahsp_items i order by id')).rows
  await db.exec(readFileSync('supabase/migrations/202610140003_ahsp_unique_work_names.sql', 'utf8'))
  assert.deepEqual((await db.query('select to_jsonb(i) as item from ahsp_items i order by id')).rows, before, 'Grouping does not modify or delete any source version')
  const search = async (terms = [], match = 'like', filters = {}) => {
    const args = Object.entries({ p_terms: terms, p_match: match, ...filters })
    const { rows } = await db.query(`select ahsp_search_items(${args.map(([key], i) => `${key}=>$${i + 1}`).join(',')}) as result`, args.map(([, value]) => value))
    return rows[0].result
  }
  const name = 'Papan Informasi Keselamatan Konstruksi'
  const grouped = await search([name], 'exact')
  assert.equal(grouped.total, 1)
  assert.equal(grouped.grouped_by_name, true)
  assert.equal(grouped.items[0].id, '00000000-0000-4000-8000-000000000002')
  assert.equal(grouped.items[0].regulation, 'SE 47/2026')
  assert.equal(grouped.items[0].versions.length, 4, 'Codes, units, fields, and archive editions remain accessible within one name group')
  assert.deepEqual(grouped.items[0].versions.map(v => v.regulation), ['SE 47/2026','SE 47/2026','PERMEN 08/2023','SE 182/2025'])
  assert.equal(grouped.search_stats.terms[0].exact_count, 1)
  assert.equal(grouped.search_stats.exact_total, 1)
  assert.deepEqual(grouped.matched_types, [{ type: 'Informatif', count: 1 }])
  const permen = await search([name], 'exact', { p_regulation: 'PERMEN 08/2023' })
  assert.equal(permen.items[0].id, '00000000-0000-4000-8000-000000000001')
  assert.equal(permen.items[0].unit, 'bh')
  assert.equal(permen.items[0].versions.length, 4)
  const archive = await search([name], 'exact', { p_regulation: 'SE 182/2025' })
  assert.equal(archive.total, 1)
  assert.equal(archive.items[0].regulation, 'SE 182/2025')
  const unit = await search([name], 'exact', { p_unit: 'bh' })
  assert.equal(unit.total, 1)
  assert.equal(unit.items[0].unit, 'Buah')
  const kg = await search([name], 'exact', { p_unit: 'kg', p_field: 'Bina Marga' })
  assert.equal(kg.items[0].unit, 'kg', 'Unit/field filters select an eligible version rather than an unrelated preferred version')
  const components = await search(['Komponen Permen'], 'like', { p_scope: 'components' })
  assert.equal(components.total, 1)
  assert.equal(components.items[0].regulation, 'PERMEN 08/2023')
  assert.deepEqual(components.items[0].matched_components, ['Komponen Permen'])
  const code = await search(['1.22.(2l)'], 'exact')
  assert.equal(code.total, 1)
  assert.equal(code.items[0].regulation, 'SE 47/2026')
  const phrases = await search(['Papan Informasi', 'Keselamatan Konstruksi'], 'phrases')
  assert.equal(phrases.total, 2, 'Similar but different names remain distinct')
  assert.ok(phrases.search_stats.terms.every(term => term.like_count === 2))
  assert.equal(phrases.search_stats.like_total, 2)
  assert.equal((await search(['Papan Informasi', 'PAPAN INFORMASI'], 'phrases')).total, 0)
  const options = (await db.query('select ahsp_catalog_options() as result')).rows[0].result
  assert.equal(options.total, 67)
  assert.equal(options.version_total, 135)
  assert.ok(options.units.includes('Buah'))
  assert.ok(!options.units.some(unit => ['bh','bh.'].includes(unit)))
  assert.equal(options.field_counts.find(field => field.field === 'Pages').count, 65)
  assert.equal(options.field_counts.find(field => field.field === 'SMKK').count, 2)
  const pages = await Promise.all([1,2,3].map(p_page => search([], 'like', { p_field: 'Pages', p_page })))
  assert.deepEqual(pages.map(page => page.items.length), [30,30,5])
  assert.ok(pages.every(page => page.total === 65))
  const pageItems = pages.flatMap(page => page.items)
  assert.equal(new Set(pageItems.map(item => item.name.toLowerCase())).size, 65, 'No name is repeated within or across pages')
  assert.ok(pageItems.every(item => item.regulation === 'SE 47/2026' && item.versions.length === 2))
  assert.deepEqual(pages[0].search_stats, pages[1].search_stats)
  await db.exec('set role anon')
  await assert.rejects(db.query('select * from ahsp_catalog_versions'), /permission denied/)
  await db.exec('reset role')
  console.log('AHSP name groups: screenshot pair, case/space/Unicode normalization, latest priority, all versions, unit aliases, filters, search statistics, pagination, data preservation, and access checks passed.')
  if (process.argv[2]) {
    const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'))
    const full = new PGlite()
    try {
      await full.exec('create role anon; create role authenticated; create role service_role;')
      for (const file of ['202610120001_ahsp_catalog.sql', '202610130007_ahsp_inline_matching.sql', '202610130008_ahsp_sipasti_reconciliation.sql', '202610140003_ahsp_unique_work_names.sql']) await full.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
      await full.query('insert into ahsp_sources select * from jsonb_populate_recordset(null::ahsp_sources, $1::jsonb)', [JSON.stringify(snapshot.sources)])
      await full.query(`insert into ahsp_items (id,code,name,unit,field,division,regulation,ahsp_type,analysis_status,source_id,page_from,page_to,components,reconciliation_status,sipasti_status)
        select * from jsonb_to_recordset($1::jsonb) as x(id uuid,code text,name text,unit text,field text,division text,regulation text,ahsp_type text,analysis_status text,source_id text,page_from integer,page_to integer,components jsonb,reconciliation_status text,sipasti_status text)`, [JSON.stringify(snapshot.items)])
      const normal = name => name.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase()
      const activeNames = new Set(snapshot.items.filter(item=>item.regulation!=='SE 182/2025').map(item=>normal(item.name)))
      const uniqueNames = new Set(snapshot.items.map(item=>normal(item.name)))
      const options = (await full.query('select ahsp_catalog_options() as result')).rows[0].result
      assert.equal(options.total, uniqueNames.size)
      assert.equal(options.version_total, snapshot.items.length)
      const pages = []
      for (const page of [1,2,3]) pages.push((await full.query('select ahsp_search_items(p_page=>$1) as result', [page])).rows[0].result)
      assert.ok(pages.every(page=>page.total===activeNames.size))
      assert.equal(new Set(pages.flatMap(page=>page.items).map(item=>normal(item.name))).size, pages.flatMap(page=>page.items).length)
      const pair = (await full.query('select ahsp_search_items(p_terms=>$1, p_match=>$2) as result', [['Papan Informasi Keselamatan Konstruksi'],'exact'])).rows[0].result
      assert.equal(pair.total, 1)
      assert.equal(pair.items[0].regulation, 'SE 47/2026')
      assert.ok(pair.items[0].versions.some(item=>item.regulation==='PERMEN 08/2023' && item.unit==='bh'))
      const started = Date.now()
      const stress = (await full.query('select ahsp_search_items(p_terms=>$1, p_match=>$2) as result', [Array.from({length:50},(_,n)=>`__uji_pengelompokan_${n}__`),'exact'])).rows[0].result
      assert.equal(stress.total, 0)
      assert.equal(stress.search_stats.input_count, 50)
      assert.equal((await full.query('select count(*)::integer as n from ahsp_items')).rows[0].n, snapshot.items.length)
      console.log(JSON.stringify({ actual_versions:snapshot.items.length, unique_names:uniqueNames.size, active_unique_names:activeNames.size, screenshot_group_versions:pair.items[0].versions.length, stress_50_terms_ms:Date.now()-started }))
    } finally { await full.close() }
  }
} finally { await db.close() }
