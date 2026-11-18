import {timingSafeEqual} from 'node:crypto'
import {cookies} from 'next/headers'
import {z} from 'zod'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {ToolsError,readToolsJson,toolsJson} from '@/lib/tools/server'
import {sharedRateLimit,trustedSource} from '@/lib/tools/limits'
import {REPORT_COOKIE,REPORT_SESSION_SECONDS,createReportSession,readReportSession,type ReportRole} from './session'
import {prepareDocument,provinceSummary,summarize,validReportDate,today,type ReportSnapshot,type ReportDocument} from './model'
import {createSeed} from './seed'

function secret(){const value=process.env.REPORT_SESSION_SECRET||'';if(value.length<32)throw new ToolsError(503,'Laporan belum siap digunakan. Hubungi admin.','REPORT_SETUP_REQUIRED');return value}
function dbError(error:{message?:string}|null) {
  if(!error)return
  const message=error.message||''
  if(message.includes('REPORT_CONFLICT'))throw new ToolsError(409,'Laporan diperbarui dari sesi lain. Muat ulang sebelum menyimpan perubahan.','REPORT_CONFLICT')
  if(message.includes('REPORT_ACCESS_DENIED'))throw new ToolsError(401,'Sesi laporan sudah berubah. Masukkan PIN kembali.','REPORT_AUTH_REQUIRED')
  if(message.includes('REPORT_PIN_INVALID'))throw new ToolsError(400,'PIN harus berbeda dan terdiri dari 6–12 angka.','REPORT_PIN_INVALID')
  throw new ToolsError(503,'Laporan belum dapat dimuat. Periksa aktivasi database laporan atau coba kembali.','REPORT_SETUP_REQUIRED')
}
async function setSession(role:ReportRole,version:number) {
  const token=await createReportSession(role,version,secret())
  ;(await cookies()).set(REPORT_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:REPORT_SESSION_SECONDS})
}
export async function getReportIdentity(admin=false) {
  const token=(await cookies()).get(REPORT_COOKIE)?.value
  if(!token)throw new ToolsError(401,'Masukkan PIN untuk membuka laporan.','REPORT_AUTH_REQUIRED')
  const session=await readReportSession(token,secret())
  if(!session)throw new ToolsError(401,'Sesi Anda berakhir. Masukkan PIN lagi.','REPORT_AUTH_REQUIRED')
  const {data,error}=await supabaseAdmin.from('report_access').select('role,version').eq('role',session.role).maybeSingle()
  dbError(error)
  if(!data||data.version!==session.version)throw new ToolsError(401,'Akses berubah. Masukkan PIN kembali.','REPORT_AUTH_REQUIRED')
  if(admin&&session.role!=='admin')throw new ToolsError(403,'Hanya admin laporan yang dapat mengatur PIN.','REPORT_ADMIN_REQUIRED')
  return session
}
export async function loginReport(request:Request) {
  secret()
  const parsed=z.object({pin:z.string().regex(/^\d{6,12}$/)}).strict().safeParse(await readToolsJson(request))
  if(!parsed.success)throw new ToolsError(400,'PIN harus terdiri dari 6–12 angka.')
  const checks=await Promise.all([sharedRateLimit('report:pin:global',200,900),sharedRateLimit(`report:pin:source:${trustedSource(request)}`,30,900)])
  const denied=checks.find(check=>!check.allowed)
  if(denied)throw new ToolsError(429,'Terlalu banyak percobaan. Tunggu lagi beberapa saat lagi.','RATE_LIMITED',denied.retry_after)
  const {data,error}=await supabaseAdmin.from('report_access').select('role,pin,version').limit(2)
  dbError(error)
  if(data?.length!==2)throw new ToolsError(503,'Admin belum menyiapkan kedua PIN laporan.','REPORT_SETUP_REQUIRED')
  const supplied=Buffer.alloc(12);supplied.write(parsed.data.pin)
  const found=data.find(row=>{const expected=Buffer.alloc(12);expected.write(row.pin);return timingSafeEqual(supplied,expected)})
  if(!found)throw new ToolsError(401,'PIN salah. Coba lagi.','REPORT_PIN_INVALID')
  await setSession(found.role,found.version)
  return toolsJson({role:found.role})
}
export async function logoutReport(){(await cookies()).delete(REPORT_COOKIE);return toolsJson({loggedOut:true})}
export async function getAccess(_request:Request) {
  void _request
  await getReportIdentity(true)
  const {data,error}=await supabaseAdmin.from('report_access').select('role,version,updated_at').order('role')
  dbError(error)
  return toolsJson({roles:(data||[]).map(({role,version,updated_at})=>({role,version,updated_at}))})
}
export async function updateAccess(request:Request) {
  const actor=await getReportIdentity(true)
  const parsed=z.object({adminPin:z.string().regex(/^\d{6,12}$/).optional(),userPin:z.string().regex(/^\d{6,12}$/).optional()}).strict().refine(value=>value.adminPin||value.userPin).safeParse(await readToolsJson(request))
  if(!parsed.success)throw new ToolsError(400,'Isi PIN baru dengan 6-12 digit angka.')
  const {data,error}=await supabaseAdmin.rpc('report_set_pins',{p_access_version:actor.version,p_admin_pin:parsed.data.adminPin||null,p_user_pin:parsed.data.userPin||null})
  dbError(error)
  await setSession('admin',data.admin_version)
  return toolsJson({updated:true})
}
export function reportMetrics(document:ReportDocument) {
  return {all:summarize(document),provinces:document.provinces.map(p=>({id:p.id,total:p.totalPackages,integrated:p.integratedPackages,percent:provinceSummary(p).percent,accounts:Object.values(p.accounts).filter(a=>a.status==='ada').length}))}
}
export async function readReport(request:Request) {
  const actor=await getReportIdentity(),url=new URL(request.url)
  const from=url.searchParams.get('from')||'2026-11-10',to=url.searchParams.get('to')||today()
  const requestedDate=url.searchParams.get('snapshot')
  if(!validReportDate(from)||!validReportDate(to)||from>to)throw new ToolsError(400,'Rentang grafik laporan tidak valid.')
  if(requestedDate&&!validReportDate(requestedDate))throw new ToolsError(400,'Tanggal rekap tidak valid.')
  const [snapshotResult,historyResult,recapResult]=await Promise.all([
    requestedDate?supabaseAdmin.from('report_daily').select('date,revision,document,created_at,updated_at').eq('date',requestedDate).maybeSingle():supabaseAdmin.from('report_daily').select('date,revision,document,created_at,updated_at').order('date',{ascending:false}).limit(1).maybeSingle(),
    supabaseAdmin.from('report_daily').select('date,summary').gte('date',from).lte('date',to).order('date',{ascending:true}).limit(2000),
    supabaseAdmin.from('report_changes').select('id').eq('report_date',today()).eq('source','recap').limit(1).maybeSingle(),
  ])
  dbError(snapshotResult.error);dbError(historyResult.error);dbError(recapResult.error)
  if(requestedDate&&!snapshotResult.data)throw new ToolsError(404,'Rekap tanggal tersebut tidak ditemukan.','REPORT_RECAP_NOT_FOUND')
  const previousResult=snapshotResult.data?await supabaseAdmin.from('report_daily').select('date,revision,document,created_at,updated_at').lt('date',snapshotResult.data.date).order('date',{ascending:false}).limit(1).maybeSingle():{data:null,error:null}
  dbError(previousResult.error)
  const changesResult=actor.role==='admin'&&snapshotResult.data?await supabaseAdmin.from('report_changes').select('id,report_date,revision,created_at,actor_role,source,reason,changed_provinces').eq('report_date',snapshotResult.data.date).order('revision',{ascending:false}).limit(50):{data:[],error:null}
  dbError(changesResult.error)
  return toolsJson({role:actor.role,snapshot:snapshotResult.data,previous:previousResult.data,initial:snapshotResult.data?null:createSeed(),history:historyResult.data,changes:changesResult.data,recapSavedForToday:Boolean(recapResult.data)})
}
export async function saveReport(request:Request) {
  const actor=await getReportIdentity()
  const parsed=z.object({date:z.string(),revision:z.number().int().nonnegative(),document:z.unknown(),source:z.enum(['manual','import','recap']),reason:z.string().trim().max(500).optional().default('')}).strict().safeParse(await readToolsJson(request,2*1024*1024))
  if(!parsed.success||!validReportDate(parsed.data.date))throw new ToolsError(400,'Tanggal atau isian laporan tidak valid.')
  const body=parsed.data
  const {data:current,error}=await supabaseAdmin.from('report_daily').select('date,revision,document,created_at,updated_at').eq('date',body.date).maybeSingle()
  dbError(error)
  if((current?.revision||0)!==body.revision)throw new ToolsError(409,'Laporan diperbarui dari sesi lain. Muat ulang sebelum menyimpan perubahan.','REPORT_CONFLICT')
  let baseline=current as ReportSnapshot|null
  if(!baseline){const {data,error:priorError}=await supabaseAdmin.from('report_daily').select('date,revision,document,created_at,updated_at').lt('date',body.date).order('date',{ascending:false}).limit(1).maybeSingle();dbError(priorError);baseline=data}
  let document:ReportDocument
  const before=baseline?.document||createSeed()
  try{document=prepareDocument(body.document,before,new Date().toISOString(),body.date)}catch(error){throw new ToolsError(400,error instanceof Error?error.message:'Isian laporan tidak valid.')}
  const changed=document.provinces.filter(p=>JSON.stringify(p)!==JSON.stringify(before.provinces.find(row=>row.id===p.id))).map(p=>p.id)
  const {data,error:saveError}=await supabaseAdmin.rpc('report_save_daily',{p_date:body.date,p_revision:body.revision,p_document:document,p_summary:reportMetrics(document),p_actor_role:actor.role,p_access_version:actor.version,p_source:body.source,p_reason:body.reason,p_changed:changed})
  dbError(saveError)
  return toolsJson(data)
}
