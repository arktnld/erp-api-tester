import { describe, it, expect } from 'vitest'
import { DUMMY_HASH, generatePassword, hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse')
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(await verifyPassword('correct horse', hash)).toBe(true)
    expect(await verifyPassword('correct horsE', hash)).toBe(false)
  })

  it('salts: the same password hashes differently', async () => {
    expect(await hashPassword('x'.repeat(10))).not.toBe(await hashPassword('x'.repeat(10)))
  })

  it('rejects malformed hashes and never matches the dummy hash', async () => {
    expect(await verifyPassword('a', 'bcrypt$whatever')).toBe(false)
    expect(await verifyPassword('a', '')).toBe(false)
    expect(await verifyPassword('', DUMMY_HASH)).toBe(false)
  })

  it('generates 16-char random passwords', () => {
    const a = generatePassword()
    expect(a).toHaveLength(16)
    expect(a).not.toBe(generatePassword())
  })
})
