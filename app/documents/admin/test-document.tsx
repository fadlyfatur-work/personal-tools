'use client'
import { useState } from 'react'
import type { TemplateConfig, SingleField, DateRangeValue } from '@/types/templateSurat'
import { generateDateRange } from '@/lib/dateHelper'
import styles from '../documents.module.css'
export function TestDocument({ fields, run, busy }: { fields: TemplateConfig; run: (single: Record<string, string | DateRangeValue>, groups: Record<string, Record<string,string>[]>) => Promise<void>; busy: boolean }) {
  const [single, setSingle] = useState<Record<string,string | DateRangeValue>>({})
  const [groups, setGroups] = useState<Record<string,Record<string,string>[]>>(() => Object.fromEntries(fields.groups.map(group => [group.name, group.autoDateFrom ? [] : Array.from({length: Math.max(group.minItems || 0,1)}, () => Object.fromEntries(group.fields.map(field => [field.key,''])))])))
  function changeDate(key: string, part: 'start' | 'end', value: string) {
    const range = { ...((single[key] as DateRangeValue) || {start:'',end:''}), [part]:value }
    setSingle({...single,[key]:range})
    const dates=range.start&&range.end ? generateDateRange(range.start,range.end):[]
    setGroups(previous => ({...previous,...Object.fromEntries(fields.groups.filter(group=>group.autoDateFrom===key).map(group=>[group.name,dates.slice(0,group.maxItems).map((date,index)=>({...previous[group.name]?.[index],[group.autoDateField || 'tanggal']:date}))]))}))
  }
  function input(field: SingleField, value: string, update: (v: string) => void, disabled=false) {
    return <label className={styles.label}>{field.label}{field.type==='textarea'?<textarea className={styles.input} required={field.required} value={value} onChange={e=>update(e.target.value)} />:field.type==='select'?<select required={field.required} className={styles.input} value={value} onChange={e=>update(e.target.value)}><option value="">Pilih</option>{field.options?.map(option=><option key={option}>{option}</option>)}</select>:<input className={styles.input} required={field.required} disabled={disabled} type={field.type==='date'?'date':'text'} value={value} onChange={e=>update(e.target.value)} />}</label>
  }
  return <form className={styles.panel} onSubmit={e=>{e.preventDefault();void run(single,groups)}}><h2>Uji hasil Word</h2><p className={styles.help}>Isi contoh data, unduh, dan periksa hasil Word. Penerbitan tersedia setelah versi ini berhasil diuji.</p>
    {fields.single.map(field=>field.type==='dateRange'?<fieldset key={field.key} className={styles.field}><legend>{field.label}</legend><div className={styles.grid}>{(['start','end'] as const).map(part=><label key={part}>{part==='start'?'Tanggal mulai':'Tanggal selesai'}<input className={styles.input} required={field.required} type="date" value={(single[field.key] as DateRangeValue)?.[part] || ''} onChange={e=>changeDate(field.key,part,e.target.value)} /></label>)}</div></fieldset>:<div key={field.key}>{input(field,(single[field.key] as string)||'',value=>setSingle({...single,[field.key]:value}))}</div>)}
    {fields.groups.map(group=><fieldset key={group.name} className={styles.entry}><legend>{group.label}</legend>{group.autoDateFrom&&!groups[group.name]?.length&&<p className={styles.help}>Pilih periode tanggal untuk menampilkan baris.</p>}{(groups[group.name]||[]).map((row,index)=><div className={styles.entry} key={index}><h3>Baris {index+1}</h3>{group.fields.map(field=><div key={field.key}>{input(field,row[field.key]||'',value=>setGroups({...groups,[group.name]:groups[group.name].map((item,i)=>index===i?{...item,[field.key]:value}:item)}),!!group.autoDateFrom&&field.key===group.autoDateField)}</div>)}{!group.autoDateFrom&&groups[group.name].length>(group.minItems||0)&&<button type="button" className={styles.remove} onClick={()=>setGroups({...groups,[group.name]:groups[group.name].filter((_,i)=>i!==index)})}>Hapus baris {index+1}</button>}</div>)}{!group.autoDateFrom&&(groups[group.name]?.length||0)<group.maxItems&&<button type="button" className={styles.secondary} onClick={()=>setGroups({...groups,[group.name]:[...(groups[group.name]||[]),Object.fromEntries(group.fields.map(field=>[field.key,'']))]})}>Tambah baris {group.label}</button>}</fieldset>)}
    <button className={styles.button} disabled={busy}>{busy?'Menyiapkan uji…':'Unduh Word uji'}</button>
  </form>
}
