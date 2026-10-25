'use client'

import { useState } from 'react'
import { ArrowRight, Check, ClipboardText, Copy, SpinnerGap } from '@phosphor-icons/react'
import styles from './paste.module.css'

export function PasteWorkspace() {
  const [description, setDescription] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [loadingPaste, setLoadingPaste] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [resultText, setResultText] = useState('')
  const [loadingFetch, setLoadingFetch] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [resultCopyMessage, setResultCopyMessage] = useState('')

  async function copyCode() {
    setCopyMessage('')
    try { await navigator.clipboard.writeText(generatedCode); setCopyMessage('Kode tersalin.') }
    catch { setCopyMessage('Belum bisa menyalin otomatis. Pilih kode di atas dan salin secara manual.') }
  }

  async function copyResult() {
    setResultCopyMessage('')
    try { await navigator.clipboard.writeText(resultText); setResultCopyMessage('Teks tersalin.') }
    catch { setResultCopyMessage('Belum bisa menyalin otomatis. Pilih teks hasil dan salin secara manual.') }
  }

  async function handlePaste() {
    if (loadingPaste || !description.trim()) return
    setLoadingPaste(true)
    setGeneratedCode('')
    setSaveError('')
    setCopyMessage('')
    try {
      const res = await fetch('/api/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: description }),
      })
      const data = await res.json()
      if (!res.ok || !data.code) throw new Error('save failed')
      setGeneratedCode(data.code)
      setDescription('')
    } catch {
      setSaveError('Teks belum berhasil disimpan. Isi teks tetap tersedia; coba buat kode lagi.')
    } finally {
      setLoadingPaste(false)
    }
  }

  async function handleFetchCode() {
    if (loadingFetch || !codeInput.trim()) return
    setLoadingFetch(true)
    setErrorMsg('')
    setResultText('')
    setResultCopyMessage('')
    try {
      const res = await fetch(`/api/paste/${encodeURIComponent(codeInput.trim())}`)
      const data = await res.json()
      if (res.ok && typeof data.content === 'string') {
        setResultText(data.content)
      } else {
        setErrorMsg(data.error || 'Kode tidak ditemukan')
      }
    } catch {
      setErrorMsg('Terjadi kesalahan, coba lagi')
    } finally {
      setLoadingFetch(false)
    }
  }

  return <div className={styles.workspace}>
    <section className={styles.create} aria-labelledby="create-title">
      <div className={styles.sectionHeading}><span className={styles.index}>01</span><h2 id="create-title">Buat Paste</h2><ArrowRight size={20} aria-hidden="true" /></div>
      <div className={styles.sectionBody}>
        <p className={styles.description}>Masukkan teks untuk mendapatkan kode akses.</p>
        <form onSubmit={event => { event.preventDefault(); void handlePaste() }} aria-busy={loadingPaste}>
          <label htmlFor="paste-text">Teks yang dibagikan</label>
          <textarea id="paste-text" className={styles.editor} placeholder="Tulis atau tempel teks di sini..." value={description} onChange={event => setDescription(event.target.value)} rows={6} maxLength={100_000} readOnly={loadingPaste} aria-describedby={saveError ? 'save-error' : undefined} />
          <div className={styles.editorActions}>
            <span className={styles.count}>{description.length.toLocaleString('id-ID')} karakter</span>
            <button type="submit" className={styles.primaryButton} disabled={loadingPaste || !description.trim()}>
              {loadingPaste ? <SpinnerGap className={styles.spinner} size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
              <span>{loadingPaste ? 'Menyimpan...' : 'Buat Kode'}</span>
            </button>
          </div>
          {saveError && <p id="save-error" role="alert" className={styles.error}>{saveError}</p>}
        </form>
        {generatedCode && <div className={styles.generated}>
          <div role="status"><p className={styles.successLabel}><Check size={16} aria-hidden="true" />Kode berhasil dibuat</p><strong className={styles.generatedCode}>{generatedCode}</strong></div>
          <button type="button" className={styles.secondaryButton} onClick={copyCode}><Copy size={18} aria-hidden="true" /><span>Salin</span></button>
        </div>}
        <p role="status" className={styles.feedback}>{copyMessage}</p>
      </div>
    </section>
    <section className={styles.receive} aria-labelledby="receive-title">
      <div className={styles.sectionHeading}><span className={styles.index}>02</span><h2 id="receive-title">Ambil Paste</h2><ClipboardText size={20} aria-hidden="true" /></div>
      <div className={styles.sectionBody}>
        <p className={styles.description}>Masukkan kode untuk melihat teks yang dibagikan.</p>
        <form onSubmit={event => { event.preventDefault(); void handleFetchCode() }} aria-busy={loadingFetch}>
          <div className={styles.labelRow}><label htmlFor="paste-code">Kode akses</label><span id="code-hint">5 karakter</span></div>
          <div className={styles.codeRow}>
            <input id="paste-code" className={styles.codeInput} type="text" placeholder="Kode" value={codeInput} onChange={event => setCodeInput(event.target.value.toUpperCase())} maxLength={5} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-invalid={Boolean(errorMsg)} aria-describedby={errorMsg ? 'code-hint fetch-error' : 'code-hint'} />
            <button type="submit" className={styles.primaryButton} disabled={loadingFetch || !codeInput.trim()}>
              {loadingFetch && <SpinnerGap className={styles.spinner} size={18} aria-hidden="true" />}<span>{loadingFetch ? 'Mencari...' : 'Ambil'}</span>
            </button>
          </div>
          {errorMsg && <p id="fetch-error" role="alert" className={styles.error}>{errorMsg}</p>}
        </form>
        {resultText ? <div className={styles.result}>
          <div className={styles.resultHeader}><label htmlFor="paste-result">Hasil</label><button type="button" className={styles.copyText} onClick={copyResult}><Copy size={16} aria-hidden="true" /><span>Salin teks</span></button></div>
          <p role="status" className={styles.srOnly}>Teks berhasil dibuka.</p>
          <textarea id="paste-result" className={styles.resultEditor} readOnly value={resultText} rows={7} />
        </div> : <div className={styles.empty} role="status">
          {loadingFetch ? <SpinnerGap className={styles.spinner} size={32} aria-hidden="true" /> : <ClipboardText size={36} weight="light" aria-hidden="true" />}
          <p>{loadingFetch ? 'Sedang mencari teks...' : 'Teks akan muncul di sini.'}</p>
          <span>{loadingFetch ? 'Membuka kode yang Anda masukkan.' : 'Sudah punya kode? Masukkan di atas.'}</span>
        </div>}
        <p role="status" className={styles.feedback}>{resultCopyMessage}</p>
      </div>
    </section>
  </div>
}
