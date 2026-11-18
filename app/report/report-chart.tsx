'use client'

import {useState} from 'react'
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip} from 'recharts'
import {dateLabel,provinceName,type ProvinceReport,type ReportHistoryPoint} from '@/lib/report/model'
import s from './report.module.css'

type Metric='accounts'|'total'|'integrated'|'percent'
export default function ReportChart({history,provinces,from,to,maxDate,onRange,onOpenRecap}:{history:ReportHistoryPoint[];provinces:ProvinceReport[];from:string;to:string;maxDate:string;onRange:(from:string,to:string)=>void;onOpenRecap:(date:string)=>void}) {
  const [province,setProvince]=useState('all'),[metric,setMetric]=useState<Metric>('accounts')
  const label=metric==='accounts'?(province==='all'?'Provinsi dengan akun tercatat':'Peran akun tercatat'):metric==='total'?'Total paket':metric==='integrated'?'Paket siap integrasi':'Persentase integrasi'
  const points=history.map(point=>{
    const all=point.summary.all,p=point.summary.provinces.find(p=>p.id===province),provinceCount=all.provinceCount||38
    const coverage=metric==='total'?all.packageCoverage:metric==='integrated'?all.integratedCoverage:metric==='percent'?Math.min(all.packageCoverage,all.integratedCoverage):provinceCount
    const known=province==='all'?metric==='accounts'?all.provincesWithAccounts:metric==='total'?all.totalPackages:metric==='integrated'?all.integratedPackages:all.integrationPercent:p?.[metric]??null
    return {date:point.date,stamp:Date.parse(point.date),value:province==='all'&&coverage<provinceCount?null:known,known,coverage,provinceCount}
  })
  const hasValues=points.some(p=>p.value!==null)
  return <section className={s.chartSection} aria-labelledby="report-chart-title">
    <div className={s.sectionHeader}><div><h2 id="report-chart-title">Perkembangan {label.toLowerCase()}</h2><p>Grafik membandingkan rekap yang sudah disimpan.</p></div></div>
    <div className={s.chartFilters}><label>Tanggal awal<input type="date" min="2026-11-10" max={to} value={from} onChange={e=>{if(e.target.value)onRange(e.target.value,to)}}/></label><label>Tanggal akhir<input type="date" min={from} max={maxDate} value={to} onChange={e=>{if(e.target.value)onRange(from,e.target.value)}}/></label><label>Provinsi<select value={province} onChange={e=>setProvince(e.target.value)}><option value="all">Seluruh provinsi</option>{provinces.map(row=><option key={row.id} value={row.id}>{provinceName(row.id,row.name)}</option>)}</select></label><label>Data yang ditampilkan<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}><option value="accounts">Akun tercatat</option><option value="total">Total paket</option><option value="integrated">Paket siap integrasi</option><option value="percent">Persentase integrasi</option></select></label></div>
    {hasValues?<div className={s.chart} role="img" aria-label={`Grafik ${label}. Nilai lengkap tersedia pada tabel di bawah.`}><ResponsiveContainer width="100%" height="100%" minHeight={260}><LineChart data={points} margin={{top:20,right:22,bottom:12,left:0}}><CartesianGrid vertical={false} stroke="var(--suite-line)"/><XAxis dataKey="stamp" type="number" domain={['dataMin - 43200000','dataMax + 43200000']} tickFormatter={value=>new Date(value).toLocaleDateString('id-ID',{day:'numeric',month:'short',timeZone:'UTC'})} tick={{fill:'var(--suite-muted)',fontSize:12}}/><YAxis domain={metric==='percent'?[0,100]:[0,'auto']} allowDecimals={false} tick={{fill:'var(--suite-muted)',fontSize:12}}/><Tooltip labelFormatter={value=>dateLabel(new Date(Number(value)).toISOString().slice(0,10))} contentStyle={{background:'var(--suite-surface)',borderColor:'var(--suite-control)',color:'var(--suite-ink)'}} formatter={value=>[`${value}${metric==='percent'?'%':''}`,label]}/><Line dataKey="value" type="linear" stroke="var(--suite-accent)" strokeWidth={2} dot={{r:4,strokeWidth:2}} activeDot={{r:6}} connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>:<div className={s.emptyDetail}>Belum ada data lengkap untuk grafik ini. Lengkapi tabel atau pilih satu provinsi.</div>}
    <p className={s.quiet}>Tanggal tanpa data tidak ditampilkan sebagai titik. Rekap nasional baru ditampilkan jika seluruh provinsi tercakup.</p>
    <details className={s.seriesDetails}><summary>Lihat data grafik dan rekap tersimpan ({points.length} tanggal)</summary><div className={s.seriesScroll}><table className={s.seriesTable}><thead><tr><th>Tanggal</th><th>{label}</th><th>Keterangan</th><th>Akses</th></tr></thead><tbody>{points.map(point=><tr key={point.date}><td>{dateLabel(point.date)}</td><td>{point.known===null?'N/D':`${point.known.toLocaleString('id-ID')}${metric==='percent'?'%':''}`}</td><td>{province==='all'&&point.coverage<point.provinceCount?`Data mencakup ${point.coverage} dari ${point.provinceCount} provinsi; nilai nasional belum ditampilkan.`:point.value===null?'Belum ada data':'Tersimpan'}</td><td><button type="button" className={s.textButton} onClick={()=>onOpenRecap(point.date)}>Buka rekap</button></td></tr>)}</tbody></table></div></details>
  </section>
}
