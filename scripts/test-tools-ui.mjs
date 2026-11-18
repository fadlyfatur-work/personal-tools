import assert from 'node:assert/strict'
import React from 'react'
import {suiteIcons as icons} from './helpers/suite-icons.mjs'
import {renderToStaticMarkup} from 'react-dom/server'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'
const {ToolsShell}=loadSuiteModule('app/tools/components/tools-shell.tsx',{
  '@phosphor-icons/react':icons,
  'next/link':{default:({children,...props})=>React.createElement('a',props,children),__esModule:true},
  'next/navigation':{usePathname:()=>'/tools/invitation',useRouter:()=>({replace(){},refresh(){}})},
  '@/lib/tools/client':{toolsRequest:async()=>({})},'../tools.module.css':{},
})
const context={name:'Penguji',userId:'test',workspaceId:'test',role:'owner',workspaces:[{id:'test',name:'Uji',role:'owner'}]}
const html=renderToStaticMarkup(React.createElement(ToolsShell,{title:'Knowledge',tools:{loading:true,context,workspaceId:'test',setWorkspaceId(){},reload(){}}},React.createElement('textarea',{defaultValue:'Draft belum tersimpan'})))
assert.ok(html.includes('Draft belum tersimpan'),'Background session verification must keep the editor mounted')
assert.ok(html.includes('Tema tampilan'),'The shared shell includes an accessible theme selector')
assert.ok(!html.includes('href="/tools/users"'),'Ordinary users do not receive admin navigation')
const adminHtml=renderToStaticMarkup(React.createElement(ToolsShell,{title:'Admin',tools:{loading:false,context:{...context,isSuiteAdmin:true},workspaceId:'test',setWorkspaceId(){},reload(){}}},null))
assert.ok(adminHtml.includes('href="/tools/users"'),'Suite administrators can reach user management')
const invitation=renderToStaticMarkup(React.createElement(ToolsShell,{title:'Undangan',tools:{loading:false,context:null,workspaceId:'',setWorkspaceId(){},reload(){}}},null))
assert.ok(invitation.includes('/tools/login?next='),'Signed out invitation has login destination')
const {AuthForm}=loadSuiteModule('app/tools/components/auth-form.tsx',{
  'next/link':{default:({children,...props})=>React.createElement('a',props,children),__esModule:true},
  '@/lib/tools/client':{toolsRequest:async()=>({})},
  './tools-shell':{ToolsShell:({children})=>React.createElement('main',null,children)},'../tools.module.css':{},
})
const auth=renderToStaticMarkup(React.createElement(AuthForm,{mode:'login',next:'/tools/invitation?token=test-invitation'}))
assert.ok(auth.includes('next=%2Ftools%2Finvitation%3Ftoken%3Dtest-invitation'),'Switching from login to registration preserves the invitation destination')
console.log('PASS: background session verification preserves the mounted editor and unsaved draft.')
