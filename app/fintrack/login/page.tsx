'use client'

import { useState } from 'react'
import { GoogleLogo, LockKey, Wallet } from '@phosphor-icons/react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    const supabase = getSupabaseBrowser()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/fintrack` },
    })
    if (oauthError) {
      setError('Tidak dapat membuka login Google. Coba lagi.')
      setLoading(false)
    }
  }

  return (
    <main className="ft-login">
      <section className="ft-login-story">
        <div>
          <div className="ft-brand" style={{ color: '#fff' }}>
            <span className="ft-brand-mark" style={{ background: 'rgba(255,255,255,.14)' }}><Wallet size={21} weight="fill" /></span>
            <strong>FinTrack</strong>
          </div>
          <h1>Uang Anda, lebih mudah dipahami.</h1>
          <p>Catat transaksi harian, lihat posisi keuangan, dan bagikan dompet tertentu kepada orang yang Anda percaya.</p>
        </div>
        <div className="ft-login-note">Dibangun untuk penggunaan pribadi dan keluarga kecil.</div>
      </section>
      <section className="ft-login-panel">
        <div className="ft-login-card">
          <h2>Masuk ke FinTrack</h2>
          <p>Gunakan akun Google agar identitas dan pemulihan akun tetap aman tanpa mengandalkan email dari aplikasi.</p>
          {error && <p className="ft-inline-message ft-error">{error}</p>}
          <button className="ft-button ft-google-button" onClick={signInWithGoogle} disabled={loading}>
            <GoogleLogo size={21} weight="bold" />
            {loading ? 'Membuka Google...' : 'Lanjutkan dengan Google'}
          </button>
          <div className="ft-security-note"><LockKey size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />FinTrack hanya menerima nama, email, dan identitas akun yang dibutuhkan untuk membuat sesi.</div>
        </div>
      </section>
    </main>
  )
}
