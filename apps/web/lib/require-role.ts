import { getSessionUser } from './session'
import { canEdit, canAdmin } from './roles'

export class UnauthorizedError extends Error {
  constructor(message = 'Permissão insuficiente') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

// Role comes from the DB on every request, so a role change or removal applies immediately.
async function resolveRole() {
  return (await getSessionUser())?.role ?? null
}

export async function requireEdit() {
  const role = await resolveRole()
  if (!canEdit(role)) throw new UnauthorizedError()
  return role!
}

/** Any logged-in user; returns it. */
export async function requireUser() {
  const user = await getSessionUser()
  if (!user) throw new UnauthorizedError('Não autenticado')
  return user
}

export async function requireAdmin() {
  const role = await resolveRole()
  if (!canAdmin(role)) throw new UnauthorizedError()
  return role!
}

/** Credentials (authConfig) are only sent to clients of editors and admins. */
export async function canSeeSecrets() {
  return canEdit(await resolveRole())
}

export async function getCurrentRole() {
  return (await resolveRole()) ?? 'viewer'
}
