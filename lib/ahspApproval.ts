import { createHash } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { z } from 'zod'

const componentSchema = z.object({
  group: z.enum(['tenaga', 'bahan', 'alat']),
  name: z.string().trim().min(1).max(240),
  code: z.string().trim().max(120).default(''),
  unit: z.string().trim().min(1).max(40),
  coefficient: z.number().finite().min(0).nullable(),
  expression: z.string().trim().max(500).default(''),
}).strict().refine(value => value.coefficient !== null || (value.expression !== '' && value.expression !== '0'), {
  message: 'Isi koefisien atau rumus selain 0.',
})

export const submissionSchema = z.object({
  itemId: z.uuid(),
  sourceReference: z.string().trim().min(1).max(500),
  components: z.array(componentSchema).min(1).max(250),
}).strict()

export const reviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().trim().max(1000).default(''),
  confirmIdentity: z.boolean().default(false),
}).strict().refine(value => value.action !== 'reject' || value.note.length >= 3, {
  message: 'Alasan penolakan wajib diisi.',
})

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}

export function approvalSourceHash(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`${process.env.AHSP_APPROVAL_SESSION_SECRET ?? ''}:${address}`).digest('hex')
}

export async function createApprovalToken() {
  const secret = process.env.AHSP_APPROVAL_SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error('AHSP_APPROVAL_SESSION_SECRET is not configured')
  return new SignJWT({ scope: 'ahsp-approval' }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('20m').sign(new TextEncoder().encode(secret))
}

export async function hasApprovalSession(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('ahsp_approval='))?.slice('ahsp_approval='.length)
  const secret = process.env.AHSP_APPROVAL_SESSION_SECRET
  if (!token || !secret || secret.length < 32) return false
  try {
    const { payload } = await jwtVerify(decodeURIComponent(token), new TextEncoder().encode(secret))
    return payload.scope === 'ahsp-approval'
  } catch { return false }
}

export function approvalCookie(token: string, maxAge: number) {
  return `ahsp_approval=${encodeURIComponent(token)}; Path=/api/ahsp/approval; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}
