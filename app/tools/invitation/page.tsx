'use client'
import {useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {toolsRequest,useTools} from '@/lib/tools/client'
import {ToolsShell} from '../components/tools-shell'
import styles from '../tools.module.css'
export default function Invitation(){
  const tools=useTools(),router=useRouter();const[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  async function accept(){setBusy(true);try{const token=new URLSearchParams(window.location.search).get('token');const data=await toolsRequest<{workspaceId:string}>('/api/tools/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});tools.setWorkspaceId(data.workspaceId);router.replace(`/office/tasks?workspace=${data.workspaceId}`)}catch(error){setMessage(error instanceof Error?error.message:'Undangan belum dapat diterima.')}finally{setBusy(false)}}
  return <ToolsShell title="Undangan ruang kerja" tools={tools}><section className={styles.panel}><p>Pastikan Anda masuk dengan email penerima undangan. Menerima undangan tidak memindahkan pekerjaan pribadi Anda.</p>{message&&<p role="alert" className={styles.error}>{message}</p>}<div className={styles.actions}><button className={styles.button} disabled={busy} onClick={accept}>{busy?'Memproses…':'Terima undangan'}</button><Link href="/menu" className={styles.secondary}>Kembali</Link></div></section></ToolsShell>
}
