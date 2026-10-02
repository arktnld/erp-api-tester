import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'

const sent = vi.hoisted(() => ({ calls: [] as { hostname: string; path: string; headers: Record<string, string>; ca?: unknown }[], redirectTo: null as string | null, body: Buffer.from('{"ok":true}'),
  handler: null as null | ((o: { path: string; headers: Record<string, string> }) => { status: number; body: string; headers?: Record<string, unknown> }) }))

function fakeRequest(options: { hostname: string; path: string; headers: Record<string, string>; ca?: unknown }, onResponse: (res: unknown) => void) {
  sent.calls.push({ hostname: options.hostname, path: options.path, headers: options.headers, ca: options.ca })
  const custom = sent.handler?.(options)
  const redirect = sent.calls.length === 1 && sent.redirectTo
  const res = Object.assign(new EventEmitter(), {
    statusCode: custom ? custom.status : redirect ? 302 : 200,
    headers: redirect ? { location: sent.redirectTo } : { 'content-type': 'application/json', ...custom?.headers },
    resume() {},
    destroy() {},
  })
  const req = Object.assign(new EventEmitter(), {
    write() {},
    setTimeout() {},
    end() {
      onResponse(res)
      res.emit('data', custom ? Buffer.from(custom.body) : sent.body)
      res.emit('end')
    },
  })
  return req
}
vi.mock('node:http', () => ({ request: fakeRequest }))
vi.mock('node:https', () => ({ request: fakeRequest }))

const history = vi.hoisted(() => ({ create: vi.fn(async () => ({})) }))
vi.mock('@/lib/repo/history', () => ({ recordExecution: history.create }))
const endpointState = vi.hoisted(() => ({ authMode: null as string | null }))
vi.mock('@/lib/repo/endpoints', () => ({
  getEndpoint: async (id: number) => id === 2
    ? { id: 2, name: 'Token', method: 'POST', pathTemplate: '/oauth/token', bodyTemplate: '', headers: '{}', authMode: null }
    : { id: 1, name: 'E', method: 'GET', pathTemplate: '/x?t={token}&a={app}', bodyTemplate: '', headers: '{}', authMode: endpointState.authMode },
}))
const companyState = vi.hoisted(() => ({ override: null as null | Record<string, unknown>, saved: [] as unknown[], cookies: new Map<number, unknown>() }))
vi.mock('@/lib/repo/companies', () => ({
  getCompanyWithAuth: async () => companyState.override ?? ({
    id: 1, name: 'C', baseUrl: 'https://erp.example.com', authType: 'bearer',
    environments: [{ name: 'hml', url: 'https://hml.example.com' }],
    authConfig: { token: 'secret-token' }, erp: { name: 'ERP', authTemplate: null },
  }),
  getTestClientWithCompany: async () => { throw new Error('unused') },
  saveTokenCache: async (_id: number, cfg: unknown) => { companyState.saved.push(cfg); return {} },
  getCookieJar: async (id: number) => companyState.cookies.get(id) ?? [],
  saveCookieJar: async (id: number, cookies: unknown[]) => { companyState.cookies.set(id, JSON.parse(JSON.stringify(cookies))); return {} },
}))

import { executeRequest, ValidationError, MAX_RESPONSE_BYTES } from './execute'

beforeEach(() => {
  sent.calls = []
  sent.redirectTo = null
  sent.body = Buffer.from('{"ok":true}')
  sent.handler = null
  companyState.override = null
  companyState.saved = []
  companyState.cookies.clear()
  endpointState.authMode = null
  history.create.mockClear()
})

