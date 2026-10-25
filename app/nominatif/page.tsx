import type { Metadata } from 'next'
import NominatifForm from './nominatif-form'
import { Outfit } from 'next/font/google'

const outfit = Outfit({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = { title: 'Nominatif - Rincian perjalanan dinas', description: 'Hitung biaya perjalanan dinas dalam negeri berdasarkan aturan pilihan dan ekspor rincian ke Excel.' }

export default function Page() { return <div className={outfit.className}><NominatifForm /></div> }
