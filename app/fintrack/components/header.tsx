'use client'

import Link from 'next/link'
import { GearSix, X } from '@phosphor-icons/react'

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('id-ID', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date()).split('.')[0])
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function Header({ user, eyebrow, title, settings = false }: { user: { name: string; email: string }; eyebrow?: string; title?: string; settings?: boolean }) {
  const dateLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date())
  const firstName = user.name.trim().split(/\s+/)[0] || 'Anda'

  return (
    <header className="ft-topbar">
      <div className="ft-identity">
        <span>{eyebrow || dateLabel}</span>
        <h1>{title || `${greeting()}, ${firstName}`}</h1>
      </div>
      <Link href={settings ? '/fintrack' : '/fintrack/settings'} className="ft-icon-button" aria-label={settings ? 'Tutup pengaturan' : 'Buka pengaturan'} title={settings ? 'Tutup' : 'Pengaturan'}>{settings ? <X size={19} /> : <GearSix size={19} />}</Link>
    </header>
  )
}
