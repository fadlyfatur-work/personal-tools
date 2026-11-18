import { AI_LIMITS } from '@/lib/ahspRabAi'
export const dynamic = 'force-dynamic'
export async function GET() {
  return Response.json({ configured: !!process.env.AHSP_AI_ADMIN_TOKEN && process.env.AHSP_AI_ADMIN_TOKEN.length >= 32 && !!process.env.AHSP_AI_ENCRYPTION_KEY, limits: AI_LIMITS }, { headers: { 'Cache-Control': 'no-store' } })
}
