'use client'
import {useRef,useState,type ReactNode} from 'react'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {ArrowLeft,BookOpen,Briefcase,CaretRight,ChatCircleText,ClipboardText,Files,Gear,GitBranch,Heartbeat,List,Notebook,Users,X,type Icon} from '@phosphor-icons/react'
import {SuiteSurface,ThemePicker} from './suite-theme'
import shared from '../tools.module.css'
import s from '../suite-frame.module.css'

type Item={href:string;label:string;icon:Icon}
type Section='office'|'documents'|'deployments'|'monitoring'
const groups:{title:string;icon:Icon;items:Item[]}[]=[
 {title:'Office Workspace',icon:Briefcase,items:[{href:'/office/tasks',label:'Pekerjaan',icon:ClipboardText},{href:'/office/followups',label:'Tindak lanjut',icon:ChatCircleText},{href:'/office/meetings',label:'Rapat',icon:Notebook},{href:'/office/knowledge',label:'Pengetahuan',icon:BookOpen}]},
 {title:'Dokumen & layanan',icon:Files,items:[{href:'/documents',label:'Koleksi dokumen',icon:Files},{href:'/deployments',label:'Change Tracker',icon:GitBranch},{href:'/monitoring',label:'Health Dashboard',icon:Heartbeat}]},
]
function selected(path:string,href:string){return href==='/documents'?path==='/documents'||path.startsWith('/documents/')&&!path.startsWith('/documents/admin'):path===href||path.startsWith(`${href}/`)}

export function SuiteFrame({title,description,children,section,hasAccount=false,isSuiteAdmin=false,isTemplateAdmin=false,accountControl,workspaceControl}:{title:string;description?:string;children:ReactNode;section?:Section;hasAccount?:boolean;isSuiteAdmin?:boolean;isTemplateAdmin?:boolean;accountControl?:ReactNode;workspaceControl?:ReactNode}){
 const pathname=usePathname(),[menuOpen,setMenuOpen]=useState(false)
 const menuButton=useRef<HTMLButtonElement>(null)
 const management:Item[]=[]
 if(hasAccount)management.push({href:'/tools/workspaces',label:'Ruang kerja',icon:Briefcase})
 if(isTemplateAdmin)management.push({href:'/documents/admin',label:'Template & PIN',icon:Files})
 if(isSuiteAdmin)management.push({href:'/tools/users',label:'Pengguna',icon:Users})
 const navigation=management.length?[...groups,{title:'Pengelolaan',icon:Gear,items:management}]:groups
 const area=section?{office:'Office Workspace',documents:'Documents',deployments:'Change Tracker',monitoring:'Health Dashboard'}[section]:pathname.startsWith('/tools/users')||pathname.startsWith('/tools/workspaces')?'Pengelolaan':'Akun Personal Tools'
 return <SuiteSurface className={`${shared.page} ${s.root}`}>
  <a className={s.skip} href="#tools-content">Lewati ke konten</a>
  <div className={s.layout} onKeyDown={event=>{if(event.key==='Escape'&&menuOpen){setMenuOpen(false);menuButton.current?.focus()}}}>
   <div className={s.mobileBar}><Link href="/office">Office <span>Tools</span></Link><button ref={menuButton} type="button" aria-controls="suite-navigation" aria-expanded={menuOpen} onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={18} aria-hidden="true"/>:<List size={18} aria-hidden="true"/>}{menuOpen?'Tutup menu':'Menu'}</button></div>
   <aside id="suite-navigation" className={s.sidebar} data-open={menuOpen} aria-label="Navigasi Office Tools">
    <Link href="/office" className={s.brand}><Briefcase size={23} weight="duotone" aria-hidden="true"/><span>Office Tools<small>Personal Tools</small></span></Link>
    <nav className={s.navigation} aria-label="Menu aplikasi">{navigation.map(group=><section key={group.title} className={s.group}><h2><group.icon size={16} aria-hidden="true"/>{group.title}</h2><ul>{group.items.map(item=><li key={item.href}><Link href={item.href} className={s.menuLink} aria-current={selected(pathname,item.href)?'page':undefined} onClick={()=>setMenuOpen(false)}><item.icon size={17} aria-hidden="true"/><span>{item.label}</span><CaretRight size={13} aria-hidden="true"/></Link></li>)}</ul></section>)}</nav>
    <Link href="/menu" className={s.allTools}><ArrowLeft size={16} aria-hidden="true"/>Semua tools</Link>
   </aside>
   <main id="tools-content" className={s.content} tabIndex={-1}>
    <div className={s.topbar}><p className={s.area}>Office Tools<CaretRight size={13} aria-hidden="true"/><span>{area}</span></p><div className={s.controls}><ThemePicker/>{accountControl}</div></div>
    <header className={s.heading}><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{workspaceControl&&<div className={s.workspace}>{workspaceControl}</div>}</header>
    <div className={s.body}>{children}</div>
   </main>
  </div>
 </SuiteSurface>
}
