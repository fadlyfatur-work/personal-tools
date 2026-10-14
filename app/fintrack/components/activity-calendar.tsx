'use client'

import { CaretLeft, CaretRight, CalendarBlank } from '@phosphor-icons/react'
import { useState } from 'react'
import { calendarCells } from '@/lib/fintrackPresentation'

export function ActivityCalendar({ start, end, days, selected, onSelect }: { start: string; end: string; days: Array<{ day: string; income: boolean; expense: boolean }>; selected: string; onSelect: (day: string) => void }) {
  const [month, setMonth] = useState(end.slice(0, 7))
  const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))
  function move(delta: number) { const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + delta); setMonth(date.toISOString().slice(0, 7)) }
  return <details className="ft-calendar"><summary><CalendarBlank size={20} />Kalender transaksi<span>{selected ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${selected}T12:00:00Z`)) : 'Pilih tanggal'}</span></summary><div className="ft-calendar-month"><button type="button" className="ft-icon-button" disabled={month <= start.slice(0, 7)} onClick={() => move(-1)} aria-label="Kalender bulan sebelumnya"><CaretLeft /></button><strong>{label}</strong><button type="button" className="ft-icon-button" disabled={month >= end.slice(0, 7)} onClick={() => move(1)} aria-label="Kalender bulan berikutnya"><CaretRight /></button></div><div className="ft-calendar-grid">{['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(day => <span key={day}>{day}</span>)}{calendarCells(month).map((day, index) => {
    if (!day) return <span key={`blank-${index}`} />
    const activity = days.find(item => item.day === day)
    return <button key={day} type="button" disabled={day < start || day > end} aria-pressed={selected === day} aria-label={`${day}${activity?.income ? ', ada pemasukan' : ''}${activity?.expense ? ', ada pengeluaran' : ''}`} onClick={() => onSelect(selected === day ? '' : day)}>{Number(day.slice(-2))}<small>{activity?.income && <i className="income" />}{activity?.expense && <i className="expense" />}</small></button>
  })}</div>{selected && <button type="button" className="ft-text-link" onClick={() => onSelect('')}>Tampilkan seluruh periode</button>}</details>
}
