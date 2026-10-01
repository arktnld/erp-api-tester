import { describe, it, expect } from 'vitest'
import { substitute, tryPrettyJson, reciprocalRankFusion } from './utils'

describe('substitute', () => {
  it('replaces known fields', () => {
    expect(substitute('/api/{id}/data', { id: '42' })).toBe('/api/42/data')
  })
  it('keeps unknown fields', () => {
    expect(substitute('{a}/{b}', { a: 'x' })).toBe('x/{b}')
  })
  it('handles empty fields', () => {
    expect(substitute('/api/v1', {})).toBe('/api/v1')
  })
  it('replaces multiple occurrences', () => {
    expect(substitute('{x}{x}', { x: 'y' })).toBe('yy')
  })
})

describe('tryPrettyJson', () => {
  it('formats valid json', () => {
    expect(tryPrettyJson('{"a":1}')).toBe('{\n  "a": 1\n}')
  })
  it('returns original on invalid json', () => {
    expect(tryPrettyJson('not json')).toBe('not json')
  })
  it('handles empty string', () => {
    expect(tryPrettyJson('')).toBe('')
  })
})

describe('reciprocalRankFusion', () => {
  it('returns empty array for empty inputs', () => {
    expect(reciprocalRankFusion([], [])).toEqual([])
  })

  it('merges two disjoint result sets by combined score', () => {
    const vecResults = [{ text: 'A' }, { text: 'B' }]
    const bm25Results = [{ text: 'C' }, { text: 'D' }]
    const merged = reciprocalRankFusion(vecResults, bm25Results)
    expect(merged).toHaveLength(4)
    // A and C both rank 1 in their list (score 1/61), B and D rank 2 (1/62)
    // stable sort preserves insertion order for ties: A before C, B before D
    expect(merged.map(r => r.text)).toEqual(['A', 'C', 'B', 'D'])
  })

  it('boosts docs that appear in both result sets', () => {
    const vecResults = [{ text: 'A' }, { text: 'B' }]
    const bm25Results = [{ text: 'B' }, { text: 'C' }]
    const merged = reciprocalRankFusion(vecResults, bm25Results)
    // B appears in both → score = 1/61 + 1/61, beats A (1/61) and C (1/62)
    expect(merged[0].text).toBe('B')
  })

  it('respects topK limit', () => {
    const docs = Array.from({ length: 10 }, (_, i) => ({ text: `doc${i}` }))
    const merged = reciprocalRankFusion(docs, [], 3)
    expect(merged).toHaveLength(3)
  })
})
