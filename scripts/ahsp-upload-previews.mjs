import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const manifestPath = path.resolve(process.argv[2] ?? '')
if (!process.argv[2]) throw new Error('Provide the page-preview manifest.')
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const bucket = 'ahsp-source-pages'
const existingBucket = await db.storage.getBucket(bucket)
if (existingBucket.error) {
  const created = await db.storage.createBucket(bucket, { public: true, allowedMimeTypes: ['image/jpeg'], fileSizeLimit: '5MB' })
  if (created.error) throw new Error(created.error.message)
} else if (!existingBucket.data.public) throw new Error('Existing preview bucket is private; its permissions were not changed.')
const sources = await db.from('ahsp_sources').select('*')
if (sources.error) throw new Error(sources.error.message)
let uploaded = 0
for (const source of sources.data) {
  const pages = manifest.filter(p => p.source_id === source.id)
  if (!pages.length) continue
  if (pages.some(p => p.source_sha256 !== source.sha256 || p.page < 1 || p.page > source.page_count)) throw new Error('Preview fingerprint or page bounds do not match the source.')
  const folder = `${source.id}/${source.sha256.slice(0, 16)}`
  const existing = new Set()
  for (let offset = 0;; offset += 1000) {
    const listed = await db.storage.from(bucket).list(folder, { limit: 1000, offset })
    if (listed.error) throw new Error(listed.error.message)
    for (const file of listed.data) existing.add(file.name)
    if (listed.data.length < 1000) break
  }
  const queue = pages.filter(p => !existing.has(`${p.page}.jpg`))
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (cursor < queue.length) {
      const page = queue[cursor++]
      const file = path.resolve(path.dirname(manifestPath), page.file)
      if (!file.startsWith(path.dirname(manifestPath) + path.sep)) throw new Error('Preview path is outside the manifest folder.')
      const bytes = await fs.readFile(file)
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length > 5 * 1024 * 1024) throw new Error('Expected a JPEG page below 5 MB.')
      let failure
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await db.storage.from(bucket).upload(`${folder}/${page.page}.jpg`, bytes, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
        failure = result.error
        if (!failure || String(failure.statusCode) === '409') break
      }
      if (failure && String(failure.statusCode) !== '409') throw new Error(failure.message)
      uploaded++
      if (uploaded % 100 === 0) console.log(`Uploaded ${uploaded} source pages`)
    }
  }))
  const prefix = db.storage.from(bucket).getPublicUrl(`${folder}/`).data.publicUrl
  const assets = source.assets.map((asset, index) => index === 0 ? { ...asset, preview_base_url: prefix } : asset)
  const updated = await db.from('ahsp_sources').update({ assets }).eq('id', source.id)
  if (updated.error) throw new Error(updated.error.message)
  console.log(`Source ${source.id}: ${pages.length} page previews available`)
}
