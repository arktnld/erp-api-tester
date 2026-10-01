function getByPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function extractFields(
  body: unknown,
  responseCapture: string | null | undefined
): Record<string, string> {
  if (!responseCapture) return {}
  let capture: Record<string, string>
  try {
    capture = JSON.parse(responseCapture) as Record<string, string>
  } catch {
    return {}
  }
  const result: Record<string, string> = {}
  for (const [key, path] of Object.entries(capture)) {
    const value = getByPath(body, path)
    if (value !== undefined && value !== null) result[key] = String(value)
  }
  return result
}

export type AssertionResult = { line: string; ok: boolean; actual?: string; error?: string }

const UNARY_OPS = ['isDefined', 'isUndefined', 'isEmpty', 'isNotEmpty'] as const
const BINARY_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains'] as const

function parseExpected(raw: string): unknown {
  try { return JSON.parse(raw) } catch { return raw }
}

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v).length === 0
  return false
}

function show(v: unknown): string {
  return v === undefined ? 'undefined' : typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v)
}

/**
 * Bruno-style declarative checks, one per line: `<target> <op> [value]`.
 * Targets: `status`, `body.<path>` (e.g. body.data[0].id), `headers.<name>`.
 * Blank lines and lines starting with `#` are ignored.
 */
export function runAssertions(
  text: string | null | undefined,
  res: { status: number; body: unknown; headers: Record<string, string> }
): AssertionResult[] {
  if (!text) return []
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((line) => {
    const m = line.match(/^(\S+)\s+(\S+)(?:\s+(.+))?$/)
    if (!m) return { line, ok: false, error: 'formato: <alvo> <operador> [valor]' }
    const [, target, op, rawExpected] = m
    let actual: unknown
    if (target === 'status') actual = res.status
    else if (target.startsWith('body.')) actual = getByPath(res.body, target.slice(5))
    else if (target === 'body') actual = res.body
    else if (target.startsWith('headers.')) actual = res.headers[target.slice(8).toLowerCase()]
    else return { line, ok: false, error: `alvo desconhecido: ${target}` }

    if ((UNARY_OPS as readonly string[]).includes(op)) {
      const ok = op === 'isDefined' ? actual !== undefined && actual !== null
        : op === 'isUndefined' ? actual === undefined || actual === null
        : op === 'isEmpty' ? isEmptyValue(actual) : !isEmptyValue(actual)
      return { line, ok, actual: show(actual) }
    }
    if (!(BINARY_OPS as readonly string[]).includes(op)) return { line, ok: false, error: `operador desconhecido: ${op}` }
    if (rawExpected === undefined) return { line, ok: false, error: `${op} precisa de um valor` }
    const expected = parseExpected(rawExpected)
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(v))
    let ok: boolean
    switch (op) {
      case 'eq': ok = JSON.stringify(actual) === JSON.stringify(expected) || String(actual) === String(expected); break
      case 'neq': ok = !(JSON.stringify(actual) === JSON.stringify(expected) || String(actual) === String(expected)); break
      case 'gt': ok = num(actual) > num(expected); break
      case 'gte': ok = num(actual) >= num(expected); break
      case 'lt': ok = num(actual) < num(expected); break
      case 'lte': ok = num(actual) <= num(expected); break
      case 'contains': ok = Array.isArray(actual) ? actual.some((v) => String(v) === String(expected)) : String(actual ?? '').includes(String(expected)); break
      default: ok = Array.isArray(actual) ? !actual.some((v) => String(v) === String(expected)) : !String(actual ?? '').includes(String(expected))
    }
    return { line, ok, actual: show(actual) }
  })
}
