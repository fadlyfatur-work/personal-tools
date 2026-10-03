import type { Metadata } from 'next'
import Editor from './editor'

export const metadata: Metadata = { title: 'Timemark — Personal Tools', description: 'Tambahkan waktu, lokasi, logo, dan kode pada foto.' }

export default function Page() { return <Editor /> }
