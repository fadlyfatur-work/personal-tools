import {z} from 'zod'
import PizZip from 'pizzip'
import type {TemplateConfig} from '@/types/templateSurat'

const key=z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/).refine(value=>!['__proto__','prototype','constructor'].includes(value))
const field=z.object({key,label:z.string().trim().min(1).max(160),type:z.enum(['text','textarea','date','dateRange','select']).optional(),options:z.array(z.string().max(200)).max(100).optional(),required:z.boolean().optional()}).strict()
export const fieldsSchema=z.object({single:z.array(field).max(100),groups:z.array(z.object({name:key,label:z.string().min(1).max(160),maxItems:z.number().int().min(1).max(100),minItems:z.number().int().min(0).max(100).optional(),repeatRows:z.boolean().optional(),fields:z.array(field).min(1).max(40),autoDateFrom:key.optional(),autoDateField:key.optional()}).strict()).max(20)}).strict()
export function validateTemplateFields(value:unknown):TemplateConfig{
  const config=fieldsSchema.parse(value)
  const names=[...config.single.map(item=>item.key),...config.groups.map(item=>item.name)]
  if(new Set(names).size!==names.length)throw new Error('Nama variabel atau grup tidak boleh berulang.')
  for(const item of config.single){if(item.type==='select'&&!item.options?.length)throw new Error('Pilihan isian wajib tersedia.')}
  for(const group of config.groups){
    if((group.minItems||0)>group.maxItems||new Set(group.fields.map(item=>item.key)).size!==group.fields.length)throw new Error('Konfigurasi grup tidak valid.')
    if(group.fields.some(item=>item.type==='dateRange'))throw new Error('Rentang tanggal hanya didukung di isian tunggal.')
    if(group.autoDateFrom&&(!config.single.some(item=>item.key===group.autoDateFrom&&item.type==='dateRange')||!group.fields.some(item=>item.key===group.autoDateField)))throw new Error('Sumber tanggal otomatis tidak sesuai.')
    if(group.fields.some(item=>item.type==='select'&&!item.options?.length))throw new Error('Pilihan isian grup wajib tersedia.')
  }
  return config
}
export function templateAvailable(template:{status:string;access_tag_id:string;active_version_id:string|null},tagId:string){return template.status==='published'&&template.access_tag_id===tagId&&Boolean(template.active_version_id)}
const decode=(value:string)=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')
export function inspectDocx(buffer:Buffer){
  if(buffer.length>10*1024*1024)throw new Error('File maksimal 10 MiB.')
  let zip:PizZip
  try{zip=new PizZip(buffer)}catch{throw new Error('File harus merupakan dokumen DOCX yang valid.')}
  const entries=Object.values(zip.files)
  if(entries.length>1000||!zip.file('[Content_Types].xml')||!zip.file('word/document.xml'))throw new Error('Struktur DOCX tidak didukung.')
  let total=0
  for(const file of entries){
    if(file.dir)continue
    const size=(file as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize||0
    total+=size
    if(size>20*1024*1024||total>50*1024*1024||/(^|\/)\.\.(\/|$)|^\/|vbaProject|word\/(embeddings|activeX)\//i.test(file.name))throw new Error('File berisi konten atau ukuran arsip yang tidak didukung.')
    if(file.name.endsWith('.rels')){
      const xml=file.asText()
      for(const relation of xml.matchAll(/<Relationship\b[^>]*>/g)){
        if(/TargetMode\s*=\s*["']External/i.test(relation[0])&&!/Type\s*=\s*["'][^"']*\/hyperlink["']/.test(relation[0]))throw new Error('Referensi file eksternal tidak diizinkan.')
        if(/TargetMode\s*=\s*["']External/i.test(relation[0])&&!/Target\s*=\s*["']https?:\/\//i.test(relation[0]))throw new Error('Tautan eksternal harus menggunakan HTTP atau HTTPS.')
      }
    }
  }
  const texts=entries.filter(file=>/^word\/(document|header\d+|footer\d+)\.xml$/.test(file.name)).map(file=>[...file.asText().matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(item=>decode(item[1])).join('')).join('\n')
  const tokens=[...texts.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(item=>item[1])
  const placeholders=[...new Set(tokens)]
  if(placeholders.length>500||placeholders.some(item=>!/^[#\/]?[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(item)))throw new Error('Gunakan variabel sederhana tanpa ekspresi atau kode.')
  const single:TemplateConfig['single']=[],groups:TemplateConfig['groups']=[]
  let current:TemplateConfig['groups'][number]|null=null
  for(const item of tokens){
    if(item.startsWith('#')){if(current)throw new Error('Grup bertingkat belum didukung.');current=groups.find(group=>group.name===item.slice(1))||{name:item.slice(1),label:item.slice(1).replaceAll('_',' '),minItems:1,maxItems:20,repeatRows:true,fields:[]};if(!groups.includes(current))groups.push(current)}
    else if(item.startsWith('/')){if(!current||item.slice(1)!==current.name)throw new Error('Penutup grup tidak sesuai.');current=null}
    else{const target=current?.fields||single;if(!target.some(field=>field.key===item))target.push({key:item,label:item.replaceAll('_',' '),type:'text'})}
  }
  if(current)throw new Error('Grup template belum ditutup.')
  return{placeholders,fields:{single,groups} as TemplateConfig}
}
export function validatePlaceholderCoverage(placeholders:string[],config:TemplateConfig){
  const available=new Set(config.single.map(item=>item.key))
  for(const group of config.groups){available.add(`#${group.name}`);available.add(`/${group.name}`);if(group.repeatRows){available.add('nomor');available.add('label_kepada');for(const field of group.fields)available.add(field.key)}else{for(const field of group.fields)for(let index=1;index<=group.maxItems;index++)available.add(`${field.key}_${index}`)}}
  const missing=placeholders.filter(item=>!available.has(item))
  if(missing.length)throw new Error(`Variabel belum memiliki isian: ${missing.slice(0,10).join(', ')}`)
}
