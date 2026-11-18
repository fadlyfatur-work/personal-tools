import type {Metadata} from 'next'
import ReportClient from './report-client'

export const metadata:Metadata={title:'Laporan ASB Provinsi | Personal Tools',description:'Pantau akun, proses paket, dan integrasi ASB provinsi dari hari ke hari.',robots:{index:false,follow:false}}
export default function ReportPage(){return <ReportClient/>}
