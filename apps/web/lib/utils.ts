import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function substitute(template: string, fields: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => fields[key] ?? `{${key}}`)
}

export function tryPrettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

/**
 * Reciprocal Rank Fusion merges two ranked result lists.
 * Standard k=60 constant prevents high ranks from dominating.
 * Docs appearing in both lists receive additive score boosts.
 */
export function reciprocalRankFusion<T extends { text: string }>(
  list1: T[],
  list2: T[],
  topK = 20
): T[] {
  const k = 60
  const scores = new Map<string, { item: T; score: number }>()

  for (const list of [list1, list2]) {
    list.forEach((item, idx) => {
      const existing = scores.get(item.text)
      const add = 1 / (k + idx + 1)
      if (existing) {
        existing.score += add
      } else {
        scores.set(item.text, { item, score: add })
      }
    })
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(v => v.item)
}

export function tryPrettyXml(str: string): string {
  try {
    const INDENT = '  '
    let indent = 0
    const tokens = str.match(/<[^>]+>|[^<]+/g) ?? []
    const lines: string[] = []
    for (const token of tokens) {
      const trimmed = token.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('</')) {
        indent = Math.max(0, indent - 1)
        lines.push(INDENT.repeat(indent) + trimmed)
      } else if (trimmed.startsWith('<') && !trimmed.startsWith('<?') && !trimmed.startsWith('<!') && !trimmed.endsWith('/>')) {
        lines.push(INDENT.repeat(indent) + trimmed)
        indent++
      } else {
        lines.push(INDENT.repeat(indent) + trimmed)
      }
    }
    const result = lines.join('\n').trim()
    return result || str
  } catch {
    return str
  }
}
