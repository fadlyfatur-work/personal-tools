'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChartPieSlice, GearSix, House, Plus, Wallet } from '@phosphor-icons/react'
import { useFintrack } from './fintrack-provider'

export function BottomNav() {
  const pathname = usePathname()
  const { openComposer } = useFintrack()

  return (
    <nav className="ft-bottom-nav" aria-label="Navigasi utama FinTrack">
      <Link href="/fintrack" data-active={pathname === '/fintrack'}><House size={20} weight={pathname === '/fintrack' ? 'fill' : 'regular'} /><span>Beranda</span></Link>
      <Link href="/fintrack/activity" data-active={pathname.startsWith('/fintrack/activity')}><ChartPieSlice size={20} weight={pathname.startsWith('/fintrack/activity') ? 'fill' : 'regular'} /><span>Aktivitas</span></Link>
      <button className="ft-nav-compose" type="button" onClick={() => openComposer()} aria-label="Catat transaksi">
        <span><Plus size={24} weight="bold" /></span>
        <small>Catat</small>
      </button>
      <Link href="/fintrack/manage" data-active={pathname.startsWith('/fintrack/manage')}><Wallet size={20} weight={pathname.startsWith('/fintrack/manage') ? 'fill' : 'regular'} /><span>Kelola</span></Link>
      <Link href="/fintrack/settings" data-active={pathname.startsWith('/fintrack/settings')}><GearSix size={20} weight={pathname.startsWith('/fintrack/settings') ? 'fill' : 'regular'} /><span>Setelan</span></Link>
    </nav>
  )
}
