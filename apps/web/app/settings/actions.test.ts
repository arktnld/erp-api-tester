import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  me: { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin' as string },
  created: [] as Record<string, unknown>[],
  deletedSessions: [] as unknown[],
  existing: null as null | { id: number },
  admins: 2,
}))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/session', () => ({
  getSessionUser: async () => state.me,
  deleteOtherSessions: async () => {},
}))
vi.mock('@erp/db', () => {
  const user = {
    findUnique: async () => state.existing,
    create: async ({ data }: { data: Record<string, unknown> }) => { state.created.push(data); return data },
    update: async () => ({}),
    delete: async () => ({}),
    findMany: async () => [],
  }
  const session = { deleteMany: async (q: unknown) => { state.deletedSessions.push(q); return {} } }
  const tx = { user: { ...user, count: async () => state.admins } }
  return {
    prisma: {
      user, session,
      $transaction: async (arg: unknown) => typeof arg === 'function' ? arg(tx) : Promise.all(arg as unknown[]),
    },
  }
})

import { createUser, deleteUser, listUsers, resetUserPassword, updateUserRole } from './actions'
import { verifyPassword } from '@/lib/password'

beforeEach(() => {
  state.me = { id: 1, email: 'admin@example.com', name: 'Admin', role: 'admin' }
  state.created = []
  state.deletedSessions = []
  state.existing = null
  state.admins = 2
})

describe('user management actions', () => {
  it('are admin-only', async () => {
    for (const role of ['viewer', 'editor']) {
      state.me = { ...state.me, role }
      await expect(listUsers()).rejects.toThrow('Permissão insuficiente')
      await expect(createUser({ email: 'x@example.com', name: '', role: 'admin' })).rejects.toThrow('Permissão insuficiente')
      await expect(resetUserPassword(2)).rejects.toThrow('Permissão insuficiente')
    }
    expect(state.created).toHaveLength(0)
  })

  it('stop an admin from demoting, resetting or deleting themselves', async () => {
    await expect(updateUserRole(1, 'viewer')).rejects.toThrow('próprio usuário')
    await expect(resetUserPassword(1)).rejects.toThrow('próprio usuário')
    await expect(deleteUser(1)).rejects.toThrow('próprio usuário')
  })

  it('create a user with a normalized e-mail and a hashed random password', async () => {
    const res = await createUser({ email: '  Nova@Example.com ', name: 'Nova', role: 'editor' })
    expect('password' in res && res.password).toHaveLength(16)
    const row = state.created[0] as { email: string; passwordHash: string; role: string }
    expect(row.email).toBe('nova@example.com')
    expect(row.role).toBe('editor')
    expect(row.passwordHash).not.toContain((res as { password: string }).password)
    expect(await verifyPassword((res as { password: string }).password, row.passwordHash)).toBe(true)
  })

  it('reject duplicate e-mails and invalid roles', async () => {
    state.existing = { id: 9 }
    expect(await createUser({ email: 'dup@example.com', name: '', role: 'viewer' })).toEqual({ error: 'Já existe um usuário com esse e-mail' })
    state.existing = null
    expect(await createUser({ email: 'x@example.com', name: '', role: 'root' as never })).toHaveProperty('error')
  })

  it('never leave the system without an admin', async () => {
    state.admins = 0 // what the count would be after demoting/removing the last other admin
    expect(await updateUserRole(2, 'viewer')).toEqual({ error: 'É preciso ter pelo menos um admin' })
    expect(await deleteUser(2)).toEqual({ error: 'É preciso ter pelo menos um admin' })
    state.admins = 1
    expect(await updateUserRole(2, 'viewer')).toEqual({})
  })

  it('end every session of a user whose password was reset', async () => {
    await resetUserPassword(2)
    expect(state.deletedSessions).toEqual([{ where: { userId: 2 } }])
  })
})
