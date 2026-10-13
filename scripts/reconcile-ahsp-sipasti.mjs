import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

export const normalizeCode = value => (value ?? '').normalize('NFKC').replace(/\s+/gu, '').toLowerCase()
const normalizeName = value => (value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase()
const key = item => JSON.stringify([normalizeCode(item.code) || `name:${normalizeName(item.name)}:${normalizeName(item.unit)}`, item.field, item.regulation])
const group = (rows, getKey) => {
  const result = new Map()
  for (const row of rows) {
    const identity = getKey(row)
    if (!result.has(identity)) result.set(identity, [])
    result.get(identity).push(row)
  }
  return result
}
const uuid = identity => {
  const chars = createHash('sha256').update(`ahsp-sipasti:${identity}`).digest('hex').slice(0, 32).split('')
  chars[12] = '8'; chars[16] = (8 | (parseInt(chars[16], 16) & 3)).toString(16)
  const hex = chars.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function reconcile(items, fields, rawRows, { includePermenSmkk = false } = {}) {
  const fieldNames = new Map(fields.map(field => [field.id, field.name]))
  const excluded = []
  const rows = rawRows.flatMap((raw, index) => {
    const regulations = String(raw.regulasi_se).split(',').map(value => value.trim())
    const regulation = regulations.includes('SE 47/2026') ? 'SE 47/2026'
      : regulations.some(value => /^PERMEN\s+0?8\/2023$/i.test(value)) ? 'PERMEN 08/2023' : null
    if (!regulation) throw new Error(`Baris ${index + 1}: regulasi di luar cakupan SE 47/2026 dan Permen 8/2023`)
    if (!fieldNames.has(raw.job_field_id)) throw new Error(`Baris SIPASTI ${index + 1}: identitas tidak valid`)
    const field = fieldNames.get(raw.job_field_id)
    if (field === 'SMKK' && regulation === 'PERMEN 08/2023' && !includePermenSmkk) {
      excluded.push({ row: index + 1, code: raw.code, name: raw.name, field, regulation, reason: 'SMKK versi lama; katalog menggunakan SMKK SE 47/2026' })
      return []
    }
    if ((raw.code !== null && typeof raw.code !== 'string') || typeof raw.name !== 'string' || !raw.name.trim() || (raw.unit !== null && typeof raw.unit !== 'string')) throw new Error(`Baris SIPASTI ${index + 1}: identitas tidak valid`)
    const corrected = regulation === 'SE 47/2026' && raw.job_field_id === 'c7c994df-efb0-48d6-9cb4-5e5e2fad69ps'
      && raw.code === '2.3.(25a)1' && raw.name === '1Saluran U Pracetak Tipe DS 5'
    return [{ ...raw, code: raw.code ?? '', ...(corrected ? { code: '2.3.(25a)', name: 'Saluran U Pracetak Tipe DS 5' } : {}),
      field, regulation, row: index + 1, corrected }]
  })
  const sipasti = group(rows, key)
  const database = group(items, key)
  const changes = [], differences = [], collisions = []
  for (const item of items) {
    const identity = key(item)
    const candidates = sipasti.get(identity) ?? []
    const variants = new Set(database.get(identity).map(row => normalizeName(row.name)))
    const matches = variants.size > 1 ? candidates.filter(row => normalizeName(row.name) === normalizeName(item.name)) : candidates
    const status = matches.length ? (item.sipasti_origin ? 'sipasti_only' : 'both') : 'database_only'
    changes.push({ id: item.id, code: item.code, name: item.name, field: item.field, regulation: item.regulation, status, rows: matches.map(row => row.row) })
    if (variants.size > 1) collisions.push({ id: item.id, code: item.code, field: item.field, name: item.name, status, reason: 'Kode memiliki beberapa nama; nama dibandingkan tanpa perubahan selain spasi dan kapitalisasi.' })
    if (matches.length && matches.some(row => normalizeName(row.name) !== normalizeName(item.name) || normalizeName(row.unit) !== normalizeName(item.unit))) differences.push({ id: item.id, code: item.code, field: item.field, db_name: item.name, sipasti_name: matches[0].name, db_unit: item.unit, sipasti_unit: matches[0].unit })
  }
  const representedRows = new Set(changes.flatMap(change => change.rows))
  for (const [identity, candidates] of sipasti) {
    const unmatched = candidates.filter(row => !representedRows.has(row.row))
    if (!unmatched.length) continue
    const distinct = group(unmatched, row => JSON.stringify([normalizeName(row.name), normalizeName(row.unit)]))
    for (const [variant, list] of distinct) {
      const row = list[0]
      const item = { id: uuid(identity + variant), code: row.code, name: row.name, field: row.field, regulation: row.regulation, unit: row.unit ?? '',
        division: '', ahsp_type: ({ normative: 'Normatif', informative: 'Informatif' })[row.job_type] ?? '', regulation_status: '',
        analysis_status: 'unavailable', components: [], source_id: null, page_from: null, page_to: null,
        reconciliation_status: 'belum_ditemukan', reconciliation_notes: [], master_rows: [], sipasti_origin: true }
      changes.push({ id: item.id, code: item.code, name: item.name, field: item.field, regulation: item.regulation, status: 'sipasti_only', rows: list.map(value => value.row), item })
    }
  }
  return { changes, differences, collisions, excluded, summary: {
    database_before: items.length, sipasti_rows: rawRows.length, included_rows: rows.length, excluded_rows: excluded.length, sipasti_unique_codes: sipasti.size,
    duplicate_sipasti_rows: rows.length - sipasti.size, database_after: changes.length,
    identity_corrections: rows.filter(row => row.corrected).length,
    both: changes.filter(row => row.status === 'both').length,
    database_only: changes.filter(row => row.status === 'database_only').length,
    sipasti_only: changes.filter(row => row.status === 'sipasti_only').length,
    added: changes.filter(row => row.item).length, metadata_differences: differences.length,
  } }
}

const csv = rows => {
  if (!rows.length) return ''
  const columns = Object.keys(rows[0])
  const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`
  return '\ufeff' + [columns.map(escape).join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\r\n')
}

async function main() {
  const [input, output, ...flags] = process.argv.slice(2)
  if (!input || !output || flags.some(flag => !['--apply', '--include-permen-smkk'].includes(flag))) throw new Error('Gunakan: node --env-file=.env.local scripts/reconcile-ahsp-sipasti.mjs <json> <output-directory> [--apply] [--include-permen-smkk]')
  const apply = flags.includes('--apply')
  const bytes = readFileSync(input)
  const document = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
  const values = Object.values(document)
  if (values.length !== 1 || !Array.isArray(values[0]) || !values[0].length) throw new Error('Export SIPASTI harus berisi satu array data')
  const rawRows = values[0]
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const fields = await db.from('ahsp_master_fields').select('*')
  if (fields.error) throw fields.error
  const items = []
  let includeOrigin = true
  for (let start = 0;; start += 1000) {
    const columns = 'id,code,name,field,regulation,unit,division,ahsp_type' + (includeOrigin ? ',sipasti_origin' : '')
    const result = await db.from('ahsp_items').select(columns).in('regulation', ['SE 47/2026', 'PERMEN 08/2023']).order('id').range(start, start + 999)
    if (result.error?.code === '42703' && start === 0 && includeOrigin) { includeOrigin = false; start = -1000; continue }
    if (result.error) throw result.error
    items.push(...result.data)
    if (result.data.length < 1000) break
  }
  const result = reconcile(items, fields.data, rawRows, { includePermenSmkk: flags.includes('--include-permen-smkk') })
  const folder = resolve(output)
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'ahsp-sipasti-ringkasan.json'), JSON.stringify({ sha256, source_file: resolve(input), ...result.summary, applied: false }, null, 2))
  writeFileSync(join(folder, 'ahsp-sipasti-rekonsiliasi.csv'), csv(result.changes.map(row => ({ id: row.id, code: row.code, name: row.name, field: row.field, regulation: row.regulation, tag: { both: 'Verfied', database_only: 'Hanya ada di Database', sipasti_only: 'Hanya ada di SIPASTI' }[row.status], json_rows: row.rows.join(';') }))))
  writeFileSync(join(folder, 'ahsp-sipasti-perbedaan-metadata.csv'), csv(result.differences))
  writeFileSync(join(folder, 'ahsp-sipasti-kode-ganda.csv'), csv(result.collisions))
  writeFileSync(join(folder, 'ahsp-sipasti-dikecualikan.csv'), csv(result.excluded))
  if (apply) {
    if (!includeOrigin) throw new Error('Jalankan 08_ahsp_sipasti_reconciliation.sql terlebih dahulu. Laporan sudah dibuat; database belum diubah.')
    const applied = await db.rpc('ahsp_reconcile_sipasti', { p_sha256: sha256, p_source_name: input.split(/[\\/]/).at(-1), p_source_rows: rawRows, p_changes: result.changes })
    if (applied.error) throw applied.error
    for (const [status, expected] of [['both', result.summary.both], ['database_only', result.summary.database_only], ['sipasti_only', result.summary.sipasti_only]]) {
      const check = await db.from('ahsp_items').select('id', { head: true, count: 'exact' }).in('regulation', ['SE 47/2026', 'PERMEN 08/2023']).eq('sipasti_status', status)
      if (check.error) throw check.error
      if (check.count !== expected) throw new Error(`Jumlah ${status} sesudah impor tidak sesuai: ${check.count}/${expected}`)
    }
    writeFileSync(join(folder, 'ahsp-sipasti-ringkasan.json'), JSON.stringify({ sha256, source_file: resolve(input), ...result.summary, applied: true }, null, 2))
  }
  console.log(JSON.stringify({ ...result.summary, applied: apply }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
