'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toolsRequest } from '@/lib/tools/client'
import { safeToolsReturn } from '@/lib/tools/policy'
import { ToolsShell } from './tools-shell'
import styles from '../tools.module.css'

export function AuthForm({mode,next,callbackError=false}:{mode:'login'|'register'|'reset'|'update-password';next?:string;callbackError?:boolean}) {
  const destination=safeToolsReturn(next)
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(callbackError?'Tautan akun tidak berlaku atau sudah kedaluwarsa. Coba masuk atau minta tautan pemulihan baru.':''),[message,setMessage]=useState('')
  const title={login:'Masuk ke Personal Tools',register:'Buat akun Personal Tools',reset:'Pulihkan kata sandi','update-password':'Buat kata sandi baru'}[mode]
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setMessage('')
    try {
      const result=await toolsRequest<{next?:string;message?:string;authenticated?:boolean}>(`/api/tools/auth/${mode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,next:destination})})
      if(mode==='login'||result.authenticated) window.location.assign(result.next||destination)
      else {setMessage(result.message||'Permintaan berhasil diproses.');setPassword('')}
    }catch(err){setError(err instanceof Error?err.message:'Permintaan belum dapat diproses.')}finally{setBusy(false)}
  }
  return <ToolsShell title={title} description="Satu akun untuk Office Workspace, pengelolaan template, Change Tracker, dan Health Dashboard. FinTrack memakai login sendiri."><section className={styles.panel} style={{maxWidth:520}}>
    {error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.notice} role="status">{message}</p>}
    <form onSubmit={submit}>
      {mode!=='update-password'&&<label className={styles.field}>Email<input className={styles.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="username" required/></label>}
      {mode!=='reset'&&<label className={styles.field}>Kata sandi<input className={styles.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} required/><span className={styles.muted}>Minimal 8 karakter.</span></label>}
      <button className={styles.button} disabled={busy}>{busy?'Memproses…':mode==='login'?'Masuk':mode==='register'?'Daftar':mode==='reset'?'Kirim tautan pemulihan':'Simpan kata sandi'}</button>
    </form>
    <nav className={styles.nav} aria-label="Pilihan akun"><Link href={`/tools/login?next=${encodeURIComponent(destination)}`}>Masuk</Link><Link href={`/tools/register?next=${encodeURIComponent(destination)}`}>Daftar akun</Link><Link href={`/tools/forgot-password?next=${encodeURIComponent(destination)}`}>Lupa kata sandi</Link>{mode==='update-password'&&<Link href={destination}>Buka ruang kerja</Link>}</nav>
    <p className={styles.muted}>Untuk memakai template tanpa akun, <Link href="/documents">masukkan PIN instansi di Documents</Link>.</p>
  </section></ToolsShell>
}
