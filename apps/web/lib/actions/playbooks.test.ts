import { describe, it, expect } from 'vitest'
import { extractFields } from '../playbook-utils'

describe('extractFields', () => {
  it('returns empty for null capture', () => {
    expect(extractFields({ data: 'x' }, null)).toEqual({})
  })

  it('returns empty for invalid JSON capture', () => {
    expect(extractFields({ data: 'x' }, 'not-json')).toEqual({})
  })

  it('extracts simple dot-notation path', () => {
    const body = { data: { access_token: 'abc123' } }
    const capture = '{"token": "data.access_token"}'
    expect(extractFields(body, capture)).toEqual({ token: 'abc123' })
  })

  it('extracts array index path', () => {
    const body = { data: [{ id: '456' }] }
    const capture = '{"id": "data[0].id"}'
    expect(extractFields(body, capture)).toEqual({ id: '456' })
  })

  it('extracts multiple fields', () => {
    const body = { access_token: 'tok', user: { id: 42 } }
    const capture = '{"token": "access_token", "userId": "user.id"}'
    expect(extractFields(body, capture)).toEqual({ token: 'tok', userId: '42' })
  })

  it('skips missing paths silently', () => {
    const body = { data: {} }
    const capture = '{"token": "data.missing.path"}'
    expect(extractFields(body, capture)).toEqual({})
  })
})

describe('runAssertions', async () => {
  const { runAssertions } = await import('../playbook-utils')
  const res = { status: 200, headers: { 'content-type': 'application/json' }, body: { status: 'erro', total: 3, data: [{ id: 7 }], msg: 'Cliente encontrado', vazio: [] } }
  const ok = (text: string) => runAssertions(text, res).map((r) => r.ok)

  it('passes and fails the basic comparisons', () => {
    expect(ok('status eq 200\nbody.total gt 2\nbody.total lte 3\nbody.data[0].id eq 7')).toEqual([true, true, true, true])
    expect(ok('body.status neq "erro"\nstatus eq 201')).toEqual([false, false])
  })

  it('supports presence, emptiness, contains and headers', () => {
    expect(ok('body.data[0].id isDefined\nbody.nope isUndefined\nbody.vazio isEmpty\nbody.data isNotEmpty')).toEqual([true, true, true, true])
    expect(ok('body.msg contains encontrado\nbody.msg notContains erro\nheaders.Content-Type contains json')).toEqual([true, true, true])
  })

  it('reports actual values and malformed lines, ignoring comments', () => {
    const [r] = runAssertions('body.status eq "ok"', res)
    expect(r).toMatchObject({ ok: false, actual: '"erro"' })
    expect(runAssertions('# comentário\n\nfoo eq 1\nstatus bogus 1\nstatus eq', res).map((r) => r.error)).toEqual([
      'alvo desconhecido: foo', 'operador desconhecido: bogus', 'eq precisa de um valor',
    ])
  })
})
