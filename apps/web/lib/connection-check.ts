import { valueAt } from './json-path'

// Did a test call really work? Some ERPs answer 200 to a refused request.

export type Exec = { statusCode: number; durationMs: number; responseBody: string; error?: string }

export const parse = (body: string): unknown => { try { return JSON.parse(body) } catch { return null } }

/** APIs that answer 200 to a refused request, e.g. {"status":"ERRO","Mensagem":"Token não localizado."}. */
export function bodyError(json: unknown): string | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null
  const b = json as Record<string, unknown>
  const failed = /^(erro|error|fail)/i.test(String(b.status ?? '')) || b.type === 'error' || b.success === false || (typeof b.error === 'string' && !!b.error)
  if (!failed) return null
  return String(b.Mensagem ?? b.mensagem ?? b.message ?? b.msg ?? b.error_description ?? b.error ?? 'erro na resposta')
}

/** The connection test passed: 2xx, no error in the body and, for token endpoints, a token in it. */
export function connected(r: Exec, tokenPath?: string): boolean {
  if (r.statusCode < 200 || r.statusCode >= 300) return false
  const json = parse(r.responseBody)
  if (bodyError(json)) return false
  return !tokenPath || !!(json && valueAt(json, tokenPath))
}
