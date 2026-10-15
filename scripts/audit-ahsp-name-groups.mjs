import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const folder = resolve(process.argv[2] ?? 'anti-slop/ahsp-name-groups')
const items = []
for (let start = 0;; start += 1000) {
  const result = await db.from('ahsp_items').select('id,code,name,unit,field,division,regulation,ahsp_type,analysis_status,source_id,page_from,page_to,components,reconciliation_status,sipasti_status').in('regulation', ['SE 47/2026','PERMEN 08/2023','SE 182/2025']).order('id').range(start, start + 999)
  if (result.error) throw new Error('Snapshot katalog belum dapat dibaca.')
  items.push(...result.data)
  if (result.data.length < 1000) break
}
const sources = await db.from('ahsp_sources').select('*')
if (sources.error) throw new Error('Daftar sumber belum dapat dibaca.')
const key = name => name.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase()
const groups = new Map()
for (const item of items) {
  const name = key(item.name)
  if (!groups.has(name)) groups.set(name, [])
  groups.get(name).push(item)
}
const summary = { versions: items.length, unique_names: groups.size,
  active_unique_names: new Set(items.filter(item=>item.regulation!=='SE 182/2025').map(item=>key(item.name))).size,
  duplicate_name_groups: [...groups.values()].filter(group=>group.length>1).length,
  screenshot_pair: (groups.get(key('Papan Informasi Keselamatan Konstruksi')) ?? []).map(({id,code,unit,regulation,ahsp_type,analysis_status})=>({id,code,unit,regulation,ahsp_type,analysis_status})) }
mkdirSync(folder, { recursive: true })
writeFileSync(`${folder}/snapshot.json`, JSON.stringify({ items, sources: sources.data }))
writeFileSync(`${folder}/summary.json`, JSON.stringify(summary,null,2))
console.log(JSON.stringify(summary,null,2))
