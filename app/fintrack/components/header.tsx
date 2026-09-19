'use client'

import { useRouter } from 'next/navigation'
import { SignOut } from '@phosphor-icons/react'
import { fintrackRequest } from '@/lib/fintrackRequest'
import { useFintrack } from './fintrack-provider'

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('id-ID', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date()).split('.')[0])
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function Header({ user, eyebrow, title }: { user: { name: string; email: string }; eyebrow?: string; title?: string; settings?: boolean }) {
  const router = useRouter()
  const { beginTask, endTask, clearCache, isBusy } = useFintrack()
  const dateLabel = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' }).format(new Date())
  const firstName = user.name.trim().split(/\s+/)[0] || 'Anda'

  async function logout() {
    beginTask('logout', 'Mengakhiri sesi')
    try {
      await fintrackRequest('/api/fintrack/auth/logout', { method: 'POST' })
      clearCache()
      router.replace('/fintrack/login')
      router.refresh()
    } finally {
      endTask('logout')
    }
  }

  return (
    <header className="ft-topbar">
      <div className="ft-identity">
        <span>{eyebrow || dateLabel}</span>
        <h1>{title || `${greeting()}, ${firstName}`}</h1>
      </div>
      <button type="button" className="ft-icon-button" aria-label="Keluar dari akun" title="Keluar" onClick={logout} disabled={isBusy('logout')}><SignOut size={19} /></button>
    </header>
  )
}
