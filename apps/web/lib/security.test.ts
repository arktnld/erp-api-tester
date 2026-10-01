import { describe, it, expect } from 'vitest'
import { validatePublicUrl } from './security'

describe('validatePublicUrl', () => {
  it('permite URLs públicas', () => {
    expect(() => validatePublicUrl('https://api.totvs.com.br/v1')).not.toThrow()
    expect(() => validatePublicUrl('http://erp.empresa.com/api')).not.toThrow()
  })
  it('bloqueia localhost', () => {
    expect(() => validatePublicUrl('http://localhost:3000')).toThrow('bloqueada')
    expect(() => validatePublicUrl('http://127.0.0.1:8080')).toThrow('bloqueada')
  })
  it('bloqueia ranges privados', () => {
    expect(() => validatePublicUrl('http://10.0.0.1')).toThrow('bloqueada')
    expect(() => validatePublicUrl('http://192.168.1.1')).toThrow('bloqueada')
    expect(() => validatePublicUrl('http://172.16.0.1')).toThrow('bloqueada')
    expect(() => validatePublicUrl('http://169.254.169.254')).toThrow('bloqueada')
  })
  it('bloqueia esquemas não-HTTP', () => {
    expect(() => validatePublicUrl('file:///etc/passwd')).toThrow()
    expect(() => validatePublicUrl('ftp://server.com')).toThrow()
  })
  it('rejeita URL inválida', () => {
    expect(() => validatePublicUrl('not-a-url')).toThrow()
  })
})

describe('validatePublicUrl — IPv6 e ranges extras', () => {
  it('bloqueia IPv6 privado entre colchetes e IPv4 mapeado', () => {
    for (const u of ['http://[::1]:8080/', 'http://[fc00::1]/', 'http://[fd12::1]/', 'http://[fe80::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[::]/'])
      expect(() => validatePublicUrl(u), u).toThrow('bloqueada')
  })
  it('bloqueia 0.0.0.0/8, CGNAT e *.localhost', () => {
    for (const u of ['http://0.1.2.3/', 'http://100.64.0.1/', 'http://api.localhost/'])
      expect(() => validatePublicUrl(u), u).toThrow('bloqueada')
  })
  it('permite IPv6 público', () => {
    expect(() => validatePublicUrl('http://[2606:4700::1111]/')).not.toThrow()
  })
})
