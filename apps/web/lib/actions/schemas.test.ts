import { describe, it, expect } from 'vitest'
import { ERPSchema, CompanySchema, EndpointSchema, TestClientSchema, ExecuteSchema } from './schemas'

describe('ERPSchema', () => {
  it('accepts valid data', () => {
    expect(() => ERPSchema.parse({ name: 'TOTVS' })).not.toThrow()
  })
  it('rejects empty name', () => {
    expect(() => ERPSchema.parse({ name: '' })).toThrow()
  })
  it('rejects missing name', () => {
    expect(() => ERPSchema.parse({})).toThrow()
  })
})

describe('CompanySchema', () => {
  const valid = { name: 'Empresa X', erpId: 1, baseUrl: 'https://api.example.com', environments: '[]', authType: 'bearer', authConfig: '{}' }
  it('accepts valid data', () => {
    expect(() => CompanySchema.parse(valid)).not.toThrow()
  })
  it('rejects invalid url', () => {
    expect(() => CompanySchema.parse({ ...valid, baseUrl: 'not-a-url' })).toThrow()
  })

  it('rejects a base URL with a stray quote or space in the host (every call would fail with ENOTFOUND)', () => {
    for (const baseUrl of ["https://erp.example.com'", 'https://erp.example.com"', 'https://erp example.com', 'ftp://erp.example.com', 'https://']) {
      expect(() => CompanySchema.parse({ ...valid, baseUrl }), baseUrl).toThrow()
    }
  })

  it('accepts ports and paths, and stores the base URL trimmed and without the trailing slash', () => {
    expect(CompanySchema.parse({ ...valid, baseUrl: '  https://erp.example.com:8443/api/v1/ ' }).baseUrl).toBe('https://erp.example.com:8443/api/v1')
    expect(CompanySchema.parse({ ...valid, baseUrl: 'http://10.0.0.5:9000' }).baseUrl).toBe('http://10.0.0.5:9000')
  })
  it('rejects invalid authType', () => {
    expect(() => CompanySchema.parse({ ...valid, authType: 'magic' })).toThrow()
  })
  it('rejects empty name', () => {
    expect(() => CompanySchema.parse({ ...valid, name: '' })).toThrow()
  })
})

describe('EndpointSchema', () => {
  const valid = { erpId: 1, name: 'Listar', method: 'GET', pathTemplate: '/api/v1/list', bodyTemplate: '', headers: '{}', group: '', requiresClient: true, isModification: false }
  it('accepts valid data', () => {
    expect(() => EndpointSchema.parse(valid)).not.toThrow()
  })
  it('rejects invalid method', () => {
    expect(() => EndpointSchema.parse({ ...valid, method: 'CONNECT' })).toThrow()
  })
  it('rejects empty pathTemplate', () => {
    expect(() => EndpointSchema.parse({ ...valid, pathTemplate: '' })).toThrow()
  })
  it('accepts all valid methods', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() => EndpointSchema.parse({ ...valid, method })).not.toThrow()
    }
  })
})

describe('TestClientSchema', () => {
  const valid = { name: 'Cliente Teste', companyId: 1, fieldsData: '{}' }
  it('accepts valid data', () => {
    expect(() => TestClientSchema.parse(valid)).not.toThrow()
  })
  it('rejects empty name', () => {
    expect(() => TestClientSchema.parse({ ...valid, name: '' })).toThrow()
  })
  it('rejects non-positive companyId', () => {
    expect(() => TestClientSchema.parse({ ...valid, companyId: 0 })).toThrow()
  })
})

describe('ExecuteSchema', () => {
  it('accepts minimal payload', () => {
    expect(() => ExecuteSchema.parse({ endpointId: 1 })).not.toThrow()
  })
  it('rejects invalid endpointId', () => {
    expect(() => ExecuteSchema.parse({ endpointId: 0 })).toThrow()
  })
  it('rejects invalid environmentUrl', () => {
    expect(() => ExecuteSchema.parse({ endpointId: 1, environmentUrl: 'not-url' })).toThrow()
  })
  it('accepts valid environmentUrl', () => {
    expect(() => ExecuteSchema.parse({ endpointId: 1, environmentUrl: 'https://staging.api.com' })).not.toThrow()
  })
  it('accepts null clientId', () => {
    expect(() => ExecuteSchema.parse({ endpointId: 1, clientId: null })).not.toThrow()
  })
})
