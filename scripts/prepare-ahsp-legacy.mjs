import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export const LEGACY_REGULATION = 'SE 182/2025'
export const LEGACY_NOTICE = 'Digantikan oleh SE 47/2026'
const normalize = value => value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase()
const uuid = identity => {
  const chars = createHash('sha256').update(`ahsp-legacy:${LEGACY_REGULATION}:${identity}`).digest('hex').slice(0, 32).split('')
  chars[12] = '8'; chars[16] = (8 | (parseInt(chars[16], 16) & 3)).toString(16)
  const hex = chars.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function prepareLegacyItems(rows, fields) {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(fields)) throw new Error('Ekspor dan daftar bidang tidak valid.')
  const fieldNames = new Map(fields.map(field => [field.id, field.name]))
  const items = new Map()
  rows.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object' || typeof raw.regulasi_se !== 'string'
      || !raw.regulasi_se.split(',').map(value => value.trim()).includes(LEGACY_REGULATION)
      || !fieldNames.has(raw.job_field_id) || typeof raw.name !== 'string' || !raw.name.trim()
      || (raw.code !== null && typeof raw.code !== 'string') || (raw.unit !== null && typeof raw.unit !== 'string')
      || !['normative', 'informative'].includes(raw.job_type)) throw new Error(`Baris ${index + 1}: data SE 182/2025 tidak valid.`)
    const field = fieldNames.get(raw.job_field_id)
    const code = (raw.code ?? '').trim(), name = raw.name.trim(), unit = (raw.unit ?? '').trim()
    const identity = JSON.stringify([normalize(code).replace(/\s/gu, ''), normalize(name), normalize(unit), field])
    const existing = items.get(identity)
    if (existing) {
      if (existing.ahsp_type !== ({ normative: 'Normatif', informative: 'Informatif' })[raw.job_type]) throw new Error(`Baris ${index + 1}: jenis item duplikat berbeda.`)
      existing.sipasti_rows.push(index + 1)
    } else items.set(identity, { id: uuid(identity), code, name, unit, field,
      ahsp_type: ({ normative: 'Normatif', informative: 'Informatif' })[raw.job_type], sipasti_rows: [index + 1] })
  })
  return [...items.values()]
}

const literal = value => `'${value.replaceAll("'", "''")}'`
const jsonSql = (value, prefix) => {
  const json = JSON.stringify(value)
  let delimiter = `$${prefix}$`
  while (json.includes(delimiter)) delimiter = delimiter.replace(/\$$/, '_$')
  return `${delimiter}${json}${delimiter}::jsonb`
}

export function legacyImportSql({ sha256, sourceName, rows, items }) {
  if (!/^[a-f0-9]{64}$/.test(sha256) || !items.length) throw new Error('Snapshot impor tidak valid.')
  return `begin;
set local standard_conforming_strings = on;
lock table public.ahsp_items in share row exclusive mode;
create temporary table ahsp_legacy_import_items on commit drop as
  select * from jsonb_to_recordset(${jsonSql(items, 'ahsp_items')})
  as x(id uuid, code text, name text, unit text, field text, ahsp_type text, sipasti_rows integer[]);
do $ahsp_check$ begin
  if exists (select 1 from ahsp_legacy_import_items x join public.ahsp_items i using (id)
    where i.regulation <> '${LEGACY_REGULATION}' or i.code <> x.code or i.name <> x.name
      or i.unit <> x.unit or i.field <> x.field or i.ahsp_type <> x.ahsp_type) then
    raise exception 'Identitas arsip bertabrakan dengan data yang sudah ada; impor dibatalkan';
  end if;
end $ahsp_check$;
insert into public.ahsp_sipasti_imports (sha256, source_name, source_rows)
  values (${literal(sha256)}, ${literal(sourceName)}, ${jsonSql(rows, 'ahsp_source')})
  on conflict (sha256) do nothing;
insert into public.ahsp_items (id, code, name, unit, field, regulation, ahsp_type, regulation_status,
  analysis_status, reconciliation_status, sipasti_origin, sipasti_status, sipasti_sha256, sipasti_rows)
  select id, code, name, unit, field, '${LEGACY_REGULATION}', ahsp_type, '${LEGACY_NOTICE}',
    'unavailable', 'belum_ditemukan', true, 'sipasti_only', ${literal(sha256)}, sipasti_rows
  from ahsp_legacy_import_items on conflict (id) do nothing;
select '${LEGACY_REGULATION}' as regulation, count(*) as imported_items
  from public.ahsp_items where id in (select id from ahsp_legacy_import_items);
commit;
`
}

