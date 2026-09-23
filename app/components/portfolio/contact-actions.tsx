'use client'

import { useState } from 'react'
import { Copy, EnvelopeSimple } from '@phosphor-icons/react'
import { email } from './data'
import styles from './portfolio.module.css'

export function ContactActions() {
  const [message, setMessage] = useState('')
  async function copyEmail() {
    try { await navigator.clipboard.writeText(email); setMessage('Alamat email tersalin.') }
    catch { setMessage('Belum bisa menyalin otomatis. Pilih alamat email di atas untuk menyalinnya.') }
  }
  return <>
    <a className={styles.email} href={`mailto:${email}`}>{email}</a>
    <div className={styles.actions}>
      <a className={styles.primaryButton} href={`mailto:${email}`}><EnvelopeSimple size={20} aria-hidden="true" />Buka aplikasi email</a>
      <button className={styles.secondaryButton} onClick={copyEmail}><Copy size={20} aria-hidden="true" />Salin alamat email</button>
    </div>
    <p className={styles.feedback} role="status">{message}</p>
  </>
}
