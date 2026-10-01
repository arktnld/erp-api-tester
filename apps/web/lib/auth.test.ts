import { describe, it, expect } from 'vitest'
import { buildAuthHeaders, buildAuthBodyFields, getModeCredentials, pickModeConfig, withTokenCache, hasCachedToken, resolveAuth, withTokenCacheFor } from './auth'

const bearer     = { authType: 'bearer',        authConfig: { token: 'tok123' } }
const apiKey     = { authType: 'api_key',        authConfig: { header: 'X-Key', value: 'abc' } }
const basic      = { authType: 'basic',          authConfig: { username: 'user', password: 'pass' } }
const custom     = { authType: 'custom_headers', authConfig: { 'X-A': '1', 'X-B': '2' } }
const bodyFields = { authType: 'body_fields',    authConfig: { token: 'xyz', user: 'admin' } }
const none       = { authType: 'none',           authConfig: {} }
const nullAuth   = { authType: null,             authConfig: null }

describe('buildAuthHeaders', () => {
  it('bearer → Authorization: Bearer <token>', () => {
    expect(buildAuthHeaders(bearer)).toEqual({ Authorization: 'Bearer tok123' })
  })
  it('api_key → custom header: value', () => {
    expect(buildAuthHeaders(apiKey)).toEqual({ 'X-Key': 'abc' })
  })
  it('basic → Authorization: Basic base64', () => {
    expect(buildAuthHeaders(basic)).toEqual({ Authorization: `Basic ${btoa('user:pass')}` })
  })
  it('custom_headers → spreads all entries from authConfig', () => {
    expect(buildAuthHeaders(custom)).toEqual({ 'X-A': '1', 'X-B': '2' })
  })
  it('body_fields → empty (fields go in body, not headers)', () => {
    expect(buildAuthHeaders(bodyFields)).toEqual({})
  })
  it('none → empty', () => {
    expect(buildAuthHeaders(none)).toEqual({})
  })
  it('null authType → empty', () => {
    expect(buildAuthHeaders(nullAuth)).toEqual({})
  })
})

describe('buildAuthBodyFields', () => {
  it('body_fields → returns authConfig as fields', () => {
    expect(buildAuthBodyFields(bodyFields)).toEqual({ token: 'xyz', user: 'admin' })
  })
  it('other authType → empty object', () => {
    expect(buildAuthBodyFields(bearer)).toEqual({})
    expect(buildAuthBodyFields(none)).toEqual({})
  })
  it('null authType → empty object', () => {
    expect(buildAuthBodyFields(nullAuth)).toEqual({})
  })
})

describe('getModeCredentials', () => {
  // Mirrors the SGP ERP: body_fields ('default') + basic ('basic')
  const modeIds = ['default', 'basic']
  const keyed = {
    default: { app: 'cortex', token: 'tok123' },
    basic: { username: 'user', password: 'pass' },
  }
  const legacyFlat = { app: 'cortex', token: 'tok123' }

  it('keyed format → returns the requested mode', () => {
    expect(getModeCredentials(keyed, 'default', modeIds)).toEqual({ app: 'cortex', token: 'tok123' })
    expect(getModeCredentials(keyed, 'basic', modeIds)).toEqual({ username: 'user', password: 'pass' })
  })

  it('keyed format, mode absent from config → empty object', () => {
    expect(getModeCredentials({ default: legacyFlat }, 'basic', modeIds)).toEqual({})
  })

  it('legacy flat format → belongs to the first mode', () => {
    expect(getModeCredentials(legacyFlat, 'default', modeIds)).toEqual(legacyFlat)
  })

  it('legacy flat format → empty for any non-first mode', () => {
    // Regression: previously returned { app, token } for the 'basic' mode, which
    // buildAuthHeadersForMode then dropped, silently sending no Authorization.
    expect(getModeCredentials(legacyFlat, 'basic', modeIds)).toEqual({})
  })

  it('single-mode ERP with flat config → returns the config', () => {
    expect(getModeCredentials({ username: 'user', password: 'pass' }, 'default', ['default'])).toEqual({
      username: 'user',
      password: 'pass',
    })
  })

  it('no modes declared → returns the config unchanged', () => {
    expect(getModeCredentials(legacyFlat, 'default', [])).toEqual(legacyFlat)
  })

  it('null or non-object config → empty object', () => {
    expect(getModeCredentials(null, 'default', modeIds)).toEqual({})
    expect(getModeCredentials('{"token":"x"}', 'default', modeIds)).toEqual({})
  })
})

