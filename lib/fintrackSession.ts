import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const FINTRACK_PIN_COOKIE = 'fintrack_pin_session'
const SESSION_ISSUER = 'personal-tools'
const SESSION_AUDIENCE = 'fintrack'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function sessionKey() {
  const secret = process.env.FINTRACK_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('FINTRACK_SESSION_SECRET harus berisi minimal 32 karakter')
  }
  return new TextEncoder().encode(secret)
}

export async function createPinSession(userId: string, pinVersion: number) {
  const token = await new SignJWT({ auth: 'pin', pinVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(sessionKey())

  const cookieStore = await cookies()
  cookieStore.set(FINTRACK_PIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: 'high',
  })
}

export async function readPinSession() {
  const token = (await cookies()).get(FINTRACK_PIN_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ['HS256'],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    })
    if (!payload.sub || payload.auth !== 'pin' || typeof payload.pinVersion !== 'number') return null
    return { userId: payload.sub, pinVersion: payload.pinVersion }
  } catch {
    return null
  }
}

export async function clearPinSession() {
  const cookieStore = await cookies()
  cookieStore.set(FINTRACK_PIN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
