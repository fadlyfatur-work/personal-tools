'use client'

import { useSyncExternalStore } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatRupiah } from './account-card'

const colors = ['var(--ft-report-1)', 'var(--ft-report-2)', 'var(--ft-report-3)', 'var(--ft-report-4)', 'var(--ft-report-5)', 'var(--ft-report-6)']
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export function ReportGraphic({ kind, data, label }: { kind: 'pie' | 'bar' | 'area'; data: Array<{ name: string; amount?: number; income?: number; expense?: number; current?: number; previous?: number }>; label: string }) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => true)
  const tooltip = <Tooltip formatter={value => formatRupiah(Number(value))} contentStyle={{ background: 'var(--ft-surface)', color: 'var(--ft-text)', border: '1px solid var(--ft-border)', borderRadius: 12, fontSize: 12 }} itemStyle={{ color: 'var(--ft-text)' }} />
  const axes = <><CartesianGrid stroke="var(--ft-border)" vertical={false} /><XAxis dataKey="name" tick={{ fill: 'var(--ft-muted)', fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis width={48} tickFormatter={value => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(value)} tick={{ fill: 'var(--ft-muted)', fontSize: 10 }} axisLine={false} tickLine={false} /></>
  return <div className={`ft-library-chart ft-library-chart-${kind}`} aria-label={label}>
    <div className="ft-chart-canvas"><ResponsiveContainer width="100%" height="100%" minWidth={0}>
      {kind === 'pie' ? <PieChart accessibilityLayer>{tooltip}<Pie data={data} dataKey="amount" nameKey="name" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="var(--ft-surface)" isAnimationActive={!reducedMotion} animationDuration={350}>{data.map((item, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie></PieChart>
        : kind === 'area' ? <AreaChart data={data} accessibilityLayer margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>{axes}{tooltip}<Legend wrapperStyle={{ fontSize: 11 }} /><Area dataKey="income" name="Pemasukan" type="monotone" stroke="var(--ft-income)" fill="var(--ft-income)" fillOpacity={.1} strokeWidth={2} isAnimationActive={!reducedMotion} animationDuration={350} /><Area dataKey="expense" name="Pengeluaran" type="monotone" stroke="var(--ft-expense)" fill="var(--ft-expense)" fillOpacity={.08} strokeWidth={2} isAnimationActive={!reducedMotion} animationDuration={350} /></AreaChart>
          : <BarChart data={data} accessibilityLayer margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>{axes}{tooltip}<Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="current" name="Saat ini" fill="var(--ft-primary)" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={350} /><Bar dataKey="previous" name="Sebelumnya" fill="var(--ft-muted)" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={350} /></BarChart>}
    </ResponsiveContainer></div>
    <details className="ft-chart-values"><summary>Lihat angka {label.toLocaleLowerCase('id')}</summary><ul>{data.map((item, index) => <li key={index}><strong>{item.name}</strong>{Object.entries(item).filter(([key]) => key !== 'name').map(([key, value]) => <span key={key}>{({ amount: 'Total', income: 'Pemasukan', expense: 'Pengeluaran', current: 'Saat ini', previous: 'Sebelumnya' } as Record<string, string>)[key]}: {formatRupiah(Number(value))}</span>)}</li>)}</ul></details>
  </div>
}
