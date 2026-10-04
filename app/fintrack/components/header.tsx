'use client'

import Link from 'next/link'
import { UserCircle } from '@phosphor-icons/react'
import { useConnectivity } from './connectivity-gate'

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('id-ID', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date()).split('.')[0])
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function Header({ user, eyebrow, title, settings }: { user: { name: string; email: string }; eyebrow?: string; title?: string; settings?: boolean }) {
  const { status: connectionStatus, countdown } = useConnectivity()
  const dateLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date())
  const firstName = user.name.trim().split(/\s+/)[0] || 'Anda'

  return (
    <header className="ft-topbar">
      <div className="ft-identity">
        <span>{eyebrow || dateLabel}</span>
        <h1>{title || `${greeting()}, ${firstName}`}</h1>
      </div>
      <div className="ft-header-actions"><span className="ft-header-connectivity" role="status" aria-live="polite"><span className="ft-header-connection" data-status={connectionStatus} aria-label={connectionStatus === 'online' ? 'Terhubung' : connectionStatus === 'checking' ? 'Memeriksa koneksi' : connectionStatus === 'offline' ? 'Tidak ada internet' : 'Server tidak tersedia'} title={connectionStatus === 'online' ? 'Terhubung' : connectionStatus === 'checking' ? 'Memeriksa koneksi' : connectionStatus === 'offline' ? 'Tidak ada internet' : 'Server tidak tersedia'}><span className="ft-connection-lamp" data-status={connectionStatus} /></span>{countdown !== null && <small>{countdown} dtk</small>}</span><Link href="/fintrack/settings" className="ft-icon-button ft-profile-link" aria-label="Profil dan setelan" title="Profil dan setelan" aria-current={settings ? 'page' : undefined}><UserCircle size={24} weight={settings ? 'fill' : 'regular'} /></Link></div>
    </header>
  )
}
