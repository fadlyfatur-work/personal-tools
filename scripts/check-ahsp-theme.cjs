/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS browser verification. */
const assert = require('node:assert/strict')
const { setMode, setPalette } = require('./ahsp-appearance-browser.cjs')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const runtime = createRequire(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json'))
const { chromium } = runtime('playwright')
const root = '.next/ahsp-theme'
fs.mkdirSync(root, {recursive:true})
const item = {id:'00000000-0000-4000-8000-000000000001',code:'2.1.(1)',name:'Galian untuk selokan drainase',field:'Bina Marga',division:'Divisi 2: Drainase',unit:'m3',regulation:'SE 47/2026',regulation_status:'',ahsp_type:'Informatif',analysis_status:'extracted',source_id:null,page_from:null,page_to:null,printed_page:'',source_text:'',output_quantity:1,overhead_min:0,overhead_max:0,sipasti_status:'both',components:[{id:'1',group:'tenaga',name:'Pekerja',code:'L01',unit:'OH',coefficient:.5,expression:'',sourceLine:'A. TENAGA KERJA'}]}
const options = {total:1,version_total:1,sources:[],fields:['Bina Marga'],field_counts:[{field:'Bina Marga',count:1}],divisions:[{field:'Bina Marga',division:item.division}],units:['m3'],statuses:[],analysis:[{status:'extracted',count:1}],types:[]}
const component={key:'worker',group:'tenaga',name:'Pekerja',unit:'OH',codes:['L01'],job_count:1,occurrence_count:1,review_count:0,fields:['Bina Marga'],regulations:['SE 47/2026'],coefficient_summary:{variant_count:1,numeric_count:1,formula_count:0,missing_count:0,samples:[{coefficient:.5,expression:'',output_quantity:1,item_unit:'m3',item_id:item.id,item_code:item.code,item_name:item.name,regulation:item.regulation}]}}
const mptk = {total:1,page_size:20,items:[component],component,usage_total:1,usages:[{...item.components[0],component_key:'worker',component_group:'tenaga',item_id:item.id,item_code:item.code,item_name:item.name,item_unit:'m3',output_quantity:1,field:item.field,division:item.division,regulation:item.regulation,analysis_status:'extracted',source_id:null,page_from:null,page_to:null,source_url:null,source_title:null,annex:null,position:1,original_group:'tenaga',original_name:'Pekerja',category_corrected:false}],groups:[{group:'tenaga',count:1},{group:'bahan',count:0},{group:'alat',count:0}],fields:['Bina Marga'],units:['OH'],coverage:{jobs:1,with_components:1},validation:{validated:true,excluded:0,corrected:0}}
const luminance = values => values.map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((total,value,index)=>total+value*[.2126,.7152,.0722][index],0)
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05)
async function main(){
 const browser=await chromium.launch({headless:true,channel:'chrome'})
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 const page=await context.newPage()
 const errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/api/ahsp?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(new URL(route.request().url()).searchParams.has('id')?{item}:{items:[item],total:1,options})}))
 await page.route('**/api/ahsp/mptk?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(mptk)}))
 try{
  for(const route of ['/ahsp','/ahsp/mptk','/ahsp/rab']){
   await page.goto('http://localhost:3000'+route)
   await page.getByRole('button',{name:/^Pilih tema:/}).waitFor()
   if(route==='/ahsp')assert.equal(await page.locator('main').getAttribute('data-palette'),'swiss-red','Swiss Red is the default')
   if(route==='/ahsp')await page.locator('main>div[inert]').waitFor({state:'hidden'})
   if(route==='/ahsp/mptk')await page.getByText('Koefisien menurut pekerjaan',{exact:true}).waitFor()
   const name=route==='/ahsp'?'catalog':route.split('/').at(-1)
   for(const paletteName of ['swiss-red','pastel-dreams','indigo-frost'])for(const width of [1440,768,390,320])for(const theme of ['light','dark','system']){
    await page.setViewportSize({width,height:1000})
    await page.emulateMedia({colorScheme:theme==='system'?'dark':'light'})
    await setPalette(page,paletteName)
    await setMode(page,theme)
    assert.equal(await page.getByRole('combobox',{name:'Tampilan',exact:true}).count(),0,'Mode uses an icon button')
    const trigger=page.getByRole('button',{name:/^Pilih tema:/})
    await trigger.click()
    const menu=page.getByRole('dialog',{name:'Pilihan tema',exact:true})
    const menuRect=await menu.boundingBox()
    assert.ok(menuRect.x>=0&&menuRect.x+menuRect.width<=width+1&&menuRect.y>=0&&menuRect.y+menuRect.height<=1001,'Theme menu stays in viewport')
    if(width===390&&theme==='light')await page.screenshot({path:`${root}/${name}-${paletteName}-menu-mobile.png`,fullPage:true,animations:'disabled'})
    await page.keyboard.press('Escape')
    assert.equal(await menu.isVisible(),false)
    assert.equal(await trigger.evaluate(element=>element===document.activeElement),true,'Escape returns focus to theme button')
    const palette=await page.locator('main').evaluate(element=>{
     const s=getComputedStyle(element),ctx=document.createElement('canvas').getContext('2d')
     const color=value=>{ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)}
     return {background:color(s.backgroundColor),color:color(s.color),action:color(s.getPropertyValue('--action')),actionInk:color(s.getPropertyValue('--actionInk')),accent:color(s.getPropertyValue('--accent')),muted:color(s.getPropertyValue('--muted')),surface:color(s.getPropertyValue('--surface')),radius:s.getPropertyValue('--controlRadius').trim()}
    })
    const expectedAction=paletteName==='swiss-red'?'#db0000':paletteName==='pastel-dreams'?theme==='light'?'#a78bfa':'#c0aafd':theme==='light'?'#03035e':'#0f2ea9'
    assert.deepEqual(palette.action,expectedAction.match(/[0-9a-f]{2}/g).map(value=>parseInt(value,16)))
    assert.ok(contrast(palette.color,palette.background)>=4.5,`${paletteName} body contrast`)
    assert.ok(contrast(palette.actionInk,palette.action)>=4.5,`${paletteName} action contrast`)
    assert.ok(contrast(palette.accent,palette.surface)>=4.5,`${paletteName} link contrast`)
    assert.ok(contrast(palette.muted,palette.surface)>=4.5,`${paletteName} muted contrast`)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${route} ${width} ${theme} has no page overflow`)
    const controls=page.getByRole('button').filter({visible:true})
    if(await controls.count())assert.equal(await controls.first().evaluate(element=>getComputedStyle(element).borderRadius),palette.radius)
    if([1440,390].includes(width)&&theme!=='system')await page.screenshot({path:`${root}/${name}-${paletteName}-${width}-${theme}.png`,fullPage:true,animations:'disabled'})
   }
   await page.setViewportSize({width:1440,height:1000})
   await setMode(page,'light')
   if(route==='/ahsp'){
    await page.getByRole('button',{name:`Buka analisis ${item.code}: ${item.name}`,exact:true}).click()
    const dialog=page.getByRole('dialog')
    await dialog.getByLabel('Harga dasar Pekerja',{exact:true}).fill('100000')
    await dialog.getByLabel('Volume pekerjaan (m3)',{exact:true}).fill('2')
    await dialog.getByLabel('Biaya umum dan keuntungan (%)',{exact:true}).fill('0')
    assert.ok((await dialog.getByRole('region',{name:'Hasil kalkulator',exact:true}).innerText()).includes('100.000'))
   }else if(route==='/ahsp/mptk'){
    await page.getByRole('button',{name:/Pekerja.*Lihat penggunaan/}).click()
    await page.getByRole('dialog').getByText(item.name,{exact:false}).waitFor()
   }
   if(route!=='/ahsp/rab'){
    const dialog=page.getByRole('dialog')
    for(const paletteName of ['swiss-red','pastel-dreams','indigo-frost'])for(const width of [1440,390,320])for(const theme of ['light','dark']){
     await page.setViewportSize({width,height:1000})
     await page.locator('main').evaluate((element,value)=>element.setAttribute('data-theme',value),theme)
     await page.locator('main').evaluate((element,value)=>element.setAttribute('data-palette',value),paletteName)
     const rect=await dialog.boundingBox()
     assert.ok(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=1001)
     if(width!==320)await dialog.screenshot({path:`${root}/${name}-modal-${paletteName}-${width}-${theme}.png`,animations:'disabled'})
    }
    await page.keyboard.press('Escape')
    assert.equal(await dialog.isVisible(),false)
   }
  }
  await setPalette(page,'pastel-dreams')
  await setMode(page,'dark')
  await page.reload()
  await page.waitForFunction(()=>document.querySelector('main').dataset.palette==='pastel-dreams')
  assert.equal(await page.locator('main').getAttribute('data-palette'),'pastel-dreams','Selection survives reload')
  const other=await page.context().newPage()
  await other.goto('http://localhost:3000/ahsp/mptk')
  await other.waitForFunction(()=>document.querySelector('main').dataset.palette==='pastel-dreams')
  assert.equal(await other.locator('main').getAttribute('data-palette'),'pastel-dreams','Selection shared across routes/tabs')
  assert.equal(await other.locator('main').getAttribute('data-theme'),'dark')
  await setPalette(other,'indigo-frost')
  await page.waitForFunction(()=>document.querySelector('main').dataset.palette==='indigo-frost')
  await other.close()
  await page.evaluate(()=>localStorage.setItem('ahsp-appearance','invalid json'))
  await page.reload()
  assert.equal(await page.locator('main').getAttribute('data-palette'),'swiss-red','Malformed storage falls back safely')
  const blocked=await browser.newContext()
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}))
  const privatePage=await blocked.newPage()
  await privatePage.goto('http://localhost:3000/ahsp/rab')
  await setPalette(privatePage,'indigo-frost')
  await setMode(privatePage,'light')
  assert.equal(await privatePage.locator('main').getAttribute('data-palette'),'indigo-frost','Selection works without browser storage')
  await blocked.close()
  assert.deepEqual(errors,[])
  console.log('PASS: three AHSP themes, Swiss Red default, light/dark/system, 320–1440px, contrast, modals, coefficients/calculator, cross-route/tab persistence, malformed/blocked storage.')
 }catch(error){await page.screenshot({path:root+'/failure.png',fullPage:true});throw error}
 finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
