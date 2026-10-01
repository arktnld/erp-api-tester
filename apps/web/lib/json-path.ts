// Reads values out of an API response by path, e.g. "clientes[0].nome" (auto-fill of client fields).

export function flattenJson(obj: unknown, prefix = ''): Array<{ key: string; value: string }> {
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => flattenJson(item, prefix ? `${prefix}[${i}]` : `[${i}]`))
  }
  if (typeof obj !== 'object' || obj === null) {
    return prefix ? [{ key: prefix, value: String(obj ?? '') }] : []
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null) return flattenJson(v, fullKey)
    return [{ key: fullKey, value: String(v ?? '') }]
  })
}

export function resolveFromFlat(flat: Array<{ key: string; value: string }>, path: string): string | undefined {
  // Exact match first
  const exact = flat.find(({ key, value }) => key === path && value !== '')
  if (exact) return exact.value
  // Fallback: wildcard all numeric indices, return first non-empty match
  const pattern = new RegExp('^' + path.replace(/\[\d+\]/g, '\\[\\d+\\]') + '$')
  return flat.find(({ key, value }) => pattern.test(key) && value !== '')?.value
}

/** Value at `path` in a parsed response, with [n] also matching any index (first non-empty wins). */
export function valueAt(json: unknown, path: string): string | undefined {
  return resolveFromFlat(flattenJson(json), path)
}
