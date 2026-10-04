'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './timemark.module.css'

export default function Camera({ onCapture, onClose }: { onCapture: (file: File) => Promise<void>; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [ready, setReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false
    let stream: MediaStream | undefined
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera memerlukan HTTPS atau localhost. Kamu juga bisa mengunggah foto.')
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
        if (disposed) { stream.getTracks().forEach(track => track.stop()); return }
        if (video.current) { video.current.srcObject = stream; await video.current.play() }
      } catch (cause) {
        stream?.getTracks().forEach(track => track.stop())
        if (disposed) return
        const name = cause instanceof DOMException ? cause.name : ''
        setError(name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser atau unggah foto.' : name === 'NotFoundError' ? 'Kamera tidak ditemukan. Gunakan unggah foto.' : name === 'NotReadableError' ? 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan buka kamera kembali.' : cause instanceof Error ? cause.message : 'Kamera tidak dapat dibuka.')
      }
    }
    void start()
    return () => { disposed = true; stream?.getTracks().forEach(track => track.stop()) }
  }, [facing])

  async function capture() {
    if (!video.current?.videoWidth || capturing) return
    setCapturing(true)
    try {
      const frame = document.createElement('canvas')
      frame.width = video.current.videoWidth; frame.height = video.current.videoHeight
      frame.getContext('2d')!.drawImage(video.current, 0, 0)
      const blob = await new Promise<Blob | null>(resolve => frame.toBlob(resolve, 'image/jpeg', .95))
      if (!blob) throw new Error('Gambar gagal diambil. Silakan coba lagi.')
      await onCapture(new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    } catch { setError('Gambar gagal diambil. Silakan coba lagi.') }
    finally { setCapturing(false) }
  }

  return <div className={styles.camera}>
    <div className={styles.cameraView}>
      <video ref={video} autoPlay muted playsInline aria-label="Pratinjau kamera" onCanPlay={() => setReady(true)} />
      {!ready && !error && <p role="status">Menunggu izin dan menyiapkan kamera…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
    <div className={styles.cameraActions}>
      <button onClick={onClose} disabled={capturing}>Tutup kamera</button>
      <button disabled={!ready || capturing} onClick={() => { setReady(false); setError(''); setFacing(current => current === 'user' ? 'environment' : 'user') }}>Balik kamera</button>
      <button className={styles.primary} disabled={!ready || capturing || !!error} onClick={() => void capture()}>{capturing ? 'Mengambil…' : 'Ambil foto'}</button>
    </div>
  </div>
}
