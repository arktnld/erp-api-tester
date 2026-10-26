import { describe, expect, it } from 'vitest'
import { generateExecutedCurl } from './utils'

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
