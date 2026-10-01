import { createHash, randomBytes } from 'node:crypto'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from '@erp/db'
import { getRole, type Role } from './roles'

export const SESSION_COOKIE = 'erp_session'
/** Idle timeout: a session unused for this long expires. Pushed forward on use. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Renew once less than this is left, so an active session isn't written on every request. */
const RENEW_BELOW_MS = SESSION_TTL_MS / 2
/** "Lembrar-me": the cookie lives this long; without it, only until the browser closes. */
export const COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60

export type SessionUser = { id: number; email: string; name: string; role: Role }

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export function sessionCookieOptions(secure: boolean, remember = true) {
  // secure only when the request came over https: the app is served over plain http inside the VPN.
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure, ...(remember ? { maxAge: COOKIE_MAX_AGE_S } : {}) }
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  // Housekeeping: sessions abandoned without logout would otherwise stay forever.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  await prisma.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  })
  return token
}

/**
 * Resolves a cookie token to its user, or null when missing/expired.
 * `renewed` is true when the idle timeout was pushed forward.
 */
export async function validateSessionToken(token: string | undefined, now = Date.now()) {
  if (!token) return null
  const id = hashToken(token)
  const session = await prisma.session.findUnique({
    where: { id },
    select: { expiresAt: true, user: { select: { id: true, email: true, name: true, role: true } } },
  })
  if (!session) return null
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id } }).catch(() => {})
    return null
  }
  let renewed = false
  if (session.expiresAt.getTime() - now < RENEW_BELOW_MS) {
    await prisma.session.update({ where: { id }, data: { expiresAt: new Date(now + SESSION_TTL_MS) } })
    renewed = true
  }
  const user: SessionUser = { ...session.user, role: getRole({ role: session.user.role }) }
  return { user, renewed }
}

/** The logged-in user for this request (server components, actions, route handlers). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return (await validateSessionToken(token))?.user ?? null
})

/** Ends every session of the user except the one making this request. */
export async function deleteOtherSessions(userId: number) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  await prisma.session.deleteMany({ where: { userId, ...(token ? { NOT: { id: hashToken(token) } } : {}) } })
}

export async function deleteSessionToken(token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } })
}
