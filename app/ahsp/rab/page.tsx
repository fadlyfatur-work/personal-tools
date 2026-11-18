import type { Metadata } from 'next'
import RabReconciliation from './reconciliation'

export const metadata: Metadata = {
  title: 'Pencocokan RAB | Personal Tools',
  description: 'Cocokkan item pekerjaan Excel, PDF, dan gambar dengan katalog AHSP, periksa rekomendasi, dan unduh rekapitulasi.',
}
export default function RabPage() { return <RabReconciliation /> }
