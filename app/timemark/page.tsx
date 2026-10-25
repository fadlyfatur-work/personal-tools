import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import Editor from './editor'

export const metadata: Metadata = { title: 'Timemark - Personal Tools', description: 'Tambahkan waktu, lokasi, logo, dan kode pada foto.' }
const outfit = Outfit({ subsets: ['latin'], display: 'swap' })

export default function Page() { return <div className={outfit.className}><Editor /></div> }
