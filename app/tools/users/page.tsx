'use client'
import {useEffect,useState,type FormEvent} from 'react'
import {ToolsShell} from '../components/tools-shell'
import {toolsRequest,useTools} from '@/lib/tools/client'
import s from '../tools.module.css'

type SuiteUser={user_id:string;name:string;email:string;is_suite_admin:boolean;is_template_admin:boolean;is_active:boolean;revision:number}
export default function UsersPage(){
 const tools=useTools()
 return <ToolsShell title="Pengguna" description="Kelola akun dan hak akses Personal Tools." tools={tools}>{tools.context?.isSuiteAdmin?<UserManager key={tools.context.userId} actor={tools.context.userId}/>:<p className={s.error} role="alert">Halaman ini hanya untuk admin aplikasi.</p>}</ToolsShell>
}
function UserManager({actor}:{actor:string}){
 const[rows,setRows]=useState<SuiteUser[]>([]),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[selected,setSelected]=useState<SuiteUser|null>(null)
 const[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 useEffect(()=>{
  const controller=new AbortController()
  toolsRequest<SuiteUser[]>(`/api/tools/users?offset=${offset}&q=${encodeURIComponent(query)}`,{signal:controller.signal}).then(data=>{if(!controller.signal.aborted)setRows(data)}).catch(err=>{if(!controller.signal.aborted){setRows([]);setError(err.message)}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[query,offset,attempt])
 function reload(){setLoading(true);setError('');setAttempt(value=>value+1)}
 async function create(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setNotice('')
  try{await toolsRequest('/api/tools/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});setName('');setEmail('');setPassword('');reload();setNotice('Akun pengguna dibuat. Akun dapat langsung masuk dengan email dan kata sandi.')}
  catch(err){setError((err as Error).message)}finally{setBusy(false)}
 }
 async function update(event:FormEvent){
  event.preventDefault();if(!selected)return
  if((!selected.is_active||selected.is_suite_admin)&&!window.confirm(`Simpan hak akses untuk ${selected.email}?`))return
  setBusy(true);setError('');setNotice('')
  try{await toolsRequest('/api/tools/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:selected.user_id,revision:selected.revision,name:selected.name,is_suite_admin:selected.is_suite_admin,is_template_admin:selected.is_template_admin,is_active:selected.is_active})});setSelected(null);reload();setNotice('Data dan hak akses pengguna disimpan.')}
  catch(err){setError((err as Error).message)}finally{setBusy(false)}
 }
 return <>
  {error&&<p className={s.error} role="alert">{error}</p>}{notice&&<p className={s.notice} role="status">{notice}</p>}
  <div className={s.adminLayout}>
   <section className={s.panel} aria-labelledby="users-title"><div className={s.sectionHeading}><h2 id="users-title">Akun terdaftar</h2><button className={s.secondary} disabled={loading||busy} onClick={()=>{setSelected(null);reload()}}>Muat ulang</button></div>
    <label className={s.field}>Cari email<input type="search" className={s.input} value={query} onChange={event=>{setQuery(event.target.value);setOffset(0);setSelected(null);setLoading(true);setError('')}}/></label>
    {loading?<p role="status">Memuat pengguna…</p>:rows.length?<ul className={s.list}>{rows.map(user=><li key={user.user_id} className={s.userRow}><div><strong>{user.name}</strong><p className={s.muted}>{user.email}</p><p className={s.muted}>{user.is_suite_admin?'Admin aplikasi':'Pengguna'} · {user.is_template_admin?'Admin template':'Akses template dengan PIN'} · {user.is_active?'Aktif':'Nonaktif'}</p></div><button disabled={busy} className={s.secondary} onClick={()=>{setSelected({...user});setError('');setNotice('')}} aria-label={`Kelola ${user.email}`}>Kelola</button></li>)}</ul>:<p className={s.empty}>{query?'Tidak ada pengguna dengan email tersebut.':'Belum ada profil pengguna. Akun baru muncul setelah disiapkan atau masuk.'}</p>}
    <div className={s.actions}><button className={s.secondary} disabled={!offset||loading||busy} onClick={()=>{setOffset(value=>Math.max(0,value-50));setSelected(null);setLoading(true)}}>Sebelumnya</button><span className={s.muted}>Halaman {Math.floor(offset/50)+1}</span><button className={s.secondary} disabled={rows.length<50||offset>=10000||loading||busy} onClick={()=>{setOffset(value=>value+50);setSelected(null);setLoading(true)}}>Berikutnya</button></div>
   </section>
   <div>
    {selected?<section className={s.panel}><h2>Kelola pengguna</h2><p className={s.muted}>{selected.email}</p><form onSubmit={update}><fieldset disabled={busy} className={s.fieldset}>
     <label className={s.field}>Nama<input className={s.input} required maxLength={100} value={selected.name} onChange={event=>setSelected({...selected,name:event.target.value})}/></label>
     <label className={s.check}><input type="checkbox" disabled={selected.user_id===actor} checked={selected.is_suite_admin} onChange={event=>setSelected({...selected,is_suite_admin:event.target.checked})}/>Admin aplikasi</label><p className={s.muted}>Dapat mengelola pengguna. Hak ini tidak membuka data pribadi pengguna lain.</p>
     <label className={s.check}><input type="checkbox" checked={selected.is_template_admin} onChange={event=>setSelected({...selected,is_template_admin:event.target.checked})}/>Admin template Documents</label>
     <label className={s.check}><input type="checkbox" disabled={selected.user_id===actor} checked={selected.is_active} onChange={event=>setSelected({...selected,is_active:event.target.checked})}/>Akses aplikasi aktif</label>
     <p className={s.muted}>Menonaktifkan akses hanya berlaku untuk suite ini. FinTrack tetap memakai login tersendiri.</p>
     <div className={s.actions}><button className={s.button}>{busy?'Menyimpan…':'Simpan pengguna'}</button><button type="button" className={s.secondary} onClick={()=>setSelected(null)}>Batal</button></div>
    </fieldset></form></section>:null}
    <details className={s.panel} open={!selected}><summary>Tambah pengguna</summary><form onSubmit={create}><fieldset disabled={busy} className={s.fieldset}>
     <label className={s.field}>Nama<input className={s.input} autoComplete="off" required maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label>
     <label className={s.field}>Email<input className={s.input} autoComplete="off" type="email" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>
     <label className={s.field}>Kata sandi awal<input className={s.input} type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event=>setPassword(event.target.value)}/></label>
     <p className={s.muted}>Akun baru memiliki akses pengguna biasa. Atur hak admin melalui Kelola setelah akun dibuat.</p><button className={s.button}>{busy?'Membuat akun…':'Buat pengguna'}</button>
    </fieldset></form></details>
   </div>
  </div>
 </>
}
