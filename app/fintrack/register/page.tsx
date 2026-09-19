'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EnvelopeSimple, Key, Moon, Sun, User, Wallet } from '@phosphor-icons/react'
import { fintrackRequest } from '@/lib/fintrackRequest'
import { useFintrack } from '../components/fintrack-provider'

export default function RegisterPage() {
  const router = useRouter()
  const { beginTask, endTask, theme, setTheme } = useFintrack()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function register(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    beginTask('register', 'Membuat akun')
    try {
      const response = await fintrackRequest('/api/fintrack/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, pin }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'Akun tidak dapat dibuat.')
        return
      }
      router.replace('/fintrack')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Akun tidak dapat dibuat.')
    } finally {
      setSaving(false)
      endTask('register')
    }
  }

  return <main className="ft-login"><section className="ft-login-story"><div><div className="ft-login-brand-row"><div className="ft-brand" style={{ color: '#fff' }}><span className="ft-brand-mark" style={{ background: 'rgba(255,255,255,.14)' }}><Wallet size={21} weight="fill" /></span><strong>FinTrack</strong></div><button className="ft-login-theme" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Gunakan mode terang' : 'Gunakan mode gelap'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button></div><h1>Mulai mencatat dengan tenang.</h1><p>Buat akun pribadi tanpa email OTP. Anda hanya membutuhkan nama, email, dan PIN enam digit.</p></div></section><section className="ft-login-panel"><div className="ft-login-card"><h2>Daftar FinTrack</h2><p>Akun langsung aktif dan dapat digunakan untuk masuk menggunakan email serta PIN.</p>{error && <p className="ft-inline-message ft-error">{error}</p>}<form className="ft-pin-login-form" onSubmit={register} data-updating={saving}><div className="ft-field"><label htmlFor="register-name">Nama</label><div className="ft-input-with-icon"><User size={18} /><input id="register-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama Anda" required /></div></div><div className="ft-field"><label htmlFor="register-email">Email</label><div className="ft-input-with-icon"><EnvelopeSimple size={18} /><input id="register-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" required /></div></div><div className="ft-field"><label htmlFor="register-pin">PIN 6 digit</label><div className="ft-input-with-icon"><Key size={18} /><input id="register-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ''))} placeholder="••••••" required /></div></div><button className="ft-button ft-button-primary" type="submit" disabled={saving || pin.length !== 6}>{saving ? 'Membuat akun...' : 'Buat akun'}</button></form><div className="ft-register-link">Sudah punya akun? <Link href="/fintrack/login">Masuk</Link></div></div></section></main>
}
