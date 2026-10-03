import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Wallet, ClipboardText, FileText } from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'Menu aplikasi — Personal Tools',
  description: 'Pilih Fintrack, Paste Text, atau Nominatif.',
}

const features = [
  {
    href: '/fintrack',
    title: 'Fintrack',
    desc: 'Kelola dompet & transaksi. Login PIN 6 digit.',
    icon: <Wallet size={32} aria-hidden="true" />,
  },
  {
    href: '/paste',
    title: 'Paste Text',
    desc: 'Bagikan teks dengan kode singkat.',
    icon: <ClipboardText size={32} aria-hidden="true" />,
  },
  {
    href: '/nominatif',
    title: 'Nominatif Perjalanan Dinas',
    desc: 'Hitung rincian biaya sesuai aturan dan ekspor Excel.',
    icon: <FileText size={32} aria-hidden="true" />,
  },
]

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8f9fa',
        padding: '32px 16px',
        fontFamily: 'Google Sans, Roboto, Arial, sans-serif',
        color: '#202124',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: '#1a73e8', fontSize: 14, marginBottom: 16 }}>
          Kembali ke portofolio
        </Link>
        <header style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            Personal Tools
          </h1>
          <p style={{ fontSize: 14, color: '#5f6368', margin: '6px 0 0' }}>
            Pilih fitur yang mau dipakai.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 16,
          }}
        >
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group flex items-center gap-5 rounded-xl border border-[#dadce0] bg-white p-5 text-[#202124] no-underline outline-offset-4 hover:border-[#5f6368] focus-visible:outline-2 focus-visible:outline-[#174ea6]"
            >
              <div className="shrink-0 text-[#5f6368]">{f.icon}</div>
              <div className="min-w-0 flex-1">
                <h2 className="mb-1 text-lg leading-snug font-semibold">
                  {f.title}
                </h2>
                <p className="text-sm leading-relaxed text-[#454950]">{f.desc}</p>
              </div>
              <ArrowRight size={20} aria-hidden="true" className="shrink-0 text-[#174ea6]" />
            </Link>
          ))}
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#5f6368',
            marginTop: 18,
          }}
        >
          Simple, cepat, dan mudah dibagikan.
        </p>
      </div>
    </main>
  )
}
