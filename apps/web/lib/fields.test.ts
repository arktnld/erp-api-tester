import { describe, it, expect } from 'vitest'
import { fieldDefaults, mergeFields, resolveBodyTemplate } from './fields'
import { substitute } from './utils'
import { redactAuthConfig } from './redact'

describe('OAuth request previews', () => {
  it('removes unfilled body auth fields when another mode is used', () => {
    const authTemplate = [{ id: 'body', type: 'body_fields', fields: [{ key: 'token' }, { key: 'app' }] }]
    expect(JSON.parse(resolveBodyTemplate('{"token":"{token}","app":"{app}","limit":2}', {}, authTemplate))).toEqual({ limit: 2 })
    expect(JSON.parse(resolveBodyTemplate('{"token":"{token}"}', { token: 'filled' }, authTemplate))).toEqual({ token: 'filled' })
  })
  const params = { CLIENT_ID: 'id', CLIENT_SECRET: 'secret', USERNAME: 'user', PASSWORD: 'pass' }
  const template = JSON.stringify({ client_id: '{CLIENT_ID}', client_secret: '{CLIENT_SECRET}', username: '{USERNAME}', password: '{PASSWORD}' })
  const company = { authType: 'token_endpoint', authConfig: { tokenEndpointId: 1, params } }

  it('reads flat OAuth params rather than treating params as an auth mode', () => {
    expect(JSON.parse(substitute(template, mergeFields({}, company)))).toEqual({ client_id: 'id', client_secret: 'secret', username: 'user', password: 'pass' })
  })

  it('selects the token endpoint own grant using the current ERP template', () => {
    const authTemplate = [
      { id: 'cc', type: 'token_endpoint', fields: [], tokenEndpointId: 1 },
      { id: 'pw', type: 'token_endpoint', fields: [], tokenEndpointId: 2 },
    ]
    const authConfig = { cc: { params: { CLIENT_ID: 'cc-id' } }, pw: { params } }
    const context = { authTemplate, endpoint: { id: 2 } }
    expect(mergeFields({}, { authType: 'bearer', authConfig }, {}, context)).toMatchObject(params)
    expect(mergeFields({}, { authType: 'bearer', authConfig }, {}, { ...context, endpoint: { id: 3, authMode: 'pw' } })).toMatchObject(params)
    expect(mergeFields({}, { authType: 'bearer', authConfig: redactAuthConfig(authConfig) }, {}, context)).toMatchObject({ CLIENT_ID: '****', PASSWORD: '****' })
  })

  it('falls back to the filled grant and includes defaults and cached tokens', () => {
    const authConfig = { cc: { params: { CLIENT_ID: '' } }, pw: { params, cachedToken: 'cached' } }
    expect(mergeFields({}, { authType: 'token_endpoint', authConfig }, { limit: '2' })).toMatchObject({ ...params, token: 'cached', TOKEN: 'cached', limit: '2' })
  })
})

describe('mergeFields', () => {
  it('body_fields: merges auth fields into client fields (auth wins on conflict)', () => {
    const result = mergeFields(
      { id: '42' },
      { authType: 'body_fields', authConfig: { token: 'xyz' } }
    )
    expect(result).toEqual({ id: '42', token: 'xyz' })
  })

  it('body_fields: auth config overrides client field on key conflict', () => {
    const result = mergeFields(
      { token: 'client-token' },
      { authType: 'body_fields', authConfig: { token: 'auth-token' } }
    )
    expect(result).toEqual({ token: 'auth-token' })
  })

  it('non-body_fields auth: returns client fields unchanged', () => {
    const result = mergeFields(
      { id: '1' },
      { authType: 'bearer', authConfig: { token: 'tok' } }
    )
    expect(result).toEqual({ id: '1' })
  })

  it('null company: returns client fields unchanged', () => {
    expect(mergeFields({ id: '1' }, null)).toEqual({ id: '1' })
  })

  it('empty client fields + body_fields: returns auth config', () => {
    const result = mergeFields(
      {},
      { authType: 'body_fields', authConfig: { token: 'xyz' } }
    )
    expect(result).toEqual({ token: 'xyz' })
  })
})

describe('field default values', () => {
  const defaults = fieldDefaults([
    { fieldName: 'wifi_ssid', defaultValue: 'ERP-TESTER' },
    { fieldName: 'cpfcnpj', defaultValue: '' },
  ])

  it('only keeps fields that have a default', () => {
    expect(defaults).toEqual({ wifi_ssid: 'ERP-TESTER' })
  })

  it('fills a missing or empty value, but the client value wins', () => {
    expect(mergeFields({}, null, defaults).wifi_ssid).toBe('ERP-TESTER')
    expect(mergeFields({ wifi_ssid: '' }, null, defaults).wifi_ssid).toBe('ERP-TESTER')
    expect(mergeFields({ wifi_ssid: 'Minha-Rede' }, null, defaults).wifi_ssid).toBe('Minha-Rede')
  })

  it('keeps empty values of fields without a default', () => {
    expect(mergeFields({ nome: '' }, null, defaults)).toEqual({ nome: '', wifi_ssid: 'ERP-TESTER' })
  })
})
