import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'node:fs'
import { textKey } from './reconcile-ahsp-master.mjs'

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const result=await db.from('ahsp_items').select('id,name,field,unit,regulation,components,analysis_status,verification_status,source_id,analysis_target_id').eq('regulation','SPTJM')
assert.ifError(result.error)
assert.equal(result.data.length,233)
assert.ok(result.data.every(i=>i.verification_status==='needs_review'&&i.analysis_status==='unavailable'&&i.components.length===0&&i.source_id===null&&i.analysis_target_id===null))
assert.equal(result.data.filter(i=>i.unit==='').length,12)
const visible=await db.from('ahsp_catalog_versions').select('id',{count:'exact',head:true}).eq('regulation','SPTJM')
assert.ifError(visible.error)
assert.equal(visible.count,233)
const search=await db.rpc('ahsp_search_items',{p_regulation:'SPTJM',p_sipasti:'needs_review',p_page:1})
assert.ifError(search.error)
assert.equal(search.data.total,new Set(result.data.map(i=>textKey(i.name))).size)
assert.ok(search.data.items.length>0&&search.data.items.every(i=>i.regulation==='SPTJM'))
const verified=await db.rpc('ahsp_search_items',{p_regulation:'SPTJM',p_sipasti:'verified',p_page:1})
assert.ifError(verified.error)
assert.equal(verified.data.total,0)
const report={checked_at:new Date().toISOString(),sptjm_versions:result.data.length,sptjm_fields:result.data.reduce((o,i)=>(o[i.field]=(o[i.field]??0)+1,o),{}),search_unique_names:search.data.total,empty_analysis:true,needs_review_only:true,blank_unit_preserved:12,catalog_visible:true,verified_filter_results:0}
writeFileSync('anti-slop/ahsp-master-2026-11-19/import/live-checks.json',JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