describe('executeRequest credential binding', () => {
  it('refuses to send company credentials to a customUrl on another host', async () => {
    await expect(executeRequest({ endpointId: 1, companyId: 1, customUrl: 'https://attacker.example.net/x' }))
      .rejects.toBeInstanceOf(ValidationError)
    expect(sent.calls).toHaveLength(0)
  })

  it('allows another port on the company host (token on :45700, API on :45715)', async () => {
    await executeRequest({ endpointId: 1, companyId: 1, customUrl: 'https://erp.example.com:45700/connect/token' })
    expect(sent.calls).toHaveLength(1)
  })

  it('refuses the company host over plain http', async () => {
    await expect(executeRequest({ endpointId: 1, companyId: 1, customUrl: 'http://erp.example.com/x' }))
      .rejects.toBeInstanceOf(ValidationError)
    expect(sent.calls).toHaveLength(0)
  })

  it('refuses an environmentUrl that is not registered for the company', async () => {
    await expect(executeRequest({ endpointId: 1, companyId: 1, environmentUrl: 'https://attacker.example.net' }))
      .rejects.toBeInstanceOf(ValidationError)
    expect(sent.calls).toHaveLength(0)
  })

  it('allows the base URL, registered environments and same-host customUrl', async () => {
    await executeRequest({ endpointId: 1, companyId: 1 })
    await executeRequest({ endpointId: 1, companyId: 1, environmentUrl: 'https://hml.example.com' })
    await executeRequest({ endpointId: 1, companyId: 1, customUrl: 'https://erp.example.com/other?q=1' })
    expect(sent.calls.map((c) => c.hostname)).toEqual(['erp.example.com', 'hml.example.com', 'erp.example.com'])
    expect(sent.calls[0].headers.Authorization).toBe('Bearer secret-token')
  })
})

describe('executeRequest secret exposure', () => {
  it('never stores credentials in history', async () => {
    await executeRequest({ endpointId: 1, companyId: 1, revealSecrets: true })
    expect(JSON.stringify(history.create.mock.calls)).not.toContain('secret-token')
  })

  it('masks request headers in the result unless revealSecrets', async () => {
    expect(JSON.stringify(await executeRequest({ endpointId: 1, companyId: 1 }))).not.toContain('secret-token')
    expect((await executeRequest({ endpointId: 1, companyId: 1, revealSecrets: true })).requestHeaders.Authorization)
      .toBe('Bearer secret-token')
  })
})

describe('executeRequest redirects', () => {
  it('does not follow a redirect to a private address', async () => {
    sent.redirectTo = 'http://127.0.0.1:5432/'
    const result = await executeRequest({ endpointId: 1, companyId: 1 })
    expect(sent.calls.map((c) => c.hostname)).toEqual(['erp.example.com'])
    expect(result.responseBody).toContain('bloqueada')
  })
})

describe('executeRequest response limits', () => {
  it('aborts responses larger than the cap instead of buffering them', async () => {
    sent.body = Buffer.alloc(MAX_RESPONSE_BYTES + 1)
    const result = await executeRequest({ endpointId: 1, companyId: 1 })
    expect(result.statusCode).toBe(0)
    expect(result.responseBody).toContain('excede')
  })
})

describe('executeRequest token lifetime', () => {
  const tokenCompany = (cfg: Record<string, unknown>) => ({
    id: 1, name: 'C', baseUrl: 'https://erp.example.com', authType: 'token_endpoint', environments: [],
    authConfig: { tokenEndpointId: 2, tokenPath: 'access_token', params: {}, ...cfg }, erp: { name: 'ERP', authTemplate: null },
  })
  const erp = (o: { path: string }) => o.path === '/oauth/token'
    ? { status: 200, body: '{"access_token":"new","expires_in":3600}' }
    : { status: o.path.includes('t=old') ? 401 : 200, body: '{"ok":true}' }

  it('renews an expired cached token before sending', async () => {
    companyState.override = tokenCompany({ cachedToken: 'old', expiresAt: Date.now() - 1 })
    sent.handler = erp
    const r = await executeRequest({ endpointId: 1, companyId: 1 })
    expect(r.statusCode).toBe(200)
    expect(sent.calls).toHaveLength(2) // token + request, no failed attempt
    expect(companyState.saved[0]).toMatchObject({ cachedToken: 'new', expiresAt: expect.any(Number) })
  })

  it('renews and retries once when a cached token gets 401', async () => {
    companyState.override = tokenCompany({ cachedToken: 'old' })
    sent.handler = erp
    const r = await executeRequest({ endpointId: 1, companyId: 1 })
    expect(r.statusCode).toBe(200)
    expect(sent.calls).toHaveLength(3) // 401, token, retry
  })

  it('does not loop when the fresh token is also rejected', async () => {
    companyState.override = tokenCompany({ cachedToken: 'old' })
    sent.handler = (o) => o.path === '/oauth/token' ? { status: 200, body: '{"access_token":"old"}' } : { status: 401, body: '{}' }
    const r = await executeRequest({ endpointId: 1, companyId: 1 })
    expect(r.statusCode).toBe(401)
    expect(sent.calls).toHaveLength(3)
  })
})

