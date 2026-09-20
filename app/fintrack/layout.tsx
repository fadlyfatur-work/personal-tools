import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { FintrackProvider } from './components/fintrack-provider'
import { ConnectivityGate } from './components/connectivity-gate'
import './fintrack-mobile.css'

export const metadata: Metadata = {
  title: 'FinTrack | Keuangan yang terasa ringan',
  description: 'Catat pemasukan, pengeluaran, dan dompet bersama dalam satu tempat.',
  applicationName: 'FinTrack',
  manifest: '/fintrack.webmanifest',
  appleWebApp: { capable: true, title: 'FinTrack', statusBarStyle: 'black-translucent' },
  icons: { icon: [{ url: '/fintrack-mark.svg', type: 'image/svg+xml' }, { url: '/fintrack-favicon-32.png', sizes: '32x32', type: 'image/png' }], apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0f5944' }

export default function FintrackLayout({ children }: { children: ReactNode }) {
  return <div className="fintrack-shell"><ConnectivityGate><FintrackProvider>{children}</FintrackProvider></ConnectivityGate></div>
}
