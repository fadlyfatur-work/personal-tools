import type { Metadata } from 'next'
import MptkCatalog from './catalog'

export const metadata: Metadata = {
  title: 'Rekapitulasi MPTK | Personal Tools',
  description: 'Cari komponen tenaga kerja, material, dan peralatan beserta pekerjaan, koefisien, dan sumber analisis AHSP.',
}

export default function MptkPage() { return <MptkCatalog /> }
