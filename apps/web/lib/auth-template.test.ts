import { describe, it, expect } from 'vitest'
import { getAuthModes } from './auth'
import { fieldsForType, toAuthTemplate, validateAuthModes } from './auth-template'

const f = (key: string) => ({ key, label: key })

describe('toAuthTemplate', () => {
  it('keeps each stored shape when nothing changed', () => {
    const flat = { type: 'basic', label: 'Basic', fields: [f('username'), f('password')] }
    const list = [
      { id: 'default', type: 'body_fields', label: 'Token + app', fields: [f('token'), f('app')] },
      { id: 'basic', type: 'basic', label: 'Basic', fields: [f('username'), f('password')] },
    ]
    const token = { type: 'token_endpoint', label: 'OAuth', fields: [f('CLIENT_ID')], tokenEndpointId: 3, tokenPath: 'access_token' }
    for (const t of [flat, list, token, {}]) expect(toAuthTemplate(getAuthModes(t))).toEqual(t)
  })

  it('stores a single mode with its own id as a list, so the id is kept', () => {
    expect(toAuthTemplate([{ id: 'token_app', type: 'body_fields', label: 'T', fields: [f('token')] }])).toEqual([
      { id: 'token_app', type: 'body_fields', label: 'T', fields: [f('token')] },
    ])
  })
})

describe('fieldsForType', () => {
  it('gives the fixed keys a type reads, keeping labels already set', () => {
    expect(fieldsForType('basic', [{ key: 'username', label: 'Login' }]).map((x) => [x.key, x.label])).toEqual([['username', 'Login'], ['password', 'Senha']])
  })

  it('keeps free fields for types without fixed keys', () => {
    expect(fieldsForType('custom_headers', [f('X-API-KEY')])).toEqual([f('X-API-KEY')])
  })
})

describe('validateAuthModes', () => {
  const ok = { id: 'default', type: 'bearer', label: 'Token', fields: [f('token')] }

  it('accepts a complete mode', () => {
    expect(validateAuthModes([ok], [])).toEqual([])
  })

  it('reports missing/duplicate ids, token endpoint without endpoint or path, bad and repeated keys', () => {
    const errors = validateAuthModes([
      { ...ok, id: '' },
      ok,
      { ...ok, label: 'Dup' },
      { id: 'tk', type: 'token_endpoint', label: 'Tk', fields: [], tokenPath: '' },
      { id: 'h', type: 'custom_headers', label: 'H', fields: [f('X A'), f('X-B'), f('X-B')] },
      { id: 'e', type: 'body_fields', label: 'E', fields: [] },
    ], [{ id: 1 }])
    expect(errors).toEqual([
      'Token: falta o ID.',
      'Dup: o ID "default" já existe.',
      'Tk: escolha o endpoint que devolve o token.',
      'Tk: informe onde o token vem na resposta.',
      'H: a chave "X A" é inválida.',
      'H: a chave "X-B" está repetida.',
      'E: adicione pelo menos um campo.',
    ])
  })
})