describe('pickModeConfig', () => {
  // Mirrors Voalle: two token_endpoint grants, only one filled per company
  const modeIds = ['client_credentials', 'password']
  const ccFilled = { tokenEndpointId: 1, tokenPath: 'access_token', params: { CLIENT_ID: 'abc', CLIENT_SECRET: 's' } }
  const ccBlank = { tokenEndpointId: 1, tokenPath: 'access_token', params: { CLIENT_ID: '', CLIENT_SECRET: '' } }
  const pwFilled = { tokenEndpointId: 2, tokenPath: 'access_token', params: { USERNAME: 'joe', PASSWORD: 'p' } }
  const pwBlank = { tokenEndpointId: 2, tokenPath: 'access_token', params: { USERNAME: '', PASSWORD: '' } }

  it('picks the only mode that has credentials filled in', () => {
    // The form always writes every declared mode, so the blank one must lose.
    expect(pickModeConfig({ client_credentials: ccBlank, password: pwFilled }, modeIds)).toEqual(pwFilled)
    expect(pickModeConfig({ client_credentials: ccFilled, password: pwBlank }, modeIds)).toEqual(ccFilled)
  })

  it('both filled → first declared mode wins', () => {
    expect(pickModeConfig({ client_credentials: ccFilled, password: pwFilled }, modeIds)).toEqual(ccFilled)
  })

  it('none filled → falls back to the first declared mode', () => {
    expect(pickModeConfig({ client_credentials: ccBlank, password: pwBlank }, modeIds)).toEqual(ccBlank)
  })

  it('single-mode ERP → returns that mode config', () => {
    expect(pickModeConfig({ default: ccFilled }, ['default'])).toEqual(ccFilled)
  })

  it('legacy flat config (not keyed by mode) → returned as-is', () => {
    const flat = { tokenEndpointId: 9, tokenPath: 'token', params: { SYS: 'x' } }
    expect(pickModeConfig(flat, modeIds)).toEqual(flat)
  })

  it('ERP with no declared modes → returns the raw config', () => {
    const flat = { tokenEndpointId: 9, params: { SYS: 'x' } }
    expect(pickModeConfig(flat, [])).toEqual(flat)
  })

  it('ignores whitespace-only credentials', () => {
    const ccWhitespace = { ...ccBlank, params: { CLIENT_ID: '   ', CLIENT_SECRET: '' } }
    expect(pickModeConfig({ client_credentials: ccWhitespace, password: pwFilled }, modeIds)).toEqual(pwFilled)
  })

  it('null or non-object config → empty object', () => {
    expect(pickModeConfig(null, modeIds)).toEqual({})
    expect(pickModeConfig('nope', modeIds)).toEqual({})
  })
})

describe('withTokenCache', () => {
  const modeIds = ['client_credentials', 'password']
  const ccBlank = { tokenEndpointId: 1, tokenPath: 'access_token', params: { CLIENT_ID: '', CLIENT_SECRET: '' } }
  const pwFilled = { tokenEndpointId: 2, tokenPath: 'access_token', params: { USERNAME: 'joe', PASSWORD: 'p' } }
  const patch = { cachedToken: 'tok', cachedAt: 1700000000 }

  it('writes into the active mode and preserves the other modes', () => {
    // The regression this guards: saveTokenCache used to replace the whole
    // authConfig, so caching a token wiped the sibling grant's credentials.
    const result = withTokenCache({ client_credentials: ccBlank, password: pwFilled }, modeIds, patch)

    expect(result.password).toEqual({ ...pwFilled, ...patch })
    expect(result.client_credentials).toEqual(ccBlank)
  })

  it('keeps the keyed shape (does not flatten to a single mode)', () => {
    const result = withTokenCache({ client_credentials: ccBlank, password: pwFilled }, modeIds, patch)
    expect(Object.keys(result).sort()).toEqual(['client_credentials', 'password'])
  })

  it('legacy flat config → patch merged at the top level', () => {
    const flat = { tokenEndpointId: 9, tokenPath: 'token', params: { SYS: 'x' } }
    expect(withTokenCache(flat, modeIds, patch)).toEqual({ ...flat, ...patch })
  })

  it('ERP with no declared modes → patch merged at the top level', () => {
    const flat = { tokenEndpointId: 9, params: { SYS: 'x' } }
    expect(withTokenCache(flat, [], patch)).toEqual({ ...flat, ...patch })
  })

  it('overwrites a stale token in place', () => {
    const stale = { password: { ...pwFilled, cachedToken: 'old', cachedAt: 1 } }
    const result = withTokenCache(stale, modeIds, patch) as { password: Record<string, unknown> }
    expect(result.password.cachedToken).toBe('tok')
    expect(result.password.cachedAt).toBe(1700000000)
    expect(result.password.params).toEqual(pwFilled.params)
  })

  it('null config → just the patch', () => {
    expect(withTokenCache(null, modeIds, patch)).toEqual(patch)
  })
})

