'use client'
import {useSyncExternalStore,type ReactNode} from 'react'
import {Desktop, Moon, Sun} from '@phosphor-icons/react'
import styles from '../suite-theme.module.css'

type Theme='system'|'light'|'dark'
let volatileTheme:Theme='light'
function readTheme():Theme{
 try{const saved=window.localStorage.getItem('tools:theme');return saved==='light'||saved==='dark'||saved==='system'?saved:volatileTheme}catch{return volatileTheme}
}
function subscribe(listener:()=>void){window.addEventListener('tools:theme',listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener('tools:theme',listener);window.removeEventListener('storage',listener)}}
function useTheme(){return useSyncExternalStore(subscribe,readTheme,()=> 'light' as Theme)}
function setTheme(value:string){
 if(!['light','dark','system'].includes(value))return
 volatileTheme=value as Theme
 try{window.localStorage.setItem('tools:theme',value)}catch{}
 window.dispatchEvent(new Event('tools:theme'))
}
export function SuiteSurface({children,className=''}:{children:ReactNode;className?:string}){
 const theme=useTheme()
 return <div className={`${styles.scope} ${className}`} data-theme={theme}>{children}</div>
}
export function ThemePicker(){
 const theme=useTheme()
 const themes:Theme[]=['light','dark','system'],next=themes[(themes.indexOf(theme)+1)%themes.length]
 const label=theme==='light'?'Terang':theme==='dark'?'Gelap':'Sistem'
 return <button type="button" className={styles.themeButton} aria-label={`Tema ${label}. Ubah ke ${next==='light'?'terang':next==='dark'?'gelap':'sistem'}`} title={`Tema ${label}`} onClick={()=>setTheme(next)}>{theme==='light'?<Sun size={19}/>:theme==='dark'?<Moon size={19}/>:<Desktop size={19}/>}</button>
}
