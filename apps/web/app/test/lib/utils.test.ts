import { describe, expect, it } from 'vitest'
import { generateCurl, generateExecutedCurl } from './utils'
import type { Endpoint } from './types'

describe('request preview cURL', () => {
  const endpoint: Endpoint = { id: 2, name: 'Token', method: 'POST', pathTemplate: '/oauth/token', bodyTemplate: '{"client_id":"{CLIENT_ID}"}', headers: '{"X-Client":"{CLIENT_ID}"}', group: '', requiresClient: false, isModification: false, notes: '' }
  const company = { baseUrl: 'https://api.example.com', authType: 'bearer', authConfig: { cc: { params: { CLIENT_ID: 'first' } }, pw: { params: { CLIENT_ID: 'password-grant' } } } }
  const context = { authTemplate: [{ id: 'cc', type: 'token_endpoint', tokenEndpointId: 1, fields: [] }, { id: 'pw', type: 'token_endpoint', tokenEndpointId: 2, fields: [] }] }

  it('resolves body and headers using the token endpoint grant', () => {
    const curl = generateCurl(endpoint, company, {}, undefined, undefined, context)
    expect(curl).toContain('"client_id":"password-grant"')
    expect(curl).toContain("-H 'X-Client: password-grant'")
    expect(curl).not.toContain('{CLIENT_ID}')
  })

  it('uses an edited body, including an intentionally empty body', () => {
    expect(generateCurl(endpoint, company, {}, '{"id":"{CLIENT_ID}"}', undefined, context)).toContain('"id":"password-grant"')
    expect(generateCurl(endpoint, company, {}, '', undefined, context)).not.toContain('-d')
  })
})

describe('cURL of an executed request', () => {
  const request = {
    method: 'POST',
    url: 'https://api.example.com/oauth/token',
    requestHeaders: { 'Content-Type': 'application/json' },
    requestBody: JSON.stringify({ grant_type: 'password', client_id: 'real-id', client_secret: 'real-secret', username: 'user', password: 'pass' }),
  }

  it('copies the resolved OAuth request instead of the endpoint template', () => {
    const curl = generateExecutedCurl(request)!
    expect(curl).toContain("curl -X POST 'https://api.example.com/oauth/token'")
    expect(curl).toContain(`-d '${request.requestBody}'`)
    expect(curl).toContain("-H 'Content-Type: application/json'")
    expect(curl).not.toContain('{CLIENT_ID}')
  })

  it('preserves masking returned for users without secret access', () => {
    const curl = generateExecutedCurl({ ...request, requestBody: '{"client_secret":"****"}' })!
    expect(curl).toContain('****')
    expect(curl).not.toContain('real-secret')
  })

  it('quotes apostrophes in credentials for the shell', () => {
    expect(generateExecutedCurl({ ...request, requestBody: "a'b" })).toContain("-d 'a'\\''b'")
  })

  it('omits an absent body and does not invent a request for validation errors', () => {
    expect(generateExecutedCurl({ ...request, method: 'GET', requestBody: null })).not.toContain('-d')
    expect(generateExecutedCurl({ ...request, url: '' })).toBeUndefined()
  })
})
