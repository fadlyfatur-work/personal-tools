import type { Metadata } from 'next'
import { PosApp } from './pos-app'

export const metadata: Metadata = {
  title: 'Aplikasi POS | Demo Personal Tools',
  description: 'Coba kasir, katalog produk, stok, shift, dan laporan POS langsung di browser. Unduh struk PDF tanpa akun.',
}

export default function PosPage() {
  return <PosApp />
}
