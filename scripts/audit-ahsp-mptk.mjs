import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const items = []
for (let offset = 0;; offset += 1000) {
  const { data, error } = await db.from('ahsp_items').select('id,code,name,unit,field,division,regulation,ahsp_type,analysis_status,source_id,page_from,page_to,components,reconciliation_status,sipasti_status,output_quantity')
    .in('regulation', ['SE 47/2026','PERMEN 08/2023','SE 182/2025']).order('id').range(offset, offset + 999)
  if (error) throw new Error('Audit MPTK tidak dapat membaca katalog.')
  items.push(...data)
  if (data.length < 1000) break
}
const sources = await db.from('ahsp_sources').select('*')
if (sources.error) throw new Error('Audit MPTK tidak dapat membaca sumber.')
const folder = 'anti-slop/ahsp-mptk/validation-2026-10-15'
mkdirSync(folder, { recursive: true })
writeFileSync(`${folder}/snapshot.json`, JSON.stringify({ items, sources: sources.data }))
console.log(JSON.stringify({ read_only: true, jobs: items.length, snapshot: `${folder}/snapshot.json` }))
