import assert from 'node:assert/strict'
import React from 'react'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

const state=[];let cursor=0,effect,request,resetCount=0
class RequestError extends Error{constructor(status){super('Akses berakhir');this.status=status}}
const flatten=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(flatten):[node,...flatten(node.props?.children)]
const {default:Page}=loadSuiteModule('app/documents/page.tsx',{
 react:{...React,useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value}]},useEffect(fn){effect=fn}},
 'next/link':{default:'a',__esModule:true},
 '@phosphor-icons/react':{Files:'svg',CaretRight:'svg'},
 '@/app/tools/components/suite-frame':{SuiteFrame:'main'},
 './document-access':{DocumentAccess:'access'},
 '@/lib/tools/client':{toolsRequest:(...args)=>request(...args),ToolsRequestError:RequestError},
})
const collection=flatten(Page()).find(node=>node.type==='access').props.children({},()=>resetCount++)
const render=()=>{cursor=0;return flatten(collection.type(collection.props))}
const settle=async()=>{effect();await new Promise(setImmediate)}
request=async()=>[]
render();await settle()
assert.ok(render().find(node=>node.props?.children==='Koleksi belum memiliki template'))
assert.ok(!render().find(node=>node.props?.children==='Hapus filter'))
render().find(node=>node.props?.id==='template-search').props.onChange({target:{value:'Surat tugas'}})
render();await settle()
assert.ok(render().find(node=>node.props?.children==='Tidak ada template yang cocok'))
render().find(node=>node.props?.id==='template-kind').props.onChange({target:{value:'Kepegawaian'}})
let url
request=async path=>{url=path;return[{id:'doc-1',code:'surat_tugas',name:'Surat Tugas',kind:'Surat',organization:'Kemen PU'}]}
render();await settle()
assert.ok(render().find(node=>node.props?.href==='/documents/surat_tugas'))
render().find(node=>node.props?.children==='Hapus filter').props.onClick()
render();await settle()
assert.equal(render().find(node=>node.props?.id==='template-search').props.value,'')
assert.equal(render().find(node=>node.props?.id==='template-kind').props.value,'')
assert.equal(url,'/api/documents/templates?offset=0&q=&kind=')
request=async()=>{throw new RequestError(401)}
render();await settle()
assert.equal(resetCount,1)
assert.ok(!render().find(node=>node.props?.href==='/documents/surat_tugas'))
console.log('PASS: empty collection differs from filtered-empty; clear filters resets both fields and pagination; expired access clears catalog.')
