import Link from 'next/link'

const features = [
  {
    href: '/paste',
    title: 'Paste Text',
    desc: 'Bagikan teks dengan kode singkat.',
    icon: '📋',
  },
  {
    href: '/documents/perjadin_2026',
    title: 'Template Surat Perjadin',
    desc: 'Buat template surat dengan mudah.',
    icon: '📝',
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              style={{
                background: '#fff',
                border: '1px solid #dadce0',
                borderRadius: 12,
                padding: 24,
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <h2 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
                {f.title}
              </h2>
              <p style={{ fontSize: 13, color: '#5f6368', margin: '4px 0 0' }}>
                {f.desc}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#1a73e8',
                }}
              >
                Buka 
              </span>
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
