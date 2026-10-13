import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { ahspAnalysisFingerprint } from '../lib/ahsp.ts'

const [auditFile, snapshotFile, outputFile] = process.argv.slice(2)
if (!auditFile || !snapshotFile || !outputFile) throw new Error('Berikan audit JSON, snapshot JSON, dan laporan output')
const audit = JSON.parse(readFileSync(auditFile, 'utf8'))
const snapshot = new Map(JSON.parse(readFileSync(snapshotFile, 'utf8')).map(item => [item.id, item]))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ids = [...new Set(audit.relations.flatMap(ref => [ref.item_id, ref.target_item_id].filter(Boolean)))]
const current = new Map()
for (let index = 0; index < ids.length; index += 100) {
  const result = await db.from('ahsp_items').select('*').in('id', ids.slice(index, index + 100))
  if (result.error) throw result.error
  for (const item of result.data) {
    assert.equal(ahspAnalysisFingerprint(item), ahspAnalysisFingerprint(snapshot.get(item.id)), `Analisis ${item.code} berubah; ulangi audit`)
    current.set(item.id, item)
  }
}
const references = audit.relations.map(ref => ({ ...ref,
  source_fingerprint: ahspAnalysisFingerprint(current.get(ref.item_id)),
  target_fingerprint: ref.target_item_id ? ahspAnalysisFingerprint(current.get(ref.target_item_id)) : null,
}))
const applied = await db.rpc('ahsp_set_analysis_references', { p_references: references })
if (applied.error) throw applied.error
assert.equal(applied.data, references.length)
writeFileSync(outputFile, JSON.stringify({ ...audit, relations: references, applied: true }, null, 2))
console.log(JSON.stringify({ applied: applied.data, counts: audit.counts }))
