import { describe, it, expect, vi, beforeEach } from 'vitest'

const authState = vi.hoisted(() => ({ userId: null as string | null, role: undefined as string | undefined }))

vi.mock('@/lib/session', () => ({
  getSessionUser: async () => authState.userId ? { id: 1, email: 'u@example.com', name: 'U', role: authState.role ?? 'viewer' } : null,
}))

vi.mock('@erp/db', () => ({
  prisma: {
    eRP: {
      findMany: vi.fn(async () => [{
        name: 'ERP', fieldSchemas: [], endpoints: [],
        companies: [{ name: 'Co', baseUrl: 'https://erp.example', environments: [], authType: 'bearer', authConfig: { token: 'secret-token' }, testClients: [] }],
      }]),
    },
  },
}))

import { GET } from './route'

describe('GET /api/backup', () => {
  beforeEach(() => {
    authState.userId = null
    authState.role = undefined
  })

  it('rejects anonymous callers', async () => {
    const res = await GET()
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain('secret-token')
  })

  it('rejects viewers and editors', async () => {
    authState.userId = 'u1'
    for (const role of ['viewer', 'editor']) {
      authState.role = role
      expect((await GET()).status).toBe(403)
    }
  })

  it('exports for admins', async () => {
    authState.userId = 'u1'
    authState.role = 'admin'
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('secret-token')
  })
})
