import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const items = []
for (let offset = 0;; offset += 300) {
  const { data, error } = await db.from('ahsp_items').select('*').order('id').range(offset, offset + 299)
  if (error) throw new Error(`Snapshot gagal: ${error.code || ''} ${error.message}`)
  items.push(...data)
  console.log(`Snapshot: ${items.length} pekerjaan`)
  if (data.length < 300) break
}
const { data: sources, error } = await db.from('ahsp_sources').select('*')
if (error) throw new Error(`Sumber gagal: ${error.code || ''} ${error.message}`)
mkdirSync('anti-slop/ahsp-master-2026-10-27', { recursive: true })
const file = `anti-slop/ahsp-master-2026-10-27/catalog-${new Date().toISOString().replaceAll(':', '-')}.json`
writeFileSync(file, JSON.stringify({ captured_at: new Date().toISOString(), items, sources }))
console.log(JSON.stringify({ file, items: items.length, components: items.reduce((n, i) => n + i.components.length, 0), sources: sources.length }))
