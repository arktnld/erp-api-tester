import { prisma } from '@erp/db'
import { DUMMY_HASH, verifyPassword } from './password'

export const MAX_FAILED_LOGINS = 5
export const LOCK_MS = 15 * 60 * 1000

/**
 * Checks e-mail + password. Every failure (unknown e-mail, wrong password, locked account)
 * looks the same and takes about the same time, so it can't be used to find valid e-mails.
 */
export async function attemptLogin(email: string, password: string, now = Date.now()): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, failedLogins: true, lockedUntil: true },
  })
  const locked = !!user?.lockedUntil && user.lockedUntil.getTime() > now
  const ok = await verifyPassword(password, user && !locked ? user.passwordHash : DUMMY_HASH)
  if (!user || locked) return null

  if (!ok) {
    // Atomic increment: parallel attempts across the cluster instances can't slip past the limit.
    const { failedLogins } = await prisma.user.update({
      where: { id: user.id }, data: { failedLogins: { increment: 1 } }, select: { failedLogins: true },
    })
    if (failedLogins >= MAX_FAILED_LOGINS) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: new Date(now + LOCK_MS) } })
    }
    return null
  }

  if (user.failedLogins || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } })
  }
  return user.id
}

/** Same-site path to go to after login; anything else (other host, scheme, control chars) becomes "/". */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || /[\u0000-\u001f\\]/.test(next)) return '/'
  const base = 'http://erp.invalid'
  try {
    const url = new URL(next, base)
    return url.origin === base ? url.pathname + url.search : '/'
  } catch {
    return '/'
  }
}
