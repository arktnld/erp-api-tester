import type { Endpoint, Company, ExecuteResponse } from './types'
import { substitute, tryPrettyJson } from '@/lib/utils'
import { buildAuthHeaders } from '@/lib/auth'
import { mergeFields } from '@/lib/fields'
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
  company: Pick<Company, 'baseUrl' | 'authType' | 'authConfig'>,
  fields: Record<string, string>,
  customBody?: string,
  customUrl?: string
): string {
  const allFields = mergeFields(fields, company)
  const url = customUrl?.trim() || `${company.baseUrl}${substitute(endpoint.pathTemplate, allFields)}`
  const parts: string[] = [`curl -X ${endpoint.method} '${url}'`]

  const authHeaders = buildAuthHeaders(company)
  for (const [k, v] of Object.entries(authHeaders)) {
    parts.push(`  -H '${k}: ${v}'`)
  }

  try {
    const endpointHeaders = JSON.parse(endpoint.headers || '{}') as Record<string, string>
    for (const [k, v] of Object.entries(endpointHeaders)) {
      parts.push(`  -H '${k}: ${v}'`)
    }
  } catch {}

  const body = customBody
    ? substitute(customBody, allFields)
    : (endpoint.bodyTemplate?.trim() ? substitute(endpoint.bodyTemplate, allFields) : '')
  if (body) {
    parts.push(`  -d '${body}'`)
  }

  return parts.join(' \\\n')
}

export function findErpIdForCompany(erps: { id: number; companies: { id: number }[] }[], companyId: number): number | null {
  return erps.find((e) => e.companies.some((c) => c.id === companyId))?.id ?? null
}
