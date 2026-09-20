import { NextRequest, NextResponse } from 'next/server'
import { getFintrackReport } from '@/lib/fintrackReport'
import { requireFintrackIdentity } from '@/lib/fintrackUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { currentReportMonth } from '@/lib/fintrackReport'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireFintrackIdentity()
  if (!auth.identity) return auth.response
  const requestedMonth = request.nextUrl.searchParams.get('month')
  const includeTrendDetails = request.nextUrl.searchParams.get('details') !== '0'
  const profile = requestedMonth ? null : await supabaseAdmin.from('fintrack_users').select('month_cutoff_day').eq('id', auth.identity.id).single()
  const month = requestedMonth || currentReportMonth(Number(profile?.data?.month_cutoff_day || 1))
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Periode laporan tidak valid' }, { status: 400 })
  try {
    const report = await getFintrackReport(auth.identity.id, month)
    const data = includeTrendDetails ? report : { ...report, daily: [], trend_detail_loaded: false }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Laporan gagal dimuat' }, { status: 500 })
  }
}
