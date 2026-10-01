import { describe, it, expect } from 'vitest'
import { MASK, redactAuthConfig, redactHeaders, redactBody } from './redact'
import { buildAuthHeaders, hasCachedToken, hasFilledCredentials, pickModeConfig } from './auth'

describe('redactAuthConfig', () => {
  it('masks flat credentials but keeps structural keys', () => {
    const out = redactAuthConfig({ header: 'X-Api-Key', value: 'secret', token: 'tok', empty: '' }) as Record<string, string>
    expect(out).toEqual({ header: 'X-Api-Key', value: MASK, token: MASK, empty: '' })
  })

  it('keeps token_endpoint wiring and cache state usable by the UI', () => {
    const cfg = {
      pwd: { tokenEndpointId: 7, tokenPath: 'data.token', params: { CLIENT_ID: 'id', PASSWORD: 'p' }, cachedToken: 't', cachedAt: 123 },
      cc: { tokenEndpointId: 8, params: { CLIENT_ID: '' } },
    }
    const out = redactAuthConfig(cfg)
    expect(JSON.stringify(out)).not.toMatch(/"id"|"p"|"t"/)
    expect(hasCachedToken(out)).toBe(true)
    expect(pickModeConfig(out, ['cc', 'pwd'])).toMatchObject({ tokenEndpointId: 7, tokenPath: 'data.token', cachedAt: 123 })
    expect(hasFilledCredentials((out as Record<string, unknown>).cc)).toBe(false)
  })

  it('produces headers without the real secret', () => {
    const out = redactAuthConfig({ username: 'u', password: 'p' })
    expect(buildAuthHeaders({ authType: 'basic', authConfig: out }).Authorization).not.toContain(btoa('u:p'))
  })
})

describe('redactHeaders', () => {
  it('masks auth-like headers only', () => {
    expect(redactHeaders({ Authorization: 'Bearer x', 'X-API-Key': 'k', Cookie: 'c', 'Content-Type': 'application/json' }))
      .toEqual({ Authorization: MASK, 'X-API-Key': MASK, Cookie: MASK, 'Content-Type': 'application/json' })
  })
})

describe('redactBody', () => {
  it('masks credential fields in JSON bodies', () => {
    expect(JSON.parse(redactBody('{"username":"u","password":"p","nested":{"client_secret":"s"},"cnpj":"1"}')!))
      .toEqual({ username: 'u', password: MASK, nested: { client_secret: MASK }, cnpj: '1' })
  })

  it('leaves non-JSON bodies alone', () => {
    expect(redactBody('a=b')).toBe('a=b')
    expect(redactBody(null)).toBeNull()
  })
})

describe('redactExecution', () => {
  it('handles headers stored as JSON string or object', async () => {
    const { redactExecution } = await import('./redact')
    const row = redactExecution({ id: 1, requestHeaders: '{"Authorization":"Bearer x"}', requestBody: '{"token":"t"}' })
    expect(row).toEqual({ id: 1, requestHeaders: `{"Authorization":"${MASK}"}`, requestBody: `{"token":"${MASK}"}` })
    expect(redactExecution({ requestHeaders: { 'X-Api-Key': 'k' } })).toEqual({ requestHeaders: { 'X-Api-Key': MASK } })
    expect(redactExecution(null)).toBeNull()
  })
})
