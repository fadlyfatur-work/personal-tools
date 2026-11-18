import { z } from 'zod'
import { cookies } from 'next/headers'
import { getToolsAuth } from '@/lib/tools/auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ToolsError, toolsJson, toolsRoute,readToolsJson } from '@/lib/tools/server'
import { safeToolsReturn } from '@/lib/tools/policy'
import { sharedRateLimit, trustedSource } from '@/lib/tools/limits'

export const dynamic = 'force-dynamic'
const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128), name: z.string().trim().max(100).optional(), next: z.string().max(500).optional() })
export function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  return toolsRoute(request, async () => {
    const { action } = await context.params
    if (!['login','register','reset','update-password','logout'].includes(action)) throw new ToolsError(404,'Tindakan tidak ditemukan.')
    const limit = await sharedRateLimit(`tools-auth:${trustedSource(request)}:${action}`, 100, 15 * 60)
    if (!limit.allowed) return Response.json({error:'Terlalu banyak percobaan. Coba lagi nanti.',code:'RATE_LIMITED'}, {status:429,headers:{'Retry-After':String(limit.retry_after)}})
    const auth = await getToolsAuth()
    if (action === 'logout') {
      const {error} = await auth.auth.signOut({scope:'local'})
      if (error) throw new ToolsError(503,'Belum dapat mengakhiri sesi. Coba kembali.')
      ;(await cookies()).set('documents_tag_access','',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0})
      return toolsJson({success:true})
    }
    const body = await readToolsJson(request)
    if (action === 'reset') {
      const parsed = z.object({email:z.string().trim().email().max(254),next:z.string().max(1000).optional()}).safeParse(body)
      if (!parsed.success) throw new ToolsError(400,'Isi alamat email yang valid.')
      const {error} = await auth.auth.resetPasswordForEmail(parsed.data.email,{redirectTo:`${new URL(request.url).origin}/tools/auth/callback?next=/tools/reset-password&return_to=${encodeURIComponent(safeToolsReturn(parsed.data.next))}`})
      if(error) throw new ToolsError(503,'Permintaan reset belum dapat diproses. Coba lagi nanti.')
      return toolsJson({message:'Jika email terdaftar, tautan pemulihan akan dikirim.'})
    }
    if (action === 'update-password') {
      const parsed = z.object({password:z.string().min(8).max(128)}).safeParse(body)
      if (!parsed.success) throw new ToolsError(400,'Kata sandi minimal 8 karakter.')
      const {data:{user}} = await auth.auth.getUser()
      if(!user) throw new ToolsError(401,'Buka tautan pemulihan dari email terlebih dahulu.')
      const {error} = await auth.auth.updateUser({password:parsed.data.password})
      if(error) throw new ToolsError(400,'Kata sandi belum dapat diperbarui. Gunakan tautan pemulihan yang masih berlaku.')
      return toolsJson({message:'Kata sandi diperbarui. Anda dapat membuka ruang kerja.'})
    }
    const parsed = credentials.safeParse(body)
    if (!parsed.success) throw new ToolsError(400,'Isi email yang valid dan kata sandi minimal 8 karakter.')
    const {email,password,name,next}=parsed.data
    if(action==='register') {
      const {data,error}=await supabaseAdmin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name:name||email.split('@')[0]}})
      if(error||!data.user) throw new ToolsError(400,'Pendaftaran belum dapat diproses. Periksa isian atau masuk jika sudah memiliki akun.')
      const {error:sessionError}=await auth.auth.signInWithPassword({email,password})
      if(sessionError) throw new ToolsError(503,'Akun sudah dibuat, tetapi sesi belum dapat dibuka. Coba masuk dengan email dan kata sandi Anda.','SIGN_IN_REQUIRED')
      return toolsJson({authenticated:true,next:safeToolsReturn(next)})
    }
    const {error}=await auth.auth.signInWithPassword({email,password})
    if(error) throw new ToolsError(401,'Email atau kata sandi tidak sesuai.','LOGIN_FAILED')
    return toolsJson({next:safeToolsReturn(next)})
  })
}
