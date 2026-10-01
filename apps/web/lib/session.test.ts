import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

const db = vi.hoisted(() => ({
  rows: new Map<string, { userId: number; expiresAt: Date }>(),
  user: { id: 7, email: 'a@example.com', name: 'A', role: 'editor' },
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@erp/db', () => ({
  prisma: {
    session: {
      create: async ({ data }: { data: { id: string; userId: number; expiresAt: Date } }) => { db.rows.set(data.id, data); return data },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = db.rows.get(where.id)
        return row ? { expiresAt: row.expiresAt, user: db.user } : null
      },
      update: async ({ where, data }: { where: { id: string }; data: { expiresAt: Date } }) => {
        db.rows.get(where.id)!.expiresAt = data.expiresAt
      },
      delete: async ({ where }: { where: { id: string } }) => { db.rows.delete(where.id) },
      deleteMany: async ({ where }: { where: { expiresAt: { lt: Date } } }) => {
        for (const [id, r] of db.rows) if (r.expiresAt < where.expiresAt.lt) db.rows.delete(id)
      },
    },
  },
}))

import { createSession, validateSessionToken, SESSION_TTL_MS } from './session'

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => db.rows.clear())

describe('sessions', () => {
  it('stores only the sha256 of the token, never the token itself', async () => {
    const token = await createSession(7)
    expect(db.rows.has(token)).toBe(false)
    expect(db.rows.has(createHash('sha256').update(token).digest('hex'))).toBe(true)
  })

  it('resolves a valid token to its user and rejects unknown ones', async () => {
    const token = await createSession(7)
    expect((await validateSessionToken(token))?.user).toEqual(db.user)
    expect(await validateSessionToken('forged')).toBeNull()
    expect(await validateSessionToken(undefined)).toBeNull()
  })

  it('expires after the idle timeout and deletes the row', async () => {
    const token = await createSession(7)
    expect(await validateSessionToken(token, Date.now() + SESSION_TTL_MS + 1000)).toBeNull()
    expect(db.rows.size).toBe(0)
  })

  it('renews only once less than half the timeout is left', async () => {
    const token = await createSession(7)
    expect((await validateSessionToken(token, Date.now() + DAY))?.renewed).toBe(false)
    const later = Date.now() + 5 * DAY
    expect((await validateSessionToken(token, later))?.renewed).toBe(true)
    expect([...db.rows.values()][0].expiresAt.getTime()).toBe(later + SESSION_TTL_MS)
  })

  it('maps an unknown role in the DB to viewer', async () => {
    db.user = { ...db.user, role: 'superuser' }
    const token = await createSession(7)
    expect((await validateSessionToken(token))?.user.role).toBe('viewer')
    db.user = { ...db.user, role: 'editor' }
  })
})
