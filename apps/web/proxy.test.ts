import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const session = vi.hoisted(() => ({ valid: false, renewed: false }))
vi.mock('@/lib/session', () => ({
  SESSION_COOKIE: 'erp_session',
  validateSessionToken: async (token?: string) =>
    session.valid && token ? { user: { id: 1, email: 'a@b.c', name: '', role: 'viewer' }, renewed: session.renewed } : null,
}))

import { proxy } from './proxy'

const req = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, 'http://erp.local'), { headers: cookie ? { cookie: `erp_session=${cookie}` } : {} })

beforeEach(() => { session.valid = false; session.renewed = false })

describe('proxy', () => {
  it('lets the login page/endpoint and shared record links through without a session', async () => {
    for (const path of ['/sign-in', '/api/login', '/records/abc-123/view']) {
      expect((await proxy(req(path))).headers.get('location')).toBeNull()
    }
  })

  it('redirects pages to /sign-in keeping where the user was going', async () => {
    const res = await proxy(req('/companies?erp=1'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://erp.local/sign-in?next=%2Fcompanies%3Ferp%3D1')
  })

  it('answers 401 to API calls and does not treat look-alike paths as public', async () => {
    expect((await proxy(req('/api/execute'))).status).toBe(401)
    expect((await proxy(req('/records/abc/view/extra'))).status).toBe(307)
    expect((await proxy(req('/sign-in/../companies'))).status).toBe(307)
  })

  it('refuses server actions without a session, even when posted to a public page', async () => {
    for (const path of ['/sign-in', '/records/abc-123/view']) {
      const res = await proxy(new NextRequest(new URL(path, 'http://erp.local'), { method: 'POST', headers: { 'next-action': 'abc123' } }))
      expect(res.status).toBe(401)
    }
  })

  it('rejects a forged cookie and clears it', async () => {
    const res = await proxy(req('/', 'forged'))
    expect(res.status).toBe(307)
    expect(res.headers.get('set-cookie')).toMatch(/erp_session=;/)
  })

  it('passes valid sessions without touching the cookie (its lifetime was chosen at login)', async () => {
    session.valid = true
    session.renewed = true
    const res = await proxy(req('/', 'tok'))
    expect(res.headers.get('location')).toBeNull()
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})
