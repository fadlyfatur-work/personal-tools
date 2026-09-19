'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EnvelopeSimple, GoogleLogo, Key, LockKey, Moon, Sun, Wallet } from '@phosphor-icons/react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { fintrackRequest } from '@/lib/fintrackRequest'
import { useFintrack } from '../components/fintrack-provider'

export default function LoginPage() {
  const router = useRouter()
  const { beginTask, endTask, theme, setTheme } = useFintrack()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  async function signInWithGoogle() {
    setGoogleLoading(true)
    setError('')
    const supabase = getSupabaseBrowser()
    const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${configuredSite || window.location.origin}/auth/callback` },
    })
    if (oauthError) {
      setError('Tidak dapat membuka login Google. Coba lagi.')
      setGoogleLoading(false)
    }
  }

  async function signInWithPin(event: React.FormEvent) {
    event.preventDefault()
    setPinLoading(true)
    setError('')
    beginTask('pin-login', 'Memeriksa email dan PIN')
    try {
      const response = await fintrackRequest('/api/fintrack/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pin }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'Email atau PIN tidak sesuai.')
        return
      }
      router.replace('/fintrack')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Login PIN belum dapat diproses.')
    } finally {
      setPinLoading(false)
      endTask('pin-login')
    }
  }

  return (
    <main className="ft-login">
      <section className="ft-login-story">
        <div>
          <div className="ft-login-brand-row">
            <div className="ft-brand" style={{ color: '#fff' }}>
              <span className="ft-brand-mark" style={{ background: 'rgba(255,255,255,.14)' }}><Wallet size={21} weight="fill" /></span>
              <strong>FinTrack</strong>
            </div>
            <button className="ft-login-theme" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Gunakan mode terang' : 'Gunakan mode gelap'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
          </div>
          <h1>Uang Anda, lebih mudah dipahami.</h1>
          <p>Catat transaksi harian, lihat posisi keuangan, dan bagikan dompet tertentu kepada orang yang Anda percaya.</p>
        </div>
        <div className="ft-login-note">Dibangun untuk penggunaan pribadi dan keluarga kecil.</div>
      </section>
      <section className="ft-login-panel">
        <div className="ft-login-card">
          <h2>Masuk ke FinTrack</h2>
          <p>Gunakan email dan PIN untuk akses cepat. Google tetap tersedia untuk akses pertama dan pemulihan PIN.</p>
          {error && <p className="ft-inline-message ft-error">{error}</p>}
          <form className="ft-pin-login-form" onSubmit={signInWithPin} data-updating={pinLoading}>
            <div className="ft-field">
              <label htmlFor="login-email">Email</label>
              <div className="ft-input-with-icon"><EnvelopeSimple size={18} /><input id="login-email" type="email" inputMode="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" required /></div>
            </div>
            <div className="ft-field">
              <label htmlFor="login-pin">PIN 6 digit</label>
              <div className="ft-input-with-icon"><Key size={18} /><input id="login-pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ''))} placeholder="••••••" required /></div>
            </div>
            <button className="ft-button ft-button-primary" type="submit" disabled={pinLoading || pin.length !== 6}>Masuk dengan PIN</button>
          </form>
          <div className="ft-login-divider"><span>atau</span></div>
          <button className="ft-button ft-google-button" onClick={signInWithGoogle} disabled={googleLoading || pinLoading}>
            <GoogleLogo size={21} weight="bold" />
            {googleLoading ? 'Membuka Google...' : 'Lanjutkan dengan Google'}
          </button>
          <div className="ft-security-note"><LockKey size={15} style={{ verticalAlign: '-2px', marginRight: 6 }} />Belum punya atau lupa PIN? Masuk dengan Google lalu aktifkan PIN baru melalui Pengaturan.</div>
          <div className="ft-register-link">Belum punya akun? <a href="/fintrack/register">Daftar dengan email dan PIN</a></div>
        </div>
      </section>
    </main>
  )
}
