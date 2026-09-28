import type { Metadata } from 'next'
import NominatifForm from './nominatif-form'

export const metadata: Metadata = { title: 'Nominatif — Rincian perjalanan dinas', description: 'Hitung biaya perjalanan dinas dalam negeri berdasarkan aturan pilihan dan ekspor rincian ke Excel.' }

export default function Page() { return <NominatifForm /> }
