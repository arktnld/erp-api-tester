import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/login', () => ({ attemptLogin: async (_e: string, p: string) => (p === 'ok' ? 1 : null), safeNext: (n?: string) => n ?? '/' }))
vi.mock('@/lib/session', () => ({
  SESSION_COOKIE: 'erp_session',
  createSession: async () => 'tok',
  sessionCookieOptions: (_secure: boolean, remember: boolean) => ({ httpOnly: true, path: '/', ...(remember ? { maxAge: 60 } : {}) }),
}))

import { POST } from './route'

// Server bound to localhost, browser on the LAN address: the Host header is what counts.
const req = (origin: string | null, password = 'ok', extra: Record<string, unknown> = {}) => new NextRequest('http://localhost:9000/api/login', {
  method: 'POST',
  headers: { host: '10.0.0.5:9000', 'content-type': 'application/json', ...(origin ? { origin } : {}) },
  body: JSON.stringify({ email: 'a@example.com', password, next: '/test', ...extra }),
})

describe('POST /api/login', () => {
  it('logs in from the same host the browser used and sets the cookie', async () => {
    const res = await POST(req('http://10.0.0.5:9000'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ redirect: '/test' })
    expect(res.headers.get('set-cookie')).toMatch(/erp_session=tok/)
  })

  it('"Lembrar-me" off gives a browser-session cookie (no Max-Age)', async () => {
    expect((await POST(req('http://10.0.0.5:9000'))).headers.get('set-cookie')).toMatch(/Max-Age=60/)
    expect((await POST(req('http://10.0.0.5:9000', 'ok', { remember: false }))).headers.get('set-cookie')).not.toMatch(/Max-Age/)
  })

  it('refuses logins posted from another site', async () => {
    expect((await POST(req('http://evil.example'))).status).toBe(403)
  })

  it('answers 401 without a cookie on a wrong password', async () => {
    const res = await POST(req('http://10.0.0.5:9000', 'bad'))
    expect(res.status).toBe(401)
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})
