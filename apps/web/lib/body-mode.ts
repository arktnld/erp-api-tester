// Request body modes, like Bruno's: the mode is just the Content-Type header, so endpoints need no extra column.

export const BODY_MODES = [
  { id: 'json', label: 'JSON', contentType: 'application/json' },
  { id: 'xml', label: 'XML / SOAP 1.1', contentType: 'text/xml; charset=utf-8' },
  { id: 'soap12', label: 'SOAP 1.2', contentType: 'application/soap+xml; charset=utf-8' },
  { id: 'form', label: 'Formulário (urlencoded)', contentType: 'application/x-www-form-urlencoded' },
  { id: 'text', label: 'Texto', contentType: 'text/plain; charset=utf-8' },
] as const
export type BodyModeId = (typeof BODY_MODES)[number]['id']

export function contentTypeOf(headers: Record<string, string>): string {
  return Object.entries(headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
}

/** The mode a Content-Type belongs to; 'other' for anything custom (kept as is). */
export function modeOf(contentType: string): BodyModeId | 'other' {
  const ct = contentType.toLowerCase()
  if (!ct || ct.includes('json')) return 'json'
  if (ct.includes('soap+xml')) return 'soap12'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('x-www-form-urlencoded')) return 'form'
  if (ct.startsWith('text/plain')) return 'text'
  return 'other'
}

/** New headers with the Content-Type replaced, whatever case the old key had. */
export function withContentType(headers: Record<string, string>, contentType: string): Record<string, string> {
  const rest = Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'content-type'))
  return { 'Content-Type': contentType, ...rest }
}

/** Content-Type for a body sent without one: what it looks like, not always JSON. */
export function guessContentType(body: string): string {
  const b = body.trim()
  if (b.startsWith('{') || b.startsWith('[')) return 'application/json'
  if (b.startsWith('<')) return /2003\/05\/soap-envelope/.test(b) ? 'application/soap+xml; charset=utf-8' : 'text/xml; charset=utf-8'
  if (/^[^\s=&]+=[^\s&]*(&[^\s=&]+=[^\s&]*)*$/.test(b)) return 'application/x-www-form-urlencoded'
  return 'text/plain; charset=utf-8'
}

export function editorLanguageOf(contentType: string): 'json' | 'xml' | 'text' {
  const mode = modeOf(contentType)
  return mode === 'json' ? 'json' : mode === 'xml' || mode === 'soap12' ? 'xml' : 'text'
}
