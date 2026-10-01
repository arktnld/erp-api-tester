export const MASK = '****' // ASCII: flows into btoa() for basic-auth previews

// Structural keys the UI needs (header name, token endpoint wiring). Everything else in an
// authConfig is treated as a credential.
const PUBLIC_AUTH_KEYS = new Set(['header', 'tokenEndpointId', 'tokenPath', 'cachedAt', 'expiresAt', 'type'])

const SENSITIVE_HEADER = /auth|token|secret|key|cookie|session|passw/i

/**
 * Same shape as the input with credential values masked. Empty strings stay empty so
 * "is this filled / cached?" checks in the UI keep working.
 */
export function redactAuthConfig(value: unknown, key?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => redactAuthConfig(v))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactAuthConfig(v, k)]))
  }
  if (typeof value === 'string' && value !== '' && !(key && PUBLIC_AUTH_KEYS.has(key))) return MASK
  return value
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, SENSITIVE_HEADER.test(k) ? MASK : v])
  )
}

/** Masks credential-looking fields in a JSON body; non-JSON bodies are returned unchanged. */
export function redactBody(body: string | null | undefined): string | null | undefined {
  if (!body) return body
  try {
    return JSON.stringify(maskSensitiveKeys(JSON.parse(body)))
  } catch {
    return body
  }
}

function maskSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitiveKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE_HEADER.test(k) && typeof v !== 'object' ? MASK : maskSensitiveKeys(v)])
    )
  }
  return value
}

/**
 * Masks requestHeaders/requestBody on a stored execution (history row, playbook step,
 * record block response). Headers may be stored as a JSON string or as an object.
 */
export function redactExecution<T>(item: T): T {
  if (!item || typeof item !== 'object') return item
  const o = item as Record<string, unknown>
  const out: Record<string, unknown> = { ...o }
  if (typeof o.requestHeaders === 'string') {
    try { out.requestHeaders = JSON.stringify(redactHeaders(JSON.parse(o.requestHeaders))) } catch { /* keep */ }
  } else if (o.requestHeaders && typeof o.requestHeaders === 'object') {
    out.requestHeaders = redactHeaders(o.requestHeaders as Record<string, string>)
  }
  if (typeof o.requestBody === 'string') out.requestBody = redactBody(o.requestBody)
  return out as T
}
