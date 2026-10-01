import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  user: null as null | { id: number; email: string; passwordHash: string; failedLogins: number; lockedUntil: Date | null },
}))

vi.mock('@erp/db', () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) => (state.user?.email === where.email ? { ...state.user } : null),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        const inc = (data.failedLogins as { increment?: number } | undefined)?.increment
        Object.assign(state.user!, inc ? { failedLogins: state.user!.failedLogins + inc } : data)
        return { ...state.user }
      },
    },
  },
}))

import { attemptLogin, safeNext } from './login'
import { hashPassword } from './password'

beforeEach(async () => {
  state.user = { id: 1, email: 'ana@example.com', passwordHash: await hashPassword('senha-certa'), failedLogins: 0, lockedUntil: null }
})

describe('attemptLogin', () => {
  it('accepts the right password, e-mail in any case', async () => {
    expect(await attemptLogin(' ANA@example.com ', 'senha-certa')).toBe(1)
  })

  it('returns the same null for an unknown e-mail, a wrong password and a locked account', async () => {
    expect(await attemptLogin('ninguem@example.com', 'x')).toBeNull()
    expect(await attemptLogin('ana@example.com', 'errada')).toBeNull()
    state.user!.lockedUntil = new Date(Date.now() + 60_000)
    expect(await attemptLogin('ana@example.com', 'senha-certa')).toBeNull()
  })

  it('locks for 15 min after 5 wrong passwords, then lets the right one in once it expires', async () => {
    for (let i = 0; i < 5; i++) await attemptLogin('ana@example.com', 'errada')
    const until = state.user!.lockedUntil!.getTime()
    expect(until).toBeGreaterThan(Date.now() + 14 * 60_000)
    expect(await attemptLogin('ana@example.com', 'senha-certa')).toBeNull()
    expect(await attemptLogin('ana@example.com', 'senha-certa', until + 1)).toBe(1)
    expect(state.user!.lockedUntil).toBeNull()
  })

  it('resets the failure counter after a successful login', async () => {
    await attemptLogin('ana@example.com', 'errada')
    await attemptLogin('ana@example.com', 'senha-certa')
    expect(state.user!.failedLogins).toBe(0)
  })
})

describe('safeNext', () => {
  it('keeps same-site paths and drops everything else', () => {
    expect(safeNext('/test?x=1')).toBe('/test?x=1')
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', 'evil', undefined, 42]) {
      expect(safeNext(bad)).toBe('/')
    }
  })
})