describe('hasCachedToken', () => {
  it('flat single-mode config with a token → true', () => {
    expect(hasCachedToken({ tokenEndpointId: 1, cachedToken: 'tok' })).toBe(true)
  })

  it('keyed config with a token nested in a mode → true', () => {
    expect(hasCachedToken({ client_credentials: { params: {}, cachedToken: 'tok' }, password: { params: {} } })).toBe(true)
  })

  it('no token anywhere → false', () => {
    expect(hasCachedToken({ client_credentials: { params: { CLIENT_ID: 'x' } }, password: { params: {} } })).toBe(false)
    expect(hasCachedToken({ tokenEndpointId: 1 })).toBe(false)
  })

  it('empty-string token → false', () => {
    expect(hasCachedToken({ cachedToken: '' })).toBe(false)
    expect(hasCachedToken({ mode: { cachedToken: '' } })).toBe(false)
  })

  it('null or non-object → false', () => {
    expect(hasCachedToken(null)).toBe(false)
    expect(hasCachedToken('tok')).toBe(false)
  })
})

describe('token lifetime', async () => {
  const { isTokenFresh, hasCachedToken, tokenCacheEntry } = await import('./auth')
  const now = 1_000_000

  it('reads expires_in next to the token or at the root', () => {
    expect(tokenCacheEntry({ access_token: 't', expires_in: 3600 }, 'access_token', 't', now)).toEqual({ cachedToken: 't', cachedAt: now, expiresAt: now + 3_600_000 })
    expect(tokenCacheEntry({ data: { token: 't', expiresIn: 60 } }, 'data.token', 't', now).expiresAt).toBe(now + 60_000)
    expect(tokenCacheEntry({ token: 't' }, 'token', 't', now)).toEqual({ cachedToken: 't', cachedAt: now })
  })

  it('treats a token as stale one minute before expiry', () => {
    expect(isTokenFresh({ cachedToken: 't', expiresAt: now + 61_000 }, now)).toBe(true)
    expect(isTokenFresh({ cachedToken: 't', expiresAt: now + 59_000 }, now)).toBe(false)
    expect(isTokenFresh({ cachedToken: 't' }, now)).toBe(true)
    expect(isTokenFresh({ cachedToken: '' }, now)).toBe(false)
  })

  it('hasCachedToken ignores expired tokens in any mode', () => {
    expect(hasCachedToken({ pwd: { cachedToken: 't', expiresAt: now - 1 } }, now)).toBe(false)
    expect(hasCachedToken({ pwd: { cachedToken: 't', expiresAt: now + 3_600_000 } }, now)).toBe(true)
  })
})

describe('resolveAuth', () => {
  const sgp = [
    { id: 'default', type: 'body_fields', label: 'Token + app', fields: [{ key: 'token', label: 'Token' }, { key: 'app', label: 'App' }] },
    { id: 'basic', type: 'basic', label: 'Basic', fields: [{ key: 'username', label: 'Usuário' }, { key: 'password', label: 'Senha' }] },
  ]

  it('uses the endpoint mode when it names one, else the first mode with credentials', () => {
    const cfg = { default: { token: 't', app: 'a' }, basic: { username: 'u', password: 'p' } }
    expect(resolveAuth(sgp, cfg)?.mode.id).toBe('default')
    expect(resolveAuth(sgp, cfg, 'basic')?.creds).toEqual({ username: 'u', password: 'p' })
    expect(resolveAuth(sgp, { default: { token: '', app: '' }, basic: { username: 'u', password: 'p' } })?.mode.id).toBe('basic')
  })

  it('reads legacy flat credentials as the first mode, even after a second mode was added', () => {
    const r = resolveAuth(sgp, { token: 't', app: 'a' })
    expect(r).toMatchObject({ mode: { id: 'default' }, creds: { token: 't', app: 'a' }, keyed: false })
    expect(resolveAuth(sgp, { token: 't', app: 'a' }, 'basic')?.creds).toEqual({})
  })

  it('takes type, token endpoint and token path from the ERP, not from the company copy', () => {
    const tpl = { type: 'token_endpoint', label: 'OAuth', fields: [], tokenEndpointId: 5, tokenPath: 'data.token' }
    const r = resolveAuth(tpl, { tokenEndpointId: 2, tokenPath: 'token', params: { ID: 'x' } }, null, 'bearer')
    expect(r?.mode).toMatchObject({ type: 'token_endpoint', tokenEndpointId: 5, tokenPath: 'data.token' })
  })

  it('falls back to the company type only when the ERP declares no mode', () => {
    expect(resolveAuth(null, { token: 't' }, null, 'bearer')?.mode.type).toBe('bearer')
    expect(resolveAuth(null, {}, null, 'none')).toBeNull()
  })
})

describe('withTokenCacheFor', () => {
  it('writes the token into the given mode, keeping the others', () => {
    const cfg = { a: { params: { x: '1' } }, b: { params: { y: '2' } } }
    const auth = { mode: { id: 'b', type: 'token_endpoint', label: '', fields: [] }, creds: cfg.b, keyed: true }
    expect(withTokenCacheFor(cfg, auth, { cachedToken: 'T' })).toEqual({ a: { params: { x: '1' } }, b: { params: { y: '2' }, cachedToken: 'T' } })
  })
})
