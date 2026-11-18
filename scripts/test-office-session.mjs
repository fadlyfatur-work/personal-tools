import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
let session={context:{userId:'account-a'},workspaceId:'shared-office',loading:false}
const exports={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/office/workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{
 exports,require:name=>{
  if(name==='@/lib/tools/client')return {useTools:()=>session}
  if(name==='@/app/tools/components/tools-shell')return {ToolsShell:()=>null}
  if(name==='@/lib/office/domain')return {}
  if(name==='next/link')return 'a'
  if(name.endsWith('.css'))return {}
  return require(name)
 }
})
const first=exports.OfficeWorkspace({mode:'tasks'}).props.children.key
session={...session,context:{userId:'account-b'}}
const second=exports.OfficeWorkspace({mode:'tasks'}).props.children.key
assert.notEqual(first,second,'switching users in the same team workspace must unmount all previous private data and drafts')
session={...session,workspaceId:'another-workspace'}
assert.notEqual(second,exports.OfficeWorkspace({mode:'tasks'}).props.children.key,'workspace change also unmounts prior scope')
console.log('Office session: actual component identity isolation checks passed')
