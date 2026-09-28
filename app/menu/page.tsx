import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Wallet, ClipboardText, FileText } from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'Menu aplikasi — Personal Tools',
  description: 'Pilih Fintrack, Paste Text, Nominatif, atau Template Surat Perjadin.',
}

const features = [
  {
    href: '/fintrack',
    title: 'Fintrack',
    desc: 'Kelola dompet & transaksi. Login PIN 6 digit.',
    icon: <Wallet size={32} aria-hidden="true" />,
    gradient: 'from-purple-100 to-purple-200',
  },
  {
    href: '/paste',
    title: 'Paste Text',
    desc: 'Bagikan teks dengan kode singkat.',
    icon: <ClipboardText size={32} aria-hidden="true" />,
    gradient: 'from-green-100 to-green-200',
  },
  {
    href: '/nominatif',
    title: 'Nominatif Perjalanan Dinas',
    desc: 'Hitung rincian biaya sesuai aturan dan ekspor Excel.',
    icon: <FileText size={32} aria-hidden="true" />,
    gradient: 'from-rose-100 to-rose-200',
  },
  {
    href: '/documents/perjadin_2026',
    title: 'Template Surat Perjadin',
    desc: 'Buat template surat dengan mudah.',
    icon: <FileText size={32} aria-hidden="true" />,
    gradient: 'from-blue-100 to-blue-200',
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
            gap: 16,
          }}
        >
          {features.map((f, index) => (
            <Link
              key={f.href}
              href={f.href}
              className={`group relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br p-7 text-[#202124] no-underline outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#1a73e8] motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.98] sm:min-h-[390px] sm:p-8 ${f.gradient}`}
            >
              <div>
                <span aria-hidden="true" className="mb-8 block font-mono text-sm text-[#50545b]">
                  ( {String(index + 1).padStart(3, '0')} )
                </span>
                <div className="[&>svg]:size-12">{f.icon}</div>
              </div>
              <div className="mt-12">
                <h2 className="mb-3 text-lg leading-snug font-semibold tracking-wide uppercase">
                  {f.title}
                </h2>
                <p className="text-sm leading-relaxed text-[#454950]">{f.desc}</p>
                <span className="mt-6 flex items-center justify-between text-sm font-medium">
                  Buka
                  <ArrowRight size={20} aria-hidden="true" className="motion-safe:transition-transform motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#80868b',
            marginTop: 18,
          }}
        >
          Simple, cepat, dan mudah dibagikan.
        </p>
      </div>
    </main>
  )
}
