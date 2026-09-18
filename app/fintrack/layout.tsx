import type { ReactNode } from 'react'
import './fintrack.css'

export const metadata = {
  title: 'FinTrack | Keuangan yang terasa ringan',
  description: 'Catat pemasukan, pengeluaran, dan dompet bersama dalam satu tempat.',
}

export default function FintrackLayout({ children }: { children: ReactNode }) {
  return <div className="fintrack-shell">{children}</div>
}
