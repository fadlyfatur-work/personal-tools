'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {useState,useSyncExternalStore,type ReactNode} from 'react'
import {SuiteFrame} from './suite-frame'
import { toolsRequest, type useTools } from '@/lib/tools/client'
import {safeToolsReturn}from '@/lib/tools/policy'
import styles from '../tools.module.css'
function subscribeLocation(listener:()=>void){window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener)}

export function ToolsShell({ title, description, children, section, tools }: { title: string; description?: string; children: ReactNode; section?: 'office' | 'deployments' | 'monitoring' | 'documents'; tools?: ReturnType<typeof useTools> }) {
  const pathname = usePathname()
  const router = useRouter()
  const [leaving,setLeaving]=useState(false),[logoutError,setLogoutError]=useState('')
  const returnTo=useSyncExternalStore(subscribeLocation,()=>safeToolsReturn(`${window.location.pathname}${window.location.search}`),()=>safeToolsReturn(pathname))
  async function logout() {
    setLeaving(true);setLogoutError('')
    try { await toolsRequest('/api/tools/auth/logout', { method: 'POST' }); router.replace(`/tools/login?next=${encodeURIComponent(returnTo)}`);router.refresh() }
    catch (error) { setLogoutError(error instanceof Error ? error.message : 'Belum dapat keluar. Coba kembali.') }
    finally {setLeaving(false)}
  }
  return <SuiteFrame title={title} description={description} section={section} hasAccount={Boolean(tools?.context)} isTemplateAdmin={tools?.context?.isTemplateAdmin} isSuiteAdmin={tools?.context?.isSuiteAdmin}
    accountControl={tools?.context&&<><span className={styles.accountName}>{tools.context.name}</span><button className={styles.secondary} disabled={leaving} aria-busy={leaving} onClick={logout}>{leaving?'Keluar…':'Keluar akun'}</button></>}
    workspaceControl={tools?.context&&<label className={styles.workspaceSelect}>Ruang kerja<select aria-label="Ruang kerja aktif" className={styles.input} value={tools.workspaceId} onChange={event=>tools.setWorkspaceId(event.target.value)}>{tools.context.workspaces.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}>
    {logoutError&&<p className={styles.error} role="alert">{logoutError}</p>}
    {tools?.loading&&tools.context&&<p role="status" className={styles.muted}>Memeriksa sesi…</p>}
    {tools?.loading&&!tools.context ? <p role="status">Memuat ruang kerja…</p> : tools && !tools.context ? <section className={styles.panel}><p className={styles.error} role="alert">{tools.error || 'Silakan masuk untuk melanjutkan.'}</p><div className={styles.actions}><Link className={styles.button} href={`/tools/login?next=${encodeURIComponent(returnTo)}`}>Masuk akun</Link><button className={styles.secondary} onClick={tools.reload}>Coba lagi</button><button className={styles.secondary} onClick={()=>tools.setWorkspaceId('')}>Gunakan ruang pribadi</button></div></section> : children}
  </SuiteFrame>
}
