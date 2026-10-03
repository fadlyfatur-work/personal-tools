'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function PastePage() {
  const [description, setDescription] = useState<string>('')
  const [generatedCode, setGeneratedCode] = useState<string>('')
  const [loadingPaste, setLoadingPaste] = useState<boolean>(false)

  const [codeInput, setCodeInput] = useState<string>('')
  const [resultText, setResultText] = useState<string>('')
  const [loadingFetch, setLoadingFetch] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [saveError, setSaveError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')

  async function copyCode() {
    setCopyMessage('')
    try { await navigator.clipboard.writeText(generatedCode); setCopyMessage('Kode tersalin.') }
    catch { setCopyMessage('Belum bisa menyalin otomatis. Pilih kode di atas dan salin secara manual.') }
  }

  async function handlePaste() {
    if (!description.trim()) return

    setLoadingPaste(true)
    setGeneratedCode('')
    setSaveError('')
    setCopyMessage('')

    try {
      const res = await fetch('/api/paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: description,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.code) throw new Error('save failed')

      if (data.code) {
        setGeneratedCode(data.code)
        setDescription('')
      }
    } catch {
      setSaveError('Teks belum berhasil disimpan. Isi teks tetap tersedia; coba buat kode lagi.')
    } finally {
      setLoadingPaste(false)
    }
  }

  async function handleFetchCode() {
    if (!codeInput.trim()) return

    setLoadingFetch(true)
    setErrorMsg('')
    setResultText('')

    try {
      const res = await fetch(`/api/paste/${codeInput.trim()}`)
      const data = await res.json()

      if (data.content) {
        setResultText(data.content)
      } else {
        setErrorMsg(data.error || 'Kode tidak ditemukan')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Terjadi kesalahan, coba lagi')
    } finally {
      setLoadingFetch(false)
    }
  }

  const inputStyle = {
    width: '100%',
    border: '1px solid #dadce0',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    background: '#fff',
    boxSizing: 'border-box' as const,
  }

  const primaryButtonStyle = {
    border: 'none',
    borderRadius: 20,
    padding: '9px 20px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    background: '#1a73e8',
    color: '#fff',
    fontFamily: 'inherit',
  }

  return (
    <main
      className="[&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-4 [&_:focus-visible]:outline-[#174ea6]"
      style={{
        minHeight: '100vh',
        background: '#f8f9fa',
        padding: '32px 16px',
        fontFamily:
          'Google Sans, Roboto, Arial, sans-serif',
        color: '#202124',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
        }}
      >
        <Link
          href="/menu"
          style={{
            fontSize: 13,
            color: '#1a73e8',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: 16,
          }}
        >
          ← Kembali
        </Link>

        {/* Header */}
        <header
          style={{
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              fontSize: 24,
              fontWeight: 500,
              margin: 0,
              letterSpacing: '-0.3px',
            }}
          >
            Paste Text
          </h1>

          <p
            style={{
              fontSize: 14,
              color: '#5f6368',
              margin: '6px 0 0',
            }}
          >
            Bagikan teks dengan kode singkat.
          </p>
        </header>

        {/* Main Card */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #dadce0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Create Paste */}
          <section
            style={{
              padding: 24,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                Buat Paste
              </h2>

              <p
                style={{
                  fontSize: 13,
                  color: '#5f6368',
                  margin: '4px 0 0',
                }}
              >
                Masukkan teks untuk mendapatkan kode akses.
              </p>
            </div>

            <label htmlFor="paste-text" style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Teks yang dibagikan</label>
            <textarea
              id="paste-text"
              placeholder="Tulis atau paste teks di sini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <button
                onClick={handlePaste}
                disabled={loadingPaste || !description.trim()}
                style={{
                  ...primaryButtonStyle,
                  opacity:
                    loadingPaste || !description.trim() ? 0.6 : 1,
                  cursor:
                    loadingPaste || !description.trim()
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {loadingPaste ? 'Menyimpan...' : 'Buat Kode'}
              </button>
            </div>

            {saveError && <p role="alert" style={{ color: '#b3261e', marginTop: 12, fontSize: 14 }}>{saveError}</p>}
            {generatedCode && (
              <div
                style={{
                  marginTop: 16,
                  padding: '14px 16px',
                  background: '#f1f8e9',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#5f6368',
                      marginBottom: 3,
                    }}
                  >
                    Kode berhasil dibuat
                  </div>

                  <strong
                    style={{
                      fontSize: 22,
                      letterSpacing: 2,
                      fontWeight: 500,
                    }}
                  >
                    {generatedCode}
                  </strong>
                </div>

                <button
                  onClick={copyCode}
                  style={{
                    border: '1px solid #dadce0',
                    background: '#fff',
                    borderRadius: 18,
                    padding: '7px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                    color: '#1a73e8',
                  }}
                >
                  Salin
                </button>
              </div>
            )}
            <p role="status" style={{ fontSize: 14, marginTop: 12 }}>{copyMessage}</p>
          </section>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: '#e8eaed',
            }}
          />

          {/* Get Paste */}
          <section
            style={{
              padding: 24,
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                Ambil Paste
              </h2>

              <p
                style={{
                  fontSize: 13,
                  color: '#5f6368',
                  margin: '4px 0 0',
                }}
              >
                Masukkan kode untuk melihat teks yang dibagikan.
              </p>
            </div>

            <label htmlFor="paste-code" style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>Kode akses</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="paste-code"
                type="text"
                placeholder="Kode"
                value={codeInput}
                onChange={(e) =>
                  setCodeInput(e.target.value.toUpperCase())
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFetchCode()
                  }
                }}
                maxLength={5}
                style={{
                  ...inputStyle,
                  flex: 1,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              />

              <button
                onClick={handleFetchCode}
                disabled={loadingFetch || !codeInput.trim()}
                style={{
                  ...primaryButtonStyle,
                  whiteSpace: 'nowrap',
                  opacity:
                    loadingFetch || !codeInput.trim() ? 0.6 : 1,
                  cursor:
                    loadingFetch || !codeInput.trim()
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {loadingFetch ? 'Mencari...' : 'Ambil'}
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: '#d93025',
                }}
              >
                {errorMsg}
              </div>
            )}

            {resultText && (
              <div
                style={{
                  marginTop: 16,
                }}
              >
                <label htmlFor="paste-result"
                  style={{
                    fontSize: 12,
                    color: '#5f6368',
                    marginBottom: 6,
                    display: 'block',
                  }}
                >
                  Hasil
                </label>

                <textarea
                  id="paste-result"
                  readOnly
                  value={resultText}
                  rows={6}
                  style={{
                    ...inputStyle,
                    background: '#f8f9fa',
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                />
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
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
