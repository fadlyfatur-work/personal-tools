import Link from 'next/link'
import { GearSix, House, UsersThree } from '@phosphor-icons/react/dist/ssr'

export function BottomNav() {
  return (
    <nav className="ft-bottom-nav" aria-label="Navigasi FinTrack">
      <Link href="/fintrack"><House size={19} weight="fill" /><span>Beranda</span></Link>
      <Link href="/fintrack#transactions"><UsersThree size={19} /><span>Transaksi</span></Link>
      <Link href="/fintrack/settings"><GearSix size={19} /><span>Pengaturan</span></Link>
    </nav>
  )
}
