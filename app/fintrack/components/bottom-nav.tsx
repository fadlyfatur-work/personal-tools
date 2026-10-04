'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartPieSlice, House, Plus, Target, Wallet } from '@phosphor-icons/react'
import { useFintrack } from './fintrack-provider'

export function BottomNav() {
  const pathname = usePathname()
  const { openComposer } = useFintrack()

  return (
    <nav className="ft-bottom-nav" aria-label="Navigasi utama FinTrack">
      <Link href="/fintrack" aria-current={pathname === '/fintrack' ? 'page' : undefined} data-active={pathname === '/fintrack'}><House size={20} weight={pathname === '/fintrack' ? 'fill' : 'regular'} /><span>Beranda</span></Link>
      <Link href="/fintrack/activity" aria-current={pathname.startsWith('/fintrack/activity') ? 'page' : undefined} data-active={pathname.startsWith('/fintrack/activity')}><ChartPieSlice size={20} weight={pathname.startsWith('/fintrack/activity') ? 'fill' : 'regular'} /><span>Aktivitas</span></Link>
      <button className="ft-nav-compose" type="button" onClick={() => openComposer()} aria-label="Catat transaksi">
        <span><Plus size={24} weight="bold" /></span>
        <small>Catat</small>
      </button>
      <Link href="/fintrack/goals" aria-current={pathname.startsWith('/fintrack/goals') ? 'page' : undefined} data-active={pathname.startsWith('/fintrack/goals')}><Target size={20} weight={pathname.startsWith('/fintrack/goals') ? 'fill' : 'regular'} /><span>Tujuan</span></Link>
      <Link href="/fintrack/manage" aria-current={pathname.startsWith('/fintrack/manage') ? 'page' : undefined} data-active={pathname.startsWith('/fintrack/manage')}><Wallet size={20} weight={pathname.startsWith('/fintrack/manage') ? 'fill' : 'regular'} /><span>Kelola</span></Link>
    </nav>
  )
}