describe('executeRequest cookies and CAs', () => {
  it('replays session cookies set by the ERP on later calls of the same company', async () => {
    companyState.override = {
      id: 77, name: 'C', baseUrl: 'https://erp.example.com', authType: 'none', environments: [],
      authConfig: {}, erp: { name: 'ERP', authTemplate: null },
    }
    sent.handler = () => ({ status: 200, body: '{}', headers: { 'set-cookie': ['SESSID=abc; Path=/'] } })
    await executeRequest({ endpointId: 1, companyId: 77 })
    await executeRequest({ endpointId: 1, companyId: 77 })
    expect(sent.calls[0].headers.Cookie).toBeUndefined()
    expect(sent.calls[1].headers.Cookie).toBe('SESSID=abc')
  })

  it('passes the OS + bundled CA list to https requests', async () => {
    await executeRequest({ endpointId: 1, companyId: 1 })
    expect(Array.isArray(sent.calls[0].ca) && (sent.calls[0].ca as string[]).length).toBeGreaterThan(0)
  })
})

describe('executeRequest auth from the ERP template', () => {
  const company = (erpTemplate: unknown, authConfig: unknown, authType = 'body_fields') => ({
    id: 5, name: 'C', baseUrl: 'https://erp.example.com', authType, environments: [],
    authConfig, erp: { name: 'ERP', authTemplate: erpTemplate },
  })
  const twoModes = [
    { id: 'default', type: 'body_fields', label: '', fields: [] },
    { id: 'basic', type: 'basic', label: '', fields: [] },
  ]

  it('uses the ERP token endpoint even when the company saved an old one', async () => {
    companyState.override = company(
      { type: 'token_endpoint', label: '', fields: [], tokenEndpointId: 2, tokenPath: 'access_token' },
      { tokenEndpointId: 99, tokenPath: 'old', params: {} },
      'token_endpoint',
    )
    sent.handler = (o) => o.path === '/oauth/token' ? { status: 200, body: '{"access_token":"fresh"}' } : { status: 200, body: '{}' }
    await executeRequest({ endpointId: 1, companyId: 5 })
    expect(sent.calls[0].path).toBe('/oauth/token') // endpoint 2 (from the ERP), not the saved 99
    expect(sent.calls[1].path).toContain('t=fresh')
  })

  it('sends Basic on an endpoint that names the basic mode, keeping {token}/{app} of the default mode', async () => {
    companyState.override = company(twoModes, { default: { token: 'tk', app: 'ap' }, basic: { username: 'u', password: 'p' } })
    endpointState.authMode = 'basic'
    await executeRequest({ endpointId: 1, companyId: 5 })
    expect(sent.calls[0].headers.Authorization).toBe(`Basic ${btoa('u:p')}`)
    expect(sent.calls[0].path).toContain('t=tk')
  })

  it('first mode bearer with credentials stored per mode still sends the header', async () => {
    companyState.override = company([{ id: 'b', type: 'bearer', label: '', fields: [] }, { id: 'k', type: 'api_key', label: '', fields: [] }], { b: { token: 'XYZ' }, k: {} }, 'bearer')
    await executeRequest({ endpointId: 1, companyId: 5 })
    expect(sent.calls[0].headers.Authorization).toBe('Bearer XYZ')
  })

  it("running a second mode's token endpoint uses that mode's params, without fetching the first mode's token", async () => {
    companyState.override = company(
      [
        { id: 'cc', type: 'token_endpoint', label: '', fields: [], tokenEndpointId: 7, tokenPath: 'access_token' },
        { id: 'pw', type: 'token_endpoint', label: '', fields: [], tokenEndpointId: 2, tokenPath: 'access_token' },
      ],
      { cc: { params: { CLIENT_ID: 'a' } }, pw: { params: { CLIENT_ID: 'b' } } },
      'token_endpoint',
    )
    sent.handler = () => ({ status: 200, body: '{"access_token":"T"}' })
    await executeRequest({ endpointId: 2, companyId: 5 })
    expect(sent.calls).toHaveLength(1) // only the password grant itself
    expect(sent.calls[0].path).toBe('/oauth/token')
    expect(companyState.saved[0]).toMatchObject({ pw: { cachedToken: 'T' } })
  })
})
