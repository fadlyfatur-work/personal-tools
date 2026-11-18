import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as runtime from 'react/jsx-runtime'
const values=new Map(),events=new EventTarget()
let blocked=false
const window={localStorage:{getItem:key=>{if(blocked)throw Error('blocked');return values.get(key)||null},setItem:(key,value)=>{if(blocked)throw Error('blocked');values.set(key,value)}},addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events)}
const context={exports:{},window,Event,require(name){if(name==='react')return{useSyncExternalStore:(_subscribe,snapshot)=>snapshot()};if(name==='react/jsx-runtime')return runtime;if(name.endsWith('.css'))return{default:{scope:'scope',themePicker:'themePicker'}};throw Error(name)}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/tools/components/suite-theme.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,context)
const{SuiteSurface,ThemePicker}=context.exports
assert.equal(SuiteSurface({children:'Konten'}).props['data-theme'],'system')
const select=()=>ThemePicker().props.children.find(child=>child.type==='select')
select().props.onChange({target:{value:'dark'}})
assert.equal(SuiteSurface({children:'Konten'}).props['data-theme'],'dark')
assert.equal(values.get('tools:theme'),'dark')
select().props.onChange({target:{value:'light'}})
assert.equal(select().props.value,'light')
blocked=true;select().props.onChange({target:{value:'dark'}})
assert.equal(SuiteSurface({children:'Konten'}).props['data-theme'],'dark','Theme must remain usable when storage is blocked')
console.log('PASS: light/dark/system preference, saved selection, and storage-denied fallback without a browser.')
