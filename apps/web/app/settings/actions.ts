'use server'

import { z } from 'zod'
import { prisma } from '@erp/db'
import { requireAdmin, requireUser, UnauthorizedError } from '@/lib/require-role'
import { ROLES, type Role } from '@/lib/roles'
import { MIN_PASSWORD_LENGTH, generatePassword, hashPassword, verifyPassword } from '@/lib/password'
import { revalidatePath } from 'next/cache'
import { deleteOtherSessions } from '@/lib/session'
import { LOCK_MS, MAX_FAILED_LOGINS } from '@/lib/login'

const Email = z.string().trim().toLowerCase().email('E-mail inválido').max(200)
const Name = z.string().trim().max(100)
const RoleSchema = z.enum(ROLES as [Role, ...Role[]])
const Password = z.string().min(MIN_PASSWORD_LENGTH, `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`).max(200)

/** Admins can't lock themselves out: no changing their own role or deleting themselves here. */
async function requireOtherUser(userId: number) {
  const admin = await requireAdmin()
  const me = await requireUser()
  if (me.id === userId) throw new UnauthorizedError('Não é possível alterar o próprio usuário por aqui')
  return admin
}

export async function listUsers() {
  await requireAdmin()
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, email: true, name: true, role: true },
  })
  return users.map((u) => ({ ...u, name: u.name || 'Sem nome', role: RoleSchema.catch('viewer').parse(u.role) }))
}

// User-facing errors are returned, not thrown: Next hides thrown messages from actions in production.
export type ActionResult = { error: string } | { password?: string }

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Dados inválidos'

/** Creates an account with a random password, returned once so the admin can hand it over. */
export async function createUser(input: { email: string; name: string; role: Role }): Promise<ActionResult> {
  await requireAdmin()
  const parsed = z.object({ email: Email, name: Name, role: RoleSchema }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) return { error: 'Já existe um usuário com esse e-mail' }
  const password = generatePassword()
  await prisma.user.create({ data: { ...parsed.data, passwordHash: await hashPassword(password) } })
  revalidatePath('/settings')
  return { password }
}

/**
 * Runs a change and undoes it if no admin would be left (two admins demoting each other
 * at the same time included: serializable transactions make one of them fail).
 */
const LAST_ADMIN = 'É preciso ter pelo menos um admin'
async function keepingAnAdmin(change: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<unknown>): Promise<ActionResult> {
  try {
    await prisma.$transaction(async (tx) => {
      await change(tx)
      if ((await tx.user.count({ where: { role: 'admin' } })) === 0) throw new Error(LAST_ADMIN)
    }, { isolationLevel: 'Serializable' })
    return {}
  } catch (err) {
    if (err instanceof Error && err.message === LAST_ADMIN) return { error: LAST_ADMIN }
    throw err
  }
}

export async function updateUserRole(userId: number, role: Role): Promise<ActionResult> {
  await requireOtherUser(userId)
  const parsed = RoleSchema.parse(role)
  const res = await keepingAnAdmin((tx) => tx.user.update({ where: { id: userId }, data: { role: parsed } }))
  revalidatePath('/settings')
  return res
}

export async function updateUserName(userId: number, name: string) {
  await requireAdmin()
  await prisma.user.update({ where: { id: userId }, data: { name: Name.parse(name) } })
  revalidatePath('/settings')
}

/** Sets a new random password and ends the user's sessions. */
export async function resetUserPassword(userId: number): Promise<ActionResult> {
  await requireOtherUser(userId)
  const password = generatePassword()
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null } }),
    prisma.session.deleteMany({ where: { userId } }),
  ])
  return { password }
}

export async function deleteUser(userId: number): Promise<ActionResult> {
  await requireOtherUser(userId)
  const res = await keepingAnAdmin((tx) => tx.user.delete({ where: { id: userId } })) // sessions cascade
  revalidatePath('/settings')
  return res
}

/** Any logged-in user changing their own password; other sessions are ended. */
export async function changeOwnPassword(input: { current: string; next: string }): Promise<ActionResult> {
  const me = await requireUser()
  const parsed = z.object({ current: z.string().max(200), next: Password }).safeParse(input)
  if (!parsed.success) return { error: firstIssue(parsed.error) }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true } })
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    // Same limit as login, so a hijacked session can't brute-force the current password.
    const { failedLogins } = await prisma.user.update({
      where: { id: me.id }, data: { failedLogins: { increment: 1 } }, select: { failedLogins: true },
    })
    if (failedLogins >= MAX_FAILED_LOGINS) {
      await prisma.user.update({ where: { id: me.id }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } })
      await prisma.session.deleteMany({ where: { userId: me.id } })
      return { error: 'Muitas tentativas: você saiu e a conta fica bloqueada por 15 min.' }
    }
    return { error: 'Senha atual incorreta' }
  }
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.next) } })
  await deleteOtherSessions(me.id)
  return {}
}
