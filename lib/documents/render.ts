import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import {z} from 'zod'
import {formatPeriodeSurat,formatTanggalIndo} from '@/lib/dateHelper'
import type {TemplateConfig,SingleField,DateRangeValue} from '@/types/templateSurat'

const value=z.string().max(20000)
export const documentPayload=z.object({code:z.string().min(1).max(80),version_id:z.string().uuid().optional(),single:z.record(z.string().max(80),z.union([value,z.object({start:z.string().max(10),end:z.string().max(10)})])),groups:z.record(z.string().max(80),z.array(z.record(z.string().max(80),value)).max(100))})
export type DocumentInput=z.infer<typeof documentPayload>
function validDate(value:string){const date=new Date(value);return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value}
function fieldError(field:SingleField,value:string|DateRangeValue|undefined){
  if(field.type==='dateRange'){
    if(!value&&!field.required)return
    if(typeof value!=='object')return `${field.label}: isi tanggal mulai dan selesai.`
    if(!value.start&&!value.end&&!field.required)return
    if(!validDate(value.start)||!validDate(value.end)||value.start>value.end)return `${field.label}: rentang tanggal tidak valid.`
  }else{
    if(value!==undefined&&typeof value!=='string')return `${field.label}: nilai tidak valid.`
    if(field.required&&!value?.trim())return `${field.label} wajib diisi.`
    if(value&&field.type==='select'&&!field.options?.includes(value))return `${field.label}: pilihan tidak valid.`
    if(value&&field.type==='date'&&!validDate(value))return `${field.label}: tanggal tidak valid.`
  }
}
export function renderDocument(buffer:Buffer,config:TemplateConfig,input:Pick<DocumentInput,'single'|'groups'>){
  const{single,groups}=input
  for(const field of config.single){const error=fieldError(field,single[field.key]);if(error)throw new Error(error)}
  for(const group of config.groups){
    const rows=groups[group.name]||[]
    if(rows.length<(group.minItems||0)||rows.length>group.maxItems)throw new Error(`${group.label} harus berisi ${group.minItems||0} sampai ${group.maxItems} orang/baris.`)
    for(const[index,row]of rows.entries())for(const field of group.fields){if(group.autoDateFrom&&field.key===group.autoDateField)continue;const error=fieldError(field,row[field.key]);if(error)throw new Error(`${group.label} ${index+1}: ${error}`)}
  }
  const finalData:Record<string,string|Record<string,string>[]>=Object.create(null)
  const dates:Record<string,{start:string;count:number}>=Object.create(null)
  for(const field of config.single){
    const val=single[field.key]
    if(field.type==='dateRange'){
      const range=val as DateRangeValue|undefined
      finalData[field.key]=range?.start&&range.end?formatPeriodeSurat(range.start,range.end):''
      if(range?.start&&range.end)dates[field.key]={start:range.start,count:Math.floor((Date.parse(range.end)-Date.parse(range.start))/86400000)+1}
    }else finalData[field.key]=typeof val==='string'?(field.type==='date'&&val?formatTanggalIndo(val):val):''
  }
  const warnings:string[]=[]
  for(const group of config.groups){
    const rows=groups[group.name]||[]
    if(group.repeatRows){finalData[group.name]=rows.map((row,index)=>({...Object.fromEntries(group.fields.map(field=>[field.key,row[field.key]||''])),nomor:String(index+1),label_kepada:index===0?'Kepada:':''}));continue}
    const range=group.autoDateFrom?dates[group.autoDateFrom]:null
    if(range&&range.count>group.maxItems)warnings.push(`Rentang tanggal "${group.autoDateFrom}" menghasilkan ${range.count} hari, tetapi template "${group.name}" hanya mendukung ${group.maxItems} hari.`)
    for(let index=0;index<group.maxItems;index++)for(const field of group.fields){
      const date=range&&index<range.count?new Date(Date.parse(range.start)+index*86400000).toISOString().slice(0,10):''
      finalData[`${field.key}_${index+1}`]=range&&field.key===group.autoDateField?(date?formatTanggalIndo(date):''):rows[index]?.[field.key]||''
    }
  }
  const doc=new Docxtemplater(new PizZip(buffer),{paragraphLoop:true,linebreaks:true,nullGetter:()=>'',errorLogging:false,delimiters:{start:'{{',end:'}}'},parser:(tag:string)=>({get:(scope:Record<string,unknown>)=>Object.hasOwn(scope,tag)?scope[tag]:''})})
  doc.render(finalData)
  return{buffer:doc.getZip().generate({type:'nodebuffer'}) as Buffer,warnings}
}
export function docxResponse(buffer:Buffer,name:string,warnings:string[]=[]){
  const safe=name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'-').trim().slice(0,150)||'dokumen.docx'
  return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="${safe.replace(/[^\x20-\x7e]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(safe)}`,'X-Warnings':encodeURIComponent(JSON.stringify(warnings)),'Cache-Control':'private, no-store'}})
}
