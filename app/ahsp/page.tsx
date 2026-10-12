import type { Metadata } from 'next'
import AhspCatalog from './catalog'

export const metadata: Metadata = {
  title: 'AHSP 2026 | Personal Tools',
  description: 'Katalog pekerjaan, komponen analisis, kalkulator, dan rekonsiliasi AHSP SE 47/2026.',
}

export default function AhspPage() { return <AhspCatalog /> }
