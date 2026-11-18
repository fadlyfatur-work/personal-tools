import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const results=[]
for(const status of ['verified','needs_review']){
  const start=Date.now()
  const r=await db.rpc('ahsp_search_items',{p_sipasti:status,p_page:1})
  assert.ifError(r.error)
  assert.ok(r.data.items.length>0,`Filter ${status} tidak mengembalikan hasil`)
  const ids=r.data.items.map(i=>i.id)
  const metadata=await db.from('ahsp_items').select('id,verification_status').in('id',ids)
  assert.ifError(metadata.error)
  assert.equal(metadata.data.length,ids.length)
  assert.ok(metadata.data.every(i=>i.verification_status===status))
  results.push({status,grouped_active_results:r.data.total,page_rows:ids.length,milliseconds:Date.now()-start})
  console.log(JSON.stringify(results.at(-1)))
}
const labor=await db.rpc('ahsp_validate_mptk_component',{c:{group:'tenaga',name:'Pekerja',unit:'jam',coefficient:.5},p_origin:'sipasti'})
assert.ifError(labor.error)
assert.deepEqual(labor.data.validation_issues,[])
assert.equal(labor.data.unit,'jam')
const mptk=await db.rpc('ahsp_search_mptk',{p_q:'Pekerja',p_group:'tenaga',p_field:'Bina Marga'})
assert.ifError(mptk.error)
assert.ok(mptk.data.total>0)
const report={checked_at:new Date().toISOString(),searches:results,mptk_labor_hour_preserved:true,bina_marga_labor_components:mptk.data.total}
writeFileSync('anti-slop/ahsp-master-2026-10-27/reconciliation/live-checks.json',JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
