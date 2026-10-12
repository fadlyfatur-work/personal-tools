import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const input = process.argv[2]
if (!input) throw new Error('Usage: node --env-file=.env.local scripts/ahsp-import.mjs <inventory.json> [mirrors.json]')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Supabase URL and server service-role key are required.')
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const data = JSON.parse(await fs.readFile(input, 'utf8'))
const isActive = row => row.regulation === 'SE 47/2026' || (row.regulation === 'PERMEN 08/2023' && (row.field === 'Umum' || row.raw?.job_field_name === 'Umum'))
if (!Array.isArray(data.items) || !data.items.length || data.items.some(i => !isActive(i)) || data.master_rows.some(r => !isActive(r))) throw new Error('Inventory must contain only SE 47/2026 and active Umum items from Permen 8/2023.')

if (new Set(data.items.map(i => i.id)).size !== data.items.length) throw new Error('Duplicate item identifiers must be reconciled before import.')

const probe = await db.from('ahsp_items').select('id').limit(1)
if (probe.error) throw new Error('Apply 202610120001_ahsp_catalog.sql before importing data.')
const storedSources = await db.from('ahsp_sources').select('id,sha256,assets')
if (storedSources.error) throw new Error(storedSources.error.message)
for (const source of data.sources) {
  const previous = storedSources.data.find(s => s.id === source.id && s.sha256 === source.sha256)
  if (!source.assets.length && previous) source.assets = previous.assets
}
if (process.argv[3]) {
  const manifestPath = path.resolve(process.argv[3])
  const mirrors = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  const bucket = 'ahsp-regulations'
  const existing = await db.storage.getBucket(bucket)
  if (existing.error) {
    const created = await db.storage.createBucket(bucket, { public: true, allowedMimeTypes: ['application/pdf'], fileSizeLimit: '50MB' })
    if (created.error) throw new Error(`Could not create document bucket: ${created.error.message}`)
  } else if (!existing.data.public) throw new Error('Existing document bucket is private; import will not change its permissions.')
  for (const asset of mirrors) {
    const filePath = path.resolve(path.dirname(manifestPath), asset.file)
    if (!filePath.startsWith(path.dirname(manifestPath) + path.sep)) throw new Error('Mirror path is outside the manifest directory.')
    const source = data.sources.find(s => s.id === asset.source_id)
    if (!source || source.sha256 !== asset.source_sha256) throw new Error('Mirror source fingerprint does not match the inventory.')
    const object = `${source.id}/${source.sha256.slice(0, 16)}/${asset.page_start}-${asset.page_end}.pdf`
    const folder = object.slice(0, object.lastIndexOf('/'))
    const filename = object.slice(object.lastIndexOf('/') + 1)
    const listed = await db.storage.from(bucket).list(folder, { search: filename, limit: 10 })
    if (listed.error) throw new Error(`Document lookup failed: ${listed.error.message}`)
    if (!listed.data.some(file => file.name === filename)) {
      const bytes = await fs.readFile(filePath)
      if (bytes.length > 50 * 1024 * 1024) throw new Error('Split PDF mirrors below 50 MB.')
      const uploaded = await db.storage.from(bucket).upload(object, bytes, { contentType: 'application/pdf', cacheControl: '31536000', upsert: false })
      if (uploaded.error && String(uploaded.error.statusCode) !== '409') throw new Error(`Document upload failed: ${uploaded.error.message}`)
    }
    const publicUrl = db.storage.from(bucket).getPublicUrl(object).data.publicUrl
    if (!source.assets.some(a => a.url === publicUrl)) source.assets.push({ url: publicUrl, page_start: asset.page_start, page_end: asset.page_end })
    console.log(`Document ${source.id}: pages ${asset.page_start}-${asset.page_end}`)
  }
}
for (const [table, rows] of [['ahsp_sources', data.sources], ['ahsp_master_fields', data.fields], ['ahsp_items', data.items], ['ahsp_master_rows', data.master_rows]]) {
  for (let offset = 0; offset < rows.length; offset += 100) {
    const result = await db.from(table).upsert(rows.slice(offset, offset + 100))
    if (result.error) throw new Error(`${table}, batch ${offset}: ${result.error.message}`)
  }
  console.log(`${table}: ${rows.length} records imported`)
}
const verified = await db.rpc('ahsp_catalog_options')
if (verified.error || verified.data.total !== data.items.length) throw new Error('Catalog count does not match this snapshot. Existing obsolete rows require review; no records were deleted automatically.')
console.log(JSON.stringify({ total: verified.data.total, analysis: verified.data.analysis, reconciliation: verified.data.statuses }, null, 2))
