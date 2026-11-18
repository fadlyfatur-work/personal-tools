/* eslint-disable @typescript-eslint/no-require-imports -- Browser verification uses the bundled runtime without adding a production dependency. */
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
async function main(){
  const browser=await chromium.launch({headless:true,channel:'chrome'})
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  try{
    const check=vm.runInThisContext(`(${fs.readFileSync('.next/report-work/browser-check.js','utf8')})`)
    console.log(await check(page))
  }catch(error){await page.screenshot({path:'.next/report-work/browser-failure.png',fullPage:true});throw error}
  finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
