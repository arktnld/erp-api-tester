import { describe, it, expect } from 'vitest'
import { CookieJar } from './cookie-jar'

const now = 1_000_000

describe('CookieJar', () => {
  it('sends back a session cookie to the same host', () => {
    const jar = new CookieJar()
    jar.store(['SESSID=abc; Path=/; HttpOnly'], 'https://erp.example.com/login', now)
    expect(jar.header('https://erp.example.com/api/clientes', now)).toBe('SESSID=abc')
  })

  it('keeps host-only cookies off other hosts and honors Domain', () => {
    const jar = new CookieJar()
    jar.store('a=1', 'https://erp.example.com/', now)
    jar.store('b=2; Domain=example.com', 'https://erp.example.com/', now)
    expect(jar.header('https://api.example.com/', now)).toBe('b=2')
    expect(jar.header('https://erp.example.com/', now)).toBe('a=1; b=2')
  })

  it('rejects cookies for a foreign domain', () => {
    const jar = new CookieJar()
    jar.store('evil=1; Domain=attacker.net', 'https://erp.example.com/', now)
    expect(jar.header('https://attacker.net/', now)).toBeUndefined()
    expect(jar.header('https://erp.example.com/', now)).toBeUndefined()
  })

  it('matches paths, Secure and expiry', () => {
    const jar = new CookieJar()
    jar.store(['p=1; Path=/api', 's=1; Secure', 'old=1; Max-Age=10'], 'https://erp.example.com/', now)
    expect(jar.header('https://erp.example.com/apix', now)).toBe('s=1; old=1')
    expect(jar.header('http://erp.example.com/api/x', now)).toBe('p=1; old=1')
    expect(jar.header('https://erp.example.com/', now + 11_000)).toBe('s=1')
  })

  it('removes a cookie on Max-Age=0 (logout)', () => {
    const jar = new CookieJar()
    jar.store('SESSID=abc', 'https://erp.example.com/', now)
    jar.store('SESSID=; Max-Age=0', 'https://erp.example.com/', now)
    expect(jar.header('https://erp.example.com/', now)).toBeUndefined()
  })

  it('survives a JSON round trip (shared between app instances) and drops junk', () => {
    const jar = new CookieJar()
    expect(jar.changed).toBe(false)
    jar.store('SESSID=abc; Path=/', 'https://erp.example.com/login', now)
    expect(jar.changed).toBe(true)
    const saved = JSON.parse(JSON.stringify([...jar.toJSON(), { name: 'x' }, 'junk']))
    const restored = new CookieJar(saved)
    expect(restored.toJSON()).toHaveLength(1)
    expect(restored.changed).toBe(false)
    expect(restored.header('https://erp.example.com/api', now)).toBe('SESSID=abc')
    expect(new CookieJar('not an array').toJSON()).toEqual([])
  })
})
