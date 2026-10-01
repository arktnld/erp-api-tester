import { describe, it, expect, vi } from 'vitest'

const answers = vi.hoisted(() => ({ list: [] as { address: string; family: number }[] }))
vi.mock('node:dns', () => ({
  lookup: (_h: string, _o: unknown, cb: (e: null, a: typeof answers.list) => void) => cb(null, answers.list),
}))

import { publicOnlyLookup } from './security'

const resolve = (all: boolean) =>
  new Promise<{ err: Error | null; value: unknown }>((done) =>
    publicOnlyLookup('erp.example.com', { all }, (err, value) => done({ err, value })))

describe('publicOnlyLookup', () => {
  it('rejeita hostname que resolve para IP privado (DNS rebinding)', async () => {
    answers.list = [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]
    expect((await resolve(false)).err?.message).toContain('bloqueada')
  })
  it('aceita hostname público nos dois formatos de callback', async () => {
    answers.list = [{ address: '93.184.216.34', family: 4 }]
    expect(await resolve(false)).toEqual({ err: null, value: '93.184.216.34' })
    expect((await resolve(true)).value).toEqual(answers.list)
  })
})
