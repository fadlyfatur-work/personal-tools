import fs from 'node:fs'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'
const m={...loadSuiteModule('lib/report/model.ts'),...loadSuiteModule('lib/report/seed.ts')},excel=loadSuiteModule('lib/report/excel.ts')
const seed=m.createSeed()
const snapshot={date:'2026-11-10',revision:1,document:seed,created_at:'2026-11-10T03:00:00Z',updated_at:'2026-11-10T03:00:00Z'}
fs.mkdirSync('.next/report-work',{recursive:true})
fs.writeFileSync('.next/report-work/browser-template.xlsx',excel.createReportWorkbook(seed,snapshot.date))
const code=`async page => {
  const check=(value,message)=>{if(!value)throw new Error(message)};
  await page.goto('http://localhost:3000/report');
  await page.getByRole('heading',{name:'Buka laporan',exact:true}).waitFor();
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  let snapshot=${JSON.stringify(snapshot)}, authenticated=false,failDate=false, savedBody=null;
  const summary=${JSON.stringify({all:m.summarize(seed),provinces:seed.provinces.map(p=>({id:p.id,total:null,integrated:null,percent:null,accounts:Object.values(p.accounts).filter(a=>a.status==='ada').length}))})};
  await page.route('**/api/report**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.pathname.endsWith('/auth')){authenticated=request.method()!=='DELETE';return route.fulfill({json:{data:{role:'admin'}}})}
    if(!authenticated)return route.fulfill({status:401,json:{error:'PIN diperlukan'}});
    if(request.method()==='POST'){savedBody=request.postDataJSON();snapshot={...snapshot,date:savedBody.date,document:savedBody.document,revision:snapshot.revision+1};return route.fulfill({json:{data:snapshot}})}
    if(failDate)return route.fulfill({status:503,json:{error:'Kegagalan muat uji browser'}});
    const date=url.searchParams.get('date');
    return route.fulfill({json:{data:{role:'admin',snapshot:date===snapshot.date?snapshot:null,previous:date>snapshot.date?snapshot:null,history:[{date:snapshot.date,summary}],changes:[]}}});
  });
  await page.getByLabel('PIN akses',{exact:true}).fill('123456');
  await page.getByRole('button',{name:'Buka laporan',exact:true}).click();
  await page.getByRole('button',{name:'Buka laporan terakhir',exact:true}).click();
  await page.getByRole('heading',{name:'Monitoring 38 provinsi',exact:true}).waitFor();
  check(await page.locator('tbody tr').count()===38,'38 source provinces must render');
  failDate=true;
  await page.getByLabel('Tanggal laporan',{exact:true}).fill('2026-11-11');
  await page.getByRole('alert').filter({hasText:'Kegagalan muat uji browser'}).waitFor();
  check(await page.getByRole('button',{name:'Edit tabel',exact:true}).count()===0,'Failed date load must never leave the previous report editable under a new date');
  failDate=false;
  await page.getByLabel('Tanggal laporan',{exact:true}).fill('2026-11-10');
  await page.getByRole('heading',{name:'Monitoring 38 provinsi',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit tabel',exact:true}).click();
  check(await page.getByRole('checkbox').count()===228,'Six account checkboxes per province');
  await page.getByRole('button',{name:'Jawa Tengah',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Tambah paket',exact:true}).click();
  await dialog.getByLabel('Nama paket',{exact:true}).fill('Paket uji browser, bukan data produksi');
  await dialog.getByLabel('Total paket',{exact:true}).fill('1');
  await dialog.getByLabel('Jumlah terintegrasi SIPD',{exact:true}).fill('0');
  await dialog.getByLabel('PU',{exact:true}).selectOption('selesai');
  await dialog.getByLabel('BPKAD',{exact:true}).selectOption('proses');
  await page.keyboard.press('Escape');
  await page.getByLabel('Tanggal laporan',{exact:true}).fill('2026-11-11');
  await page.getByRole('dialog',{name:'Ada perubahan belum disimpan',exact:true}).waitFor();
  await page.getByRole('button',{name:'Kembali',exact:true}).click();
  await page.getByLabel('Alasan koreksi laporan sebelumnya',{exact:true}).fill('Uji browser terisolasi tanpa perubahan database');
  await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
  await page.getByRole('button',{name:'Edit tabel',exact:true}).waitFor();
  check(savedBody.document.provinces.find(p=>p.id==='jawa-tengah').packages[0].pu==='selesai','Package status must reach save payload');
  for(const width of [1440,390,320]) for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:1000});
    await page.getByRole('combobox',{name:'Tema tampilan',exact:true}).selectOption(theme);
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page must reflow without body overflow');
    await page.screenshot({path:'.next/report-work/report-'+width+'-'+theme+'.png',fullPage:true,animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('combobox',{name:'Tema tampilan',exact:true}).selectOption('light');
  await page.getByRole('button',{name:'Perkembangan',exact:true}).click();
  await page.getByRole('img',{name:/Grafik/}).waitFor();
  await page.screenshot({path:'.next/report-work/report-chart.png',fullPage:true,animations:'disabled'});
  await page.getByRole('button',{name:'Tabel laporan',exact:true}).click();
  const pdfEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Unduh PDF',exact:true}).click();
  const pdf=await pdfEvent;await pdf.saveAs('.next/report-work/browser-report.pdf');
  check(pdf.suggestedFilename()==='Laporan-ASB-2026-11-10.pdf','PDF filename follows saved date');
  await page.locator('input[type=file]').setInputFiles('.next/report-work/browser-template.xlsx');
  await page.getByRole('dialog',{name:'Pratinjau impor Excel',exact:true}).waitFor();
  await page.getByRole('button',{name:'Batal',exact:true}).click();
  failDate=true;
  await page.getByLabel('Tanggal laporan',{exact:true}).fill('2026-11-11');
  await page.getByRole('alert').filter({hasText:'Kegagalan muat uji browser'}).waitFor();
  check(await page.getByRole('button',{name:'Edit tabel',exact:true}).count()===0,'Failed date load must never leave the previous report editable under a new date');
  check(errors.length===0,'Browser runtime errors: '+errors.join('; '));
  return {passed:true,checks:'38 provinces, 228 checkboxes, package draft/save, dirty-date guard, 320/390/1440 light/dark, chart, browser XLSX parser, PDF and failed-date isolation. API intercepted only in this test; live DB unchanged.'};
}`
fs.writeFileSync('.next/report-work/browser-check.js',code)
console.log('Prepared isolated browser check using the actual PDF seed; no live writes.')
