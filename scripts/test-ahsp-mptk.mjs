import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { createServer } from 'node:http'
import ts from 'typescript'
import { z } from 'zod'
import { PGlite } from '../.next/ahsp-sql-test/node_modules/@electric-sql/pglite/dist/index.js'

const db = new PGlite()
const migrate = async () => {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;')
  for (const file of ['202610120001_ahsp_catalog.sql', '202610130007_ahsp_inline_matching.sql', '202610130008_ahsp_sipasti_reconciliation.sql', '202610140003_ahsp_unique_work_names.sql', '202610150001_ahsp_mptk_catalog.sql', '202610150002_ahsp_mptk_validation.sql', '202610150003_ahsp_mptk_coefficients.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  }
}
const search = async (filters = {}) => {
  const args = Object.entries(filters)
  return (await db.query(`select ahsp_search_mptk(${args.map(([key], i) => `${key}=>$${i + 1}`).join(',')}) as result`, args.map(([, value]) => value))).rows[0].result
}
const coefficients = async (keys, filters = {}) => {
  const args=Object.entries({p_keys:keys,...filters})
  return (await db.query(`select ahsp_mptk_coefficients(${args.map(([key],i)=>`${key}=>$${i+1}`).join(',')}) as result`,args.map(([,value])=>value))).rows[0].result
}
try {
  await migrate()
  await db.exec(`insert into ahsp_sources (id,title,annex,url,sha256,page_count,checked_at)
    values ('source','Sumber uji','Lampiran I','https://example.test/source','test',50,now())`)
  const item = async (n, name, components, extra = {}) => {
    const data = { id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, code: `J${n}`, name, unit: 'm3', field: 'Umum', regulation: 'SE 47/2026', analysis_status: 'extracted', reconciliation_status: 'cocok', source_id: 'source', page_from: 4, output_quantity: 10, components, ...extra }
    await db.query(`insert into ahsp_items (id,code,name,unit,field,regulation,analysis_status,reconciliation_status,source_id,page_from,output_quantity,components)
      select id,code,name,unit,field,regulation,analysis_status,reconciliation_status,source_id,page_from,output_quantity,components
      from jsonb_populate_record(null::ahsp_items, $1::jsonb)`, [JSON.stringify(data)])
  }
  const component = (name, unit, code = '', coefficient = .2, group = 'tenaga') => ({ name, unit, code, coefficient, group, expression: '' })
  await item(1, 'Pekerjaan satu', [component('Pekerja', 'OH', 'L.01'), component('Semen', 'kg', '', 3, 'bahan'), component('Pekerja', 'OH', 'L.01', .3)])
  await item(2, 'Pekerjaan dua', [component('  ＰＥＫＥＲＪＡ  ', 'oh', 'L.X', .7), component('Tukang Kayu', 'OH', 'L.01'), component('Pekerja', 'OJ', 'L.01')], { analysis_status: 'needs_review' })
  await item(3, 'Versi Permen', [component('Pekerja', 'OH', '', .9)], { regulation: 'PERMEN 08/2023' })
  await item(4, 'Arsip', [component('Pekerja', 'OH', '', 100)], { regulation: 'SE 182/2025' })
  await item(5, 'Belum lengkap', [], { field: 'Bina Marga', analysis_status: 'unavailable' })
  await item(6, 'SMKK', [component('Helm', 'buah', '', 1, 'smkk')], { field: 'SMKK' })
  await item(7, 'Satuan setara', [component('Baut', 'bh', '', 1, 'bahan'), component('BAUT', 'Buah', '', 2, 'bahan'), component('', 'OH'), component('Rusak', '')])
  await item(8, 'Rumus alat', [{ ...component('Excavator', 'jam', 'E.01', null, 'alat'), expression: '1 / Q' }])
  const initial = await search()
  assert.equal(initial.total, 6)
  assert.deepEqual(initial.coverage, { jobs: 6, with_components: 5 })
  assert.ok(initial.fields.includes('Bina Marga'))
  assert.ok(!initial.fields.includes('SMKK'))
  assert.ok(initial.units.includes('Buah'))
  const workers = await search({ p_q: ' pekerja ', p_group: 'tenaga', p_unit: 'OH' })
  assert.equal(workers.total, 1)
  assert.equal(workers.items[0].job_count, 3)
  assert.equal(workers.items[0].occurrence_count, 4)
  assert.equal(workers.items[0].review_count, 1)
  assert.deepEqual(workers.items[0].codes, ['L.01', 'L.X'])
  const key = workers.items[0].key
  const usages = await search({ p_key: key })
  assert.deepEqual(usages.usages.map(u => u.coefficient), [.2, .3, .7, .9], 'Coefficients belong to each source occurrence, with active editions ordered first')
  assert.ok(usages.usages.every(u => u.output_quantity === 10 && u.source_url === 'https://example.test/source' && u.page_from === 4))
  const summary=(await coefficients([key]))[key]
  assert.equal(summary.variant_count,4)
  assert.equal(summary.numeric_count,4)
  assert.equal(summary.samples.length,2)
  assert.deepEqual(summary.samples.map(s=>s.coefficient),[.2,.3])
  assert.ok(summary.samples.every(s=>s.output_quantity===10&&s.item_unit==='m3'&&s.item_code==='J1'))
  assert.equal((await coefficients([key],{p_regulation:'PERMEN 08/2023'}))[key].samples[0].coefficient,.9)
  assert.deepEqual(await coefficients([key],{p_field:'Bina Marga'}),{})
  const formulaKey=(await search({p_q:'Excavator'})).items[0].key
  assert.equal((await coefficients([formulaKey]))[formulaKey].samples[0].expression,'1 / Q')
  await item(9,'Basis berbeda',[component('Koefisien nol','kg','',0,'bahan')],{output_quantity:1})
  await item(10,'Basis sepuluh',[component('Koefisien nol','kg','',0,'bahan')],{output_quantity:10})
  const zeroKey=(await search({p_q:'Koefisien nol'})).items[0].key
  const zero=(await coefficients([zeroKey]))[zeroKey]
  assert.equal(zero.variant_count,2,'Equal coefficients on different output quantities remain separate variants')
  assert.ok(zero.samples.every(s=>s.coefficient===0),'Zero is a real coefficient')
  await item(11,'Koefisien kosong',[component('Nilai belum tersedia','kg','',null,'bahan')])
  const missingKey=(await search({p_q:'Nilai belum tersedia'})).items[0].key
  assert.deepEqual((await coefficients([missingKey]))[missingKey],{variant_count:0,numeric_count:0,formula_count:0,missing_count:1,samples:[]})
  assert.equal((await search({ p_q: 'L.01' })).total, 3, 'A shared code never merges different names or units')
  assert.equal((await search({ p_q: '%' })).total, 0, 'Substring search treats SQL wildcards literally')
  assert.equal((await search({ p_q: "'; drop table ahsp_items;--" })).total, 0)
  assert.equal((await search({ p_q: 'Pekerja', p_unit: 'OJ' })).total, 1)
  assert.equal((await search({ p_q: 'Baut', p_unit: 'bh.' })).items[0].occurrence_count, 2)
  assert.equal((await search({ p_q: 'Excavator' })).items[0].group, 'alat')
  const expression = await search({ p_key: (await search({ p_q: 'Excavator' })).items[0].key })
  assert.equal(expression.usages[0].coefficient, null)
  assert.equal(expression.usages[0].expression, '1 / Q')
  assert.equal((await search({ p_analysis: 'needs_review' })).total, 3)
  assert.equal((await search({ p_regulation: 'SE 182/2025' })).items[0].occurrence_count, 1)
  assert.deepEqual((await search({ p_field: 'Bina Marga' })).coverage, { jobs: 1, with_components: 0 })
  assert.equal((await search({ p_key: '0'.repeat(32) })).component, null)
  for (let n = 20; n < 85; n++) await item(n, `Pekerjaan halaman ${n}`, [component(`Bahan ${n}`, 'kg', '', n, 'bahan')], { field: 'Pagination' })
  const pages = await Promise.all([1,2,3].map(p_page => search({ p_field: 'Pagination', p_page })))
  assert.deepEqual(pages.map(p => p.items.length), [30,30,5])
  assert.ok(pages.every(p => p.total === 65))
  assert.equal(new Set(pages.flatMap(p => p.items.map(i => i.key))).size, 65)
  for (let n = 90; n < 125; n++) await item(n, `Penggunaan ${n}`, [component('Pekerja', 'OH', '', n)])
  const usagePages = await Promise.all([1,2].map(p_page => search({ p_key: key, p_page })))
  assert.deepEqual(usagePages.map(p => p.usages.length), [30,9])
  assert.ok(usagePages.every(p => p.usage_total === 39))
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(db.query('select * from ahsp_mptk_occurrences'), /permission denied/)
    await assert.rejects(db.query('select ahsp_search_mptk()'), /permission denied/)
    await assert.rejects(db.query('select * from ahsp_mptk_validation'), /permission denied/)
    await assert.rejects(db.query('select ahsp_mptk_validation_stats()'), /permission denied/)
    await assert.rejects(db.query("select ahsp_validate_mptk_component('{}'::jsonb)"), /permission denied/)
    await assert.rejects(db.query("select ahsp_mptk_coefficients('{}'::text[])"), /permission denied/)
    await db.exec('reset role')
  }
  await db.exec('set role service_role')
  assert.ok((await search()).total > 0)
  await db.exec('reset role')

  let calls = 0, failure = null
  const exports = {}
  vm.runInNewContext(ts.transpileModule(readFileSync('app/api/ahsp/mptk/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, Response, URL, crypto: webcrypto, console: { error() {} }, require(name) {
      if (name === 'zod') return { z }
      if (name === '@/lib/supabaseAdmin') return { getSupabaseAdmin: () => ({ rpc: async (name, filters) => {
        calls++
        const data = failure ? null : name === 'ahsp_search_mptk' ? await search(filters)
          : name === 'ahsp_mptk_coefficients' ? await coefficients(filters.p_keys,Object.fromEntries(Object.entries(filters).filter(([key])=>key!=='p_keys')))
          : (await db.query('select ahsp_mptk_validation_stats($1,$2) as result', [filters.p_regulation,filters.p_field])).rows[0].result
        return { data, error: failure }
      } }) }
      throw new Error(`Unexpected import ${name}`)
    },
  })
  const get = params => exports.GET(new Request(`http://localhost/api/ahsp/mptk?${new URLSearchParams(params)}`))
  for (const invalid of [{ page: '-1' }, { group: 'smkk' }, { key: 'invalid' }, { q: 'x'.repeat(241) }, { regulation: 'invalid' }]) assert.equal((await get(invalid)).status, 400)
  assert.equal(calls, 0)
  assert.equal((await get({ key: '0'.repeat(32) })).status, 404)
  const response = await (await get({ q: 'Pekerja', unit: 'OH' })).json()
  assert.equal(response.items[0].key, key)
  assert.ok(response.items[0].coefficient_summary.numeric_count>0,'API includes source coefficients on each list item')
  assert.equal((await (await get({key,page:'2'})).json()).component.coefficient_summary.variant_count,39,'Detail pages retain the full coefficient summary beyond page one')
  failure = { code: 'PGRST202', message: 'private database details' }
  const unavailable = await get({})
  assert.equal(unavailable.status, 503)
  assert.ok(!(await unavailable.text()).includes('private database details'))
  console.log('MPTK SQL/API: grouping, source coefficient summaries, distinct bases, zero/missing/formula values, filters, archive isolation, pagination, API enrichment, and access checks passed.')

  const validate = async value => (await db.query('select ahsp_validate_mptk_component($1::jsonb) as result', [JSON.stringify(value)])).rows[0].result
  for (const [name, unit, sourceLine] of [
    ['Bahan *) PC: Portland Cement','Buah','B 1 Bahan *) PC: Portland Cement Buah 1'],
    ['Bahan Batu alam/batu gunung/ batu kali (Boulder kecil) > 25 - 50 cm','m3','B 1 Bahan Batu alam/batu gunung/ batu kali (Boulder kecil) > 25 - 50 cm M.03.c.2 m3 1'],
  ]) {
    const corrected = await validate({ ...component(name,unit), sourceLine })
    assert.equal(corrected.group,'bahan')
    assert.equal(corrected.category_corrected,true)
    assert.equal(corrected.original_group,'tenaga')
    assert.equal(corrected.unit,unit,'Source units are preserved even when surprising')
    assert.deepEqual(corrected.validation_issues,[])
    assert.ok(!corrected.name.startsWith('Bahan'))
  }
  assert.equal((await validate({ ...component('Peralatan Excavator','Jam','','0.5','bahan'), sourceLine:'C 1 Peralatan Excavator Jam 0,5' })).group,'alat')
  assert.equal((await validate({ ...component('Bahan tambahan','OH'), sourceLine:'1 Bahan tambahan OH 1' })).group,'tenaga','A name alone cannot override source category without a section marker')
  assert.ok((await validate({ ...component('Base camp','m2') })).validation_issues.includes('labor_unit_mismatch'))
  assert.ok((await validate({ ...component('Semen Pasir','kg m3','','1 2','bahan'), expression:'1 2' })).validation_issues.includes('merged_resources'))
  console.log('MPTK validation: both reported examples, section evidence, original units, equipment, ambiguous names, merged resources, and labor unit mismatch passed.')

  if (process.argv.includes('--snapshot')) {
    await db.exec('truncate ahsp_master_rows, ahsp_items, ahsp_sources cascade')
    const input = process.argv.find(arg => arg.startsWith('--input='))?.slice(8) ?? 'anti-slop/ahsp-name-groups/snapshot.json'
    const snapshot = JSON.parse(readFileSync(input, 'utf8'))
    await db.query('insert into ahsp_sources select * from jsonb_populate_recordset(null::ahsp_sources, $1::jsonb)', [JSON.stringify(snapshot.sources)])
    await db.query(`insert into ahsp_items (id,code,name,unit,field,division,regulation,ahsp_type,analysis_status,source_id,page_from,page_to,components,reconciliation_status,sipasti_status,output_quantity)
      select id,code,name,unit,field,division,regulation,ahsp_type,analysis_status,source_id,page_from,page_to,components,reconciliation_status,sipasti_status,coalesce(output_quantity,1)
      from jsonb_to_recordset($1::jsonb) as x(id uuid,code text,name text,unit text,field text,division text,regulation text,ahsp_type text,analysis_status text,source_id text,page_from integer,page_to integer,components jsonb,reconciliation_status text,sipasti_status text,output_quantity numeric)`, [JSON.stringify(snapshot.items)])
    const full = await search()
    assert.ok(full.coverage.with_components <= 3270)
    assert.equal((await search({ p_field: 'Bina Marga' })).total, 0)
    assert.equal((await search({ p_regulation: 'SE 182/2025' })).total, 0)
    assert.equal((await db.query("select count(*)::int as count from ahsp_mptk_occurrences where component_group='tenaga' and lower(unit) not in ('oh','oj','ob','orang hari','orang jam','orang bulan')")).rows[0].count,0)
    assert.equal((await search({ p_q:'PC: Portland Cement',p_group:'tenaga' })).total,0)
    assert.ok((await search({ p_q:'PC: Portland Cement',p_group:'bahan' })).total>0)
    assert.ok((await search({ p_q:'Boulder kecil',p_group:'bahan' })).total>0)
    const validation = (await db.query('select ahsp_mptk_validation_stats() as result')).rows[0].result
    const fixtures = { initial: full, material: await search({ p_group: 'bahan' }), workers: await search({ p_q: 'Pekerja' }), empty: await search({ p_q: 'tidak-ada-mptk' }) }
    fixtures.detail = await search({ p_key: fixtures.workers.items[0].key })
    mkdirSync('.next/mptk-test', { recursive: true })
    writeFileSync('.next/mptk-test/browser-fixtures.json', JSON.stringify(fixtures))
    const report={ snapshot: input, components: full.total, groups: full.groups, coverage: full.coverage,validation }
    writeFileSync('.next/mptk-test/validation-report.json',JSON.stringify(report,null,2))
    const held = (await db.query(`select v.item_id,i.code as job_code,i.source_id,i.page_from,v.position,v.component
      from ahsp_mptk_validation v join ahsp_items i on i.id=v.item_id
      where v.component->'validation_issues'<>'[]'::jsonb order by i.code,v.position`)).rows
    writeFileSync('.next/mptk-test/excluded-components.json',JSON.stringify(held,null,2))
    const labor = await Promise.all([1,2].map(p_page => search({p_group:'tenaga',p_page})))
    writeFileSync('.next/mptk-test/labor-names.json',JSON.stringify(labor.flatMap(p=>p.items.map(i=>({name:i.name,unit:i.unit,jobs:i.job_count}))),null,2))
    console.log(JSON.stringify(report))
    if (process.argv.includes('--serve')) {
      failure = null
      const server = createServer(async (request, response) => {
        try {
          const result = await exports.GET(new Request(`http://localhost${request.url}`))
          response.writeHead(result.status, { 'content-type': 'application/json' })
          response.end(await result.text())
        } catch { response.writeHead(500); response.end('{}') }
      })
      await new Promise(resolve => server.listen(3002, '127.0.0.1', resolve))
      console.log('MPTK browser test: API handler backed by the local snapshot on http://127.0.0.1:3002')
      await new Promise(resolve => process.once('SIGINT', () => server.close(resolve)))
    }
  }
} finally { await db.close() }