export async function applyLegacyItems(db, { sha256, sourceName, rows, items }) {
  const existing = new Map()
  for (let start = 0; start < items.length; start += 100) {
    const result = await db.from('ahsp_items').select('id,code,name,unit,field,regulation,ahsp_type').in('id', items.slice(start, start + 100).map(item => item.id))
    if (result.error) throw new Error('Identitas arsip belum dapat diperiksa; belum ada perubahan data.')
    for (const item of result.data) existing.set(item.id, item)
  }
  for (const item of items) {
    const previous = existing.get(item.id)
    if (previous && (previous.regulation !== LEGACY_REGULATION || ['code', 'name', 'unit', 'field', 'ahsp_type'].some(key => previous[key] !== item[key]))) throw new Error('Identitas arsip bertabrakan dengan data yang sudah ada; belum ada perubahan data.')
  }
  const source = await db.from('ahsp_sipasti_imports').upsert({ sha256, source_name: sourceName, source_rows: rows }, { onConflict: 'sha256', ignoreDuplicates: true })
  if (source.error) throw new Error('Snapshot sumber belum dapat disimpan; item pekerjaan belum diubah.')
  const additions = items.filter(item => !existing.has(item.id)).map(item => ({ ...item,
    regulation: LEGACY_REGULATION, regulation_status: LEGACY_NOTICE, analysis_status: 'unavailable',
    reconciliation_status: 'belum_ditemukan', sipasti_origin: true, sipasti_status: 'sipasti_only', sipasti_sha256: sha256 }))
  for (let start = 0; start < additions.length; start += 100) {
    const result = await db.from('ahsp_items').upsert(additions.slice(start, start + 100), { onConflict: 'id', ignoreDuplicates: true })
    if (result.error) throw new Error(`Impor berhenti pada batch ${start}; jalankan ulang untuk melanjutkan. Item lama tidak ditimpa.`)
  }
  for (let start = 0; start < items.length; start += 100) {
    const expected = items.slice(start, start + 100)
    const result = await db.from('ahsp_items').select('id,code,name,unit,field,regulation,ahsp_type').in('id', expected.map(item => item.id))
    if (result.error || result.data.length !== expected.length || expected.some(item => {
      const stored = result.data.find(row => row.id === item.id)
      return !stored || stored.regulation !== LEGACY_REGULATION || ['code', 'name', 'unit', 'field', 'ahsp_type'].some(key => stored[key] !== item[key])
    })) throw new Error('Jumlah atau identitas arsip sesudah impor belum terverifikasi; jalankan ulang pemeriksaan.')
  }
  return { added: additions.length, already_present: existing.size }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const [input, output, fieldsFile, ...extra] = args.filter(arg => arg !== '--apply')
  if (extra.length || fieldsFile?.startsWith('--')) throw new Error('Argumen impor tidak valid.')
  if (!input || !output) throw new Error('Gunakan: node --env-file=.env.local scripts/prepare-ahsp-legacy.mjs <ekspor.json> <impor.sql> [snapshot-bidang.json]')
  const bytes = readFileSync(input)
  const document = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
  const arrays = Object.values(document)
  if (arrays.length !== 1 || !Array.isArray(arrays[0])) throw new Error('Ekspor harus memuat satu array data.')
  const rows = arrays[0]
  let fields
  if (fieldsFile) fields = JSON.parse(readFileSync(fieldsFile, 'utf8')).fields
  else {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const result = await db.from('ahsp_master_fields').select('id,name')
    if (result.error) throw new Error('Daftar bidang belum dapat dibaca dari Supabase.')
    fields = result.data
  }
  const items = prepareLegacyItems(rows, fields)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const sourceName = input.split(/[\\/]/).at(-1)
  const folder = dirname(resolve(output))
  const sql = legacyImportSql({ sha256, sourceName, rows, items })
  const summary = { regulation: LEGACY_REGULATION, replacement: 'SE 47/2026', source_rows: rows.length,
    unique_items: items.length, duplicate_rows: rows.length - items.length, sha256,
    fields: Object.fromEntries([...new Set(items.map(item => item.field))].map(field => [field, items.filter(item => item.field === field).length])),
    sql_file: resolve(output), applied: false }
  if (apply) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    Object.assign(summary, await applyLegacyItems(db, { sha256, sourceName, rows, items }), { applied: true })
  }
  mkdirSync(folder, { recursive: true })
  writeFileSync(output, sql)
  writeFileSync(`${output}.json`, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
