import assert from 'node:assert/strict'
import React from 'react'
import {suiteIcons as icons} from './helpers/suite-icons.mjs'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'

let pathname='/office/followups'
const {SuiteFrame}=loadSuiteModule('app/tools/components/suite-frame.tsx',{
 'next/link':{default:({children,...props})=>React.createElement('a',props,children),__esModule:true},
 'next/navigation':{usePathname:()=>pathname},
 '@phosphor-icons/react':icons,
})
const render=props=>renderToStaticMarkup(React.createElement(SuiteFrame,{title:'Tindak lanjut',section:'office',...props},React.createElement('textarea',{defaultValue:'Draf belum tersimpan'})))
const html=render({})
assert.match(html,/<aside[^>]*id="suite-navigation"/,'One sidebar owns navigation')
assert.match(html,/<main[^>]*id="tools-content"/,'The active feature owns the adjacent main pane')
assert.equal((html.match(/<main\b/g)||[]).length,1,'There is one main landmark, not nested mains')
assert.ok(html.includes('Draf belum tersimpan'))
assert.ok(html.includes('Navigasi Office Tools'),'The grouped menu identity remains visible inside the suite')
for(const route of ['/office/tasks','/office/followups','/office/meetings','/office/knowledge','/documents','/deployments','/monitoring'])assert.ok(html.includes(`href="${route}"`),route)
assert.match(html,/<a[^>]*href="\/office\/followups"[^>]*aria-current="page"/)
assert.ok(!html.includes('href="/tools/users"'))
assert.ok(!html.includes('href="/documents/admin"'))
assert.ok(html.includes('aria-controls="suite-navigation"'))
assert.ok(html.includes('aria-expanded="false"'))
const admin=render({hasAccount:true,isSuiteAdmin:true,isTemplateAdmin:true})
for(const route of ['/tools/users','/documents/admin','/tools/workspaces'])assert.ok(admin.includes(`href="${route}"`))
pathname='/documents/surat_tugas'
assert.match(render({}),/<a[^>]*href="\/documents"[^>]*aria-current="page"/)
pathname='/documents/admin'
const templateAdmin=render({hasAccount:true,isTemplateAdmin:true})
assert.match(templateAdmin,/<a[^>]*href="\/documents\/admin"[^>]*aria-current="page"/)
assert.ok(!/<a[^>]*href="\/documents"[^>]*aria-current="page"/.test(templateAdmin))
assert.ok(!templateAdmin.includes('href="/tools/users"'),'Template administration must not imply suite administration')
console.log('PASS: shared sidebar/content composition, seven working feature routes, selected route, mobile disclosure markup, role-gated admin links and preserved child content.')

let open=false,focusCount=0
const ref={current:{focus(){focusCount++}}}
const{SuiteFrame:InteractiveFrame}=loadSuiteModule('app/tools/components/suite-frame.tsx',{
 react:{useState:initial=>[open||initial,value=>{open=typeof value==='function'?value(open):value}],useRef:()=>ref},
 'next/link':{default:'a',__esModule:true},'next/navigation':{usePathname:()=>'/office/tasks'},
 '@phosphor-icons/react':icons,'./suite-theme':{SuiteSurface:'div',ThemePicker:()=>null},
})
const flatten=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(flatten):[node,...flatten(node.props?.children)]
const tree=()=>flatten(InteractiveFrame({title:'Pekerjaan',children:React.createElement('textarea',{defaultValue:'Draf'})}))
const menu=()=>tree().find(node=>node.type==='button'&&node.props['aria-controls']==='suite-navigation')
menu().props.onClick();assert.equal(menu().props['aria-expanded'],true)
assert.equal(tree().find(node=>node.type==='aside').props['data-open'],true)
tree().find(node=>node.props?.onKeyDown).props.onKeyDown({key:'Escape'})
assert.equal(menu().props['aria-expanded'],false);assert.equal(focusCount,1)
menu().props.onClick()
tree().find(node=>node.props?.href==='/office/meetings').props.onClick()
assert.equal(menu().props['aria-expanded'],false)
assert.ok(tree().find(node=>node.type==='textarea'),'Menu disclosure must not unmount the active form')
console.log('PASS: menu open/close, Escape focus return, route-selection close and retained feature form without a browser.')
