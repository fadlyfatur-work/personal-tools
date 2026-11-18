import assert from 'node:assert/strict'
import fs from 'node:fs'
import PizZip from 'pizzip'
import {createRequire} from 'node:module'
import {loadSuiteModule} from './helpers/load-suite-module.mjs'
const require=createRequire(import.meta.url)
assert.ok(fs.existsSync('lib/report/excel.ts'),'Report Excel input/output is not implemented')
const {DOMParser}=require('@xmldom/xmldom')
const parse=xml=>new DOMParser().parseFromString(xml,'text/xml')
const m={...loadSuiteModule('lib/report/model.ts'),...loadSuiteModule('lib/report/seed.ts')},excel=loadSuiteModule('lib/report/excel.ts')
const doc=m.createSeed()
doc.provinces[0].totalPackages=2
doc.provinces[0].integratedPackages=1
doc.provinces[0].packages=[m.newPackage('Jalan & Jembatan <Timur>','paket-test')]
doc.provinces[0].packages[0].pu='selesai'
const bytes=excel.createReportWorkbook(doc,'2026-11-11')
assert.ok(bytes.length>5000)
const result=await excel.readReportWorkbook(bytes,doc,'2026-11-11',parse)
assert.equal(result.document.provinces[0].packages[0].name,'Jalan & Jembatan <Timur>')
assert.equal(result.document.provinces[0].totalPackages,2)
assert.equal(result.document.provinces[0].packages[0].pu,'selesai')
assert.equal(result.document.provinces[1].totalPackages,null)
const sharedWorkbook=new PizZip(bytes)
sharedWorkbook.file('xl/sharedStrings.xml','<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>sumatera-selatan</t></si></sst>')
sharedWorkbook.file('xl/worksheets/sheet2.xml',sharedWorkbook.file('xl/worksheets/sheet2.xml').asText().replace('<c r="A2" t="inlineStr"><is><t xml:space="preserve">sumatera-selatan</t></is></c>','<c r="A2" t="s"><v>0</v></c>'))
assert.equal((await excel.readReportWorkbook(sharedWorkbook.generate({type:'uint8array'}),doc,'2026-11-11',parse)).document.provinces[0].totalPackages,2)
await assert.rejects(excel.readReportWorkbook(bytes,doc,'2026-11-10',parse),/tanggal/i)
const archive=new PizZip(bytes)
const content=archive.file('xl/worksheets/sheet2.xml').asText()
archive.file('xl/worksheets/sheet2.xml',content.replace('<row r="2">','<row r="2"><c r="Z2"><f>1+1</f><v>2</v></c>'))
await assert.rejects(excel.readReportWorkbook(archive.generate({type:'uint8array'}),doc,'2026-11-11',parse),/rumus/i)
const partial=new PizZip(bytes)
partial.file('xl/worksheets/sheet4.xml',partial.file('xl/worksheets/sheet4.xml').asText().replace(/<row r="2">[\s\S]*?<\/row>/,''))
assert.equal((await excel.readReportWorkbook(partial.generate({type:'uint8array'}),doc,'2026-11-11',parse)).document.provinces[0].packages.length,1)
const bomb=new PizZip(bytes)
bomb.file('xl/worksheets/sheet2.xml',' '.repeat(40*1024*1024))
const bombBytes=Buffer.from(bomb.generate({type:'uint8array',compression:'DEFLATE'}))
for(let i=0;i<bombBytes.length-46;i++){
  if(bombBytes.readUInt32LE(i)!==0x02014b50)continue
  const length=bombBytes.readUInt16LE(i+28),name=bombBytes.subarray(i+46,i+46+length).toString()
  if(name==='xl/worksheets/sheet2.xml')bombBytes.writeUInt32LE(1,i+24)
}
await assert.rejects(excel.readReportWorkbook(bombBytes,doc,'2026-11-11',parse),/maksimal|terlalu besar|batas/i)
const pdf=loadSuiteModule('lib/report/pdf.ts').createReportPdf({date:'2026-11-11',revision:1,document:doc,created_at:'2026-11-11T00:00:00Z',updated_at:'2026-11-11T00:00:00Z'})
assert.ok(pdf.getNumberOfPages()>=2)
fs.mkdirSync('.next/report-work',{recursive:true})
fs.writeFileSync('.next/report-work/report-check.pdf',Buffer.from(pdf.output('arraybuffer')))
fs.writeFileSync('.next/report-work/report-template.xlsx',bytes)
console.log('PASS: XLSX round-trip, entities, unknowns, wrong date, formulas, non-destructive partial import and PDF generation.')
