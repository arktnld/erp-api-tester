import { describe, it, expect } from 'vitest'
import { bodyError, connected } from './connection-check'

const r = (statusCode: number, body: unknown) => ({ statusCode, durationMs: 1, responseBody: typeof body === 'string' ? body : JSON.stringify(body) })

describe('connection check', () => {
  it('an API refusing with HTTP 200 is not connected, and the message comes through', () => {
    const mk = { Mensagem: 'Token não localizado.', 'Num. ERRO': '002', status: 'ERRO' }
    expect(connected(r(200, mk), 'Token')).toBe(false)
    expect(bodyError(mk)).toBe('Token não localizado.')
  })

  it('a token endpoint must actually return the token', () => {
    expect(connected(r(200, { Token: 'abc', status: 'OK' }), 'Token')).toBe(true)
    expect(connected(r(200, { access_token: 'x' }), 'access_token')).toBe(true)
    expect(connected(r(200, { other: 1 }), 'access_token')).toBe(false)
  })

  it('treats error markers and non-2xx as failures', () => {
    expect(connected(r(200, { type: 'error', message: 'Usuário inválido' }))).toBe(false)
    expect(connected(r(200, { success: false }))).toBe(false)
    expect(connected(r(401, { ok: true }))).toBe(false)
    expect(connected(r(200, { registros: [] }))).toBe(true)
    expect(connected(r(200, [{ id: 1 }]))).toBe(true)
    expect(connected(r(200, 'not json'))).toBe(true)
  })
})
