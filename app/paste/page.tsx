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

  async function handlePaste() {
    if (!description.trim()) return

    setLoadingPaste(true)
    setGeneratedCode('')

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

      if (data.code) {
        setGeneratedCode(data.code)
        setDescription('')
      }
    } catch (err) {
      console.error(err)
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
    outline: 'none',
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
          href="/"
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

            <textarea
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
                  onClick={() =>
                    navigator.clipboard.writeText(generatedCode)
                  }
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

            <div
              style={{
                display: 'flex',
                gap: 8,
              }}
            >
              <input
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
                <div
                  style={{
                    fontSize: 12,
                    color: '#5f6368',
                    marginBottom: 6,
                  }}
                >
                  Hasil
                </div>

                <textarea
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
