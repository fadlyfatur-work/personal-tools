'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GearSix, SignOut, Wallet } from '@phosphor-icons/react'

export function Header({ user }: { user: { name: string; email: string } }) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/fintrack/auth/logout', { method: 'POST' })
    router.replace('/fintrack/login')
    router.refresh()
  }

  return (
    <header className="ft-topbar">
      <Link href="/fintrack" className="ft-brand">
        <span className="ft-brand-mark"><Wallet size={20} weight="fill" /></span>
        <strong>FinTrack</strong>
      </Link>
      <div className="ft-top-actions">
        <span className="ft-user">{user.name}</span>
        <Link href="/fintrack/settings" className="ft-icon-button" title="Pengaturan dan kolaborasi"><GearSix size={19} /></Link>
        <button className="ft-icon-button" onClick={logout} title="Keluar"><SignOut size={19} /></button>
      </div>
    </header>
  )
}
