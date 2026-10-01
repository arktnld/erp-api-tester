import { describe, it, expect } from 'vitest'
import { fieldDefaults, mergeFields } from './fields'

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
