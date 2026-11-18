import {z} from 'zod'
import {supabaseAdmin} from '@/lib/supabaseAdmin'
import {getToolsContext,readToolsJson,ToolsError,toolsJson} from './server'
import {sharedRateLimit} from './limits'

const columns='user_id,name,email,is_suite_admin,is_template_admin,is_active,revision,created_at'
const createSchema=z.object({email:z.string().trim().email().max(254),password:z.string().min(8).max(128),name:z.string().trim().min(1).max(100)}).strict()
const updateSchema=z.object({user_id:z.string().uuid(),revision:z.number().int().positive(),name:z.string().trim().min(1).max(100),is_suite_admin:z.boolean(),is_template_admin:z.boolean(),is_active:z.boolean()}).strict()
function databaseError(error:{code?:string;message?:string}|null){
 if(!error)return
 const faults:Record<string,[number,string]>={TOOLS_ADMIN_REQUIRED:[403,'Hak admin tidak tersedia. Muat ulang akun.'],TOOLS_SELF_LOCKOUT:[409,'Anda tidak dapat menonaktifkan akun atau mencabut hak admin sendiri.'],TOOLS_LAST_ADMIN:[409,'Pertahankan setidaknya satu admin aktif.'],TOOLS_USER_CONFLICT:[409,'Data pengguna berubah. Muat ulang daftar sebelum menyimpan.'],TOOLS_USER_NOT_FOUND:[404,'Pengguna tidak ditemukan.'],TOOLS_USER_INVALID:[400,'Periksa kembali data pengguna.']}
 const code=error.message?.match(/TOOLS_[A-Z_]+/)?.[0]
 if(code&&faults[code])throw new ToolsError(...faults[code],code)
 throw new ToolsError(503,'Pengelolaan pengguna belum siap. Hubungi pengelola untuk menyelesaikan penyiapan aplikasi.','USER_MANAGEMENT_UNAVAILABLE')
}
export async function handleToolsUsers(request:Request){
 const actor=await getToolsContext(request,{suiteAdmin:true})
 if(request.method==='GET'){
  const url=new URL(request.url),offset=Math.trunc(Math.min(10000,Math.max(0,Number(url.searchParams.get('offset'))||0)))
  let query=supabaseAdmin.from('tools_profiles').select(columns).order('created_at',{ascending:false}).order('user_id').range(offset,offset+49)
  const search=url.searchParams.get('q')?.trim().slice(0,100).replace(/[%_\\]/g,'')
  if(search)query=query.ilike('email',`%${search}%`)
  const{data,error}=await query;databaseError(error);return toolsJson(data||[])
 }
 const limit=await sharedRateLimit(`tools-admin:${actor.userId}`,30,900)
 if(!limit.allowed)throw new ToolsError(429,'Terlalu banyak perubahan pengguna. Tunggu sebelum mencoba lagi.','RATE_LIMITED',limit.retry_after)
 const body=await readToolsJson(request)
 if(request.method==='POST'){
  const parsed=createSchema.safeParse(body);if(!parsed.success)throw new ToolsError(400,'Isi nama, email valid, dan kata sandi minimal 8 karakter.')
  const{email,password,name}=parsed.data
  const{data,error}=await supabaseAdmin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}})
  if(error||!data.user){if(['email_exists','user_already_exists'].includes(error?.code||''))throw new ToolsError(409,'Email sudah terdaftar. Akun yang ada tidak diubah.');throw new ToolsError(503,'Akun belum dapat dibuat. Coba lagi nanti.')}
  const bootstrap=await supabaseAdmin.rpc('tools_bootstrap',{p_actor:data.user.id,p_name:name})
  if(bootstrap.error)throw new ToolsError(503,'Akun sudah dibuat, tetapi profil belum siap. Pengguna dapat mencoba masuk setelah penyiapan database selesai.','PROFILE_SETUP_REQUIRED')
  const result=await supabaseAdmin.from('tools_profiles').select(columns).eq('user_id',data.user.id).single();databaseError(result.error)
  return toolsJson(result.data,201)
 }
 const parsed=updateSchema.safeParse(body);if(!parsed.success)throw new ToolsError(400,'Data pengguna tidak valid. Muat ulang daftar dan coba lagi.')
 const{user_id,revision,...changes}=parsed.data
 const{data,error}=await supabaseAdmin.rpc('tools_manage_user',{p_actor:actor.userId,p_user:user_id,p_revision:revision,p_data:changes});databaseError(error)
 return toolsJson(data)
}
