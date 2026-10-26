import type { Endpoint, ExecuteResponse } from './types'
import { substitute, tryPrettyJson } from '@/lib/utils'
import { buildAuthHeaders, buildAuthHeadersForMode, getAuthModes, resolveAuth, stringCreds } from '@/lib/auth'
import { mergeFields, resolveBodyTemplate } from '@/lib/fields'
export { substitute, tryPrettyJson }

/** Copy the request returned by the executor, including its permission-based masking. */
export function generateExecutedCurl(request: Pick<ExecuteResponse, 'method' | 'url' | 'requestHeaders' | 'requestBody'>): string | undefined {
  if (!request.method || !request.url) return undefined
  const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"
  const parts = [`curl -X ${request.method} ${quote(request.url)}`]
  for (const [key, value] of Object.entries(request.requestHeaders)) {
    parts.push(`  -H ${quote(`${key}: ${value}`)}`)
  }
  if (request.requestBody != null && request.requestBody !== '') {
    parts.push(`  -d ${quote(request.requestBody)}`)
  }
  return parts.join(' \\\n')
}

export function generateCurl(
  endpoint: Endpoint,
  company: { baseUrl: string; authType: string; authConfig: unknown },
  fields: Record<string, string>,
  customBody?: string,
  customUrl?: string,
  context?: { authTemplate: unknown; defaults?: Record<string, string> }
): string {
  const allFields = mergeFields(fields, company, context?.defaults, context ? { ...context, endpoint } : undefined)
  const url = customUrl?.trim() || `${company.baseUrl}${substitute(endpoint.pathTemplate, allFields)}`

  const ownMode = getAuthModes(context?.authTemplate).find((m) => m.type === 'token_endpoint' && m.tokenEndpointId === endpoint.id)
  const auth = resolveAuth(context?.authTemplate, company.authConfig, endpoint.authMode || ownMode?.id, company.authType)
  const authHeaders = context
    ? (auth ? buildAuthHeadersForMode(auth.mode.type, stringCreds(auth.creds)) : {})
    : buildAuthHeaders(company)
  const requestHeaders = { ...authHeaders }

  try {
    const endpointHeaders = JSON.parse(endpoint.headers || '{}') as Record<string, string>
    for (const [k, v] of Object.entries(endpointHeaders)) {
      requestHeaders[k] = substitute(v, allFields)
    }
  } catch {}

  const body = customBody != null
    ? substitute(customBody, allFields)
    : (endpoint.bodyTemplate?.trim() ? resolveBodyTemplate(endpoint.bodyTemplate, allFields, context?.authTemplate) : '')
  return generateExecutedCurl({ method: endpoint.method, url, requestHeaders, requestBody: body }) ?? ''
}

export function findErpIdForCompany(erps: { id: number; companies: { id: number }[] }[], companyId: number): number | null {
  return erps.find((e) => e.companies.some((c) => c.id === companyId))?.id ?? null
}
