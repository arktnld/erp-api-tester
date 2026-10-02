import { describe, it, expect } from 'vitest'
import { buildGraphqlBody, parseGraphqlBody } from './graphql-body'

describe('GraphQL body', () => {
  it('splits a GraphQL JSON body into query and variables', () => {
    expect(parseGraphqlBody('{"query":"query($c: ID!) { country(code: $c) { name } }","variables":{"c":"BR"}}'))
      .toEqual({ query: 'query($c: ID!) { country(code: $c) { name } }', variables: '{\n  "c": "BR"\n}' })
    expect(parseGraphqlBody('{"query":"{ x }","variables":{}}')).toEqual({ query: '{ x }', variables: '' })
  })

  it('does not take other bodies for GraphQL', () => {
    expect(parseGraphqlBody('{"name":"x"}')).toBeNull()
    expect(parseGraphqlBody('<soap:Envelope/>')).toBeNull()
    expect(parseGraphqlBody('[{"query":"{ x }"}]')).toBeNull()
  })

  it('builds the body back, with placeholders kept inside strings', () => {
    const r = buildGraphqlBody('{ user(id: "{id}") { name } }', '{"lang": "{lang}"}')
    expect('body' in r && JSON.parse(r.body)).toEqual({ query: '{ user(id: "{id}") { name } }', variables: { lang: '{lang}' } })
    expect(buildGraphqlBody('{ x }', '')).toEqual({ body: '{\n  "query": "{ x }"\n}' })
  })

  it('refuses variables that are not a JSON object', () => {
    expect(buildGraphqlBody('{ x }', '{oops')).toEqual({ error: 'Variables não é um JSON válido.' })
    expect('error' in buildGraphqlBody('{ x }', '[1]')).toBe(true)
  })
})
