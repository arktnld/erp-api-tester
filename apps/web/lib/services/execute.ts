import { substitute } from '@/lib/utils'
import { bareHostname, publicOnlyLookup, validatePublicUrl } from '@/lib/security'
import { buildAuthHeadersForMode, getAuthModes, isTokenFresh, resolveAuth, stringCreds, tokenCacheEntry, withTokenCacheFor, type ResolvedAuth } from '@/lib/auth'
import { fieldDefaults, mergeFields } from '@/lib/fields'
import { getEndpoint } from '@/lib/repo/endpoints'
import { getCompanyWithAuth, getCookieJar, getTestClientWithCompany, saveCookieJar, saveTokenCache } from '@/lib/repo/companies'
import { recordExecution } from '@/lib/repo/history'
import { logger } from '@/lib/logger'
import { redactBody, redactHeaders } from '@/lib/redact'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import * as tls from 'node:tls'
import { CookieJar } from '@/lib/cookie-jar'
import type { ContentCategory } from '@/app/test/lib/types'

export class ValidationError extends Error {}

// ponytail: fixed limits; make them per-endpoint if some ERP legitimately exceeds them.
const REQUEST_TIMEOUT_MS = 60_000
export const MAX_RESPONSE_BYTES = 50 * 1024 * 1024

type TokenEndpointConfig = {
  tokenEndpointId: number
  tokenPath: string
  params: Record<string, string>
  cachedToken?: string
  cachedAt?: number
}

function extractByPath(obj: unknown, path: string): string | null {
  let current: unknown = obj
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[key]
  }
  return current != null ? String(current) : null
}

async function fetchTokenInline(
  company: { id: number; baseUrl: string; authConfig: unknown },
  cfg: TokenEndpointConfig,
  auth: ResolvedAuth,
  environmentUrl: string | null,
  jar: CookieJar
): Promise<string> {
  const tokenEndpoint = await getEndpoint(cfg.tokenEndpointId)
  const params = cfg.params ?? {}
  const resolvedPath = substitute(tokenEndpoint.pathTemplate, params)
  const bodyTemplate = tokenEndpoint.bodyTemplate?.trim() ? substitute(tokenEndpoint.bodyTemplate, params) : null
  const base = (environmentUrl ?? company.baseUrl).replace(/\/+$/, '')
  const url = `${base}${resolvedPath}`
  validatePublicUrl(url)
  // The token endpoint's own headers matter: OAuth2 servers reject a
  // client_credentials body without Content-Type: x-www-form-urlencoded.
  const tokenHeaders: Record<string, string> = {}
  const rawTokenHeaders = JSON.parse(tokenEndpoint.headers || '{}') as Record<string, string>
  for (const [k, v] of Object.entries(rawTokenHeaders)) tokenHeaders[k] = substitute(v, params)
  const res = await httpFetch(url, tokenEndpoint.method, tokenHeaders, bodyTemplate, jar)
  if (res.status < 200 || res.status >= 300)
    throw new Error(`Auth falhou: HTTP ${res.status} — ${res.body.slice(0, 200)}`)
  let json: unknown
  try { json = JSON.parse(res.body) } catch { throw new Error(`Auth: resposta não é JSON — ${res.body.slice(0, 200)}`) }
  const token = extractByPath(json, cfg.tokenPath ?? 'token')
  if (!token) throw new Error(`Token não encontrado em "${cfg.tokenPath}"`)
  await saveTokenCache(company.id, withTokenCacheFor(company.authConfig, auth, tokenCacheEntry(json, cfg.tokenPath ?? 'token', token)))
  return token
}

/** Token-endpoint settings for a mode: wiring from the ERP template, values from the company. */
function tokenConfig(auth: ResolvedAuth): TokenEndpointConfig {
  const c = auth.creds as Partial<TokenEndpointConfig>
  return {
    ...c,
    tokenEndpointId: auth.mode.tokenEndpointId ?? c.tokenEndpointId!,
    tokenPath: auth.mode.tokenPath ?? c.tokenPath ?? 'token',
    params: c.params ?? {},
  }
}

/**
 * Hosts the company's credentials may be sent to: its base URL and registered environments.
 * Keyed by protocol + hostname, not port: some APIs serve token and data on other
 * ports of the same host (`:45700/connect/token`, `:45715/...`), set in the pathTemplate.
 */
const hostKey = (u: URL) => `${u.protocol}//${u.hostname}`

function companyOrigins(company: { baseUrl: string; environments?: unknown }): Set<string> {
  const envs = Array.isArray(company.environments) ? (company.environments as { url?: unknown }[]) : []
  const urls = [company.baseUrl, ...envs.map((e) => e?.url)].filter((u): u is string => typeof u === 'string')
  const origins = new Set<string>()
  for (const u of urls) {
    try { origins.add(hostKey(new URL(u))) } catch { /* ignore malformed entries */ }
  }
  return origins
}

function assertCompanyOrigin(url: string, origins: Set<string>) {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new ValidationError(`URL inválida: ${url}`) }
  if (!origins.has(hostKey(parsed)))
    throw new ValidationError(`URL fora dos hosts cadastrados da empresa: ${parsed.origin}`)
}

export interface ExecuteParams {
  endpointId: number
  clientId?: number | null
  companyId?: number | null
  environmentUrl?: string | null
  rawBody?: string | null
  inlineFields?: Record<string, string> | null
  customUrl?: string | null
  /** Return credential-bearing headers/body unmasked (editors and admins only). */
  revealSecrets?: boolean
  userId?: string
  userEmail?: string
}

export interface ExecuteResult {
  statusCode: number
  url: string
  method: string
  requestBody: string | null
  requestHeaders: Record<string, string>
  responseBody: string
  responseHeaders: Record<string, string>
  durationMs: number
  contentCategory: ContentCategory
  mimeType: string
  fileName: string | null
  isBinary: boolean
}

function getContentCategory(mimeType: string): ContentCategory {
  const m = mimeType.toLowerCase().split(';')[0].trim()
  if (m === 'application/json' || m === 'application/vnd.api+json' || m === 'application/ld+json') return 'json'
  if (m === 'application/xml' || m === 'text/xml' || m === 'application/soap+xml') return 'xml'
  if (m === 'text/html') return 'html'
  if (m === 'text/csv') return 'csv'
  if (m === 'text/plain' || m === 'application/x-www-form-urlencoded') return 'text'
  if (m.startsWith('image/')) return 'image'
  if (m === 'application/pdf' || m === 'application/msword' || m.startsWith('application/vnd.ms-') || m.startsWith('application/vnd.openxmlformats-')) return 'document'
  if (m === 'application/zip' || m === 'application/octet-stream' || m.startsWith('audio/') || m.startsWith('video/')) return 'binary'
  return 'text'
}

function isBinaryCategory(category: ContentCategory): boolean {
  return category === 'image' || category === 'document' || category === 'binary'
}

function extractFileName(disposition: string | undefined): string | null {
  if (!disposition) return null
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i) ?? disposition.match(/filename="([^"]+)"/i)
  return match ? decodeURIComponent(match[1]) : null
}

// Node's bundled CAs plus the OS store, so ERPs signed by a corporate/internal CA verify (as in Bruno).
let trustedCAs: string[] | undefined
function caBundle(): string[] | undefined {
  if (trustedCAs === undefined) {
    // getCACertificates exists since Node 22.15/23.10; the installed @types/node predates it.
    const get = (tls as unknown as { getCACertificates?: (type: 'default' | 'system') => string[] }).getCACertificates
    try { trustedCAs = get ? [...new Set([...get('default'), ...get('system')])] : [] } catch { trustedCAs = [] }
  }
  return trustedCAs.length ? trustedCAs : undefined
}

function httpFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  jar?: CookieJar,
  redirectsLeft = 5
): Promise<{ status: number; body: string; headers: Record<string, string>; mimeType: string; fileName: string | null; contentCategory: ContentCategory; isBinary: boolean }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const cookie = jar && !Object.keys(headers).some((k) => k.toLowerCase() === 'cookie') ? jar.header(url) : undefined
    const allHeaders = {
      ...headers,
      ...(body ? { 'Content-Length': String(Buffer.byteLength(body)) } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    }
    const options = {
      ...(isHttps ? { ca: caBundle() } : {}),
      hostname: bareHostname(parsed),
      lookup: publicOnlyLookup,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: allHeaders,
    }
    const req = (isHttps ? httpsRequest : httpRequest)(options, (res) => {
      const status = res.statusCode ?? 0
      jar?.store(res.headers['set-cookie'], url)
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        const location = res.headers.location
        const nextUrl = location.startsWith('http') ? location : new URL(location, url).toString()
        res.resume()
        try {
          validatePublicUrl(nextUrl)
        } catch (err) {
          reject(err)
          return
        }
        resolve(httpFetch(nextUrl, 'GET', {}, null, jar, redirectsLeft - 1))
        return
      }
      const resHeaders: Record<string, string> = {}
      for (const [k, v] of Object.entries(res.headers)) {
        if (typeof v === 'string') resHeaders[k] = v
        else if (Array.isArray(v)) resHeaders[k] = v.join(', ')
      }
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += buf.length
        if (size > MAX_RESPONSE_BYTES) {
          res.destroy()
          reject(new Error(`Resposta excede ${MAX_RESPONSE_BYTES / 1024 / 1024} MB`))
          return
        }
        chunks.push(buf)
      })
      res.on('end', () => {
        const mimeType = (res.headers['content-type'] ?? '').split(';')[0].trim()
        const contentCategory = mimeType ? getContentCategory(mimeType) : 'json'
        const binary = isBinaryCategory(contentCategory)
        const bodyStr = binary
          ? Buffer.concat(chunks).toString('base64')
          : Buffer.concat(chunks).toString('utf8')
        const fileName = extractFileName(res.headers['content-disposition'])
        resolve({ status, body: bodyStr, headers: resHeaders, mimeType, fileName, contentCategory, isBinary: binary })
      })
    })
    req.on('error', reject)
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error(`Timeout após ${REQUEST_TIMEOUT_MS / 1000}s`)))
    if (body) req.write(body)
    req.end()
  })
}

export async function executeRequest(params: ExecuteParams): Promise<ExecuteResult> {
  const { endpointId, clientId, companyId, environmentUrl, rawBody: customBody, inlineFields, customUrl, revealSecrets = false, userId, userEmail } = params

  const endpoint = await getEndpoint(endpointId)

  let company: Awaited<ReturnType<typeof getCompanyWithAuth>>
  let fields: Record<string, string> = {}
  let clientName = ''

  if (clientId) {
    const client = await getTestClientWithCompany(clientId)
    company = client.company
    fields = client.fieldsData as Record<string, string>
    clientName = client.name
  } else {
    if (!companyId) throw new Error('companyId é obrigatório quando clientId não informado')
    company = await getCompanyWithAuth(companyId)
    if (inlineFields) fields = inlineFields
  }

  const origins = companyOrigins(company)
  if (environmentUrl) assertCompanyOrigin(environmentUrl, origins)
  const jar = new CookieJar(await getCookieJar(company.id))

  const erp = company.erp as { authTemplate?: unknown; fieldSchemas?: { fieldName: string; defaultValue: string }[] }
  // Auth values are added here from the ERP's current template (resolveAuth), not by mergeFields.
  const allFields = mergeFields(fields, null, fieldDefaults(erp.fieldSchemas))

  // Company-wide auth, and the endpoint's own mode when it names one (e.g. a few endpoints on Basic).
  const baseAuth = resolveAuth(erp.authTemplate, company.authConfig, null, company.authType)
  // Running a mode's own token endpoint (e.g. an OAuth password grant) uses that mode, not the default one.
  const ownTokenMode = getAuthModes(erp.authTemplate).find((m) => m.type === 'token_endpoint' && m.tokenEndpointId === endpoint.id)
  const modeId = endpoint.authMode || ownTokenMode?.id
  const auth = modeId ? resolveAuth(erp.authTemplate, company.authConfig, modeId, company.authType) : baseAuth
  // Body-field credentials stay available as {placeholders} (e.g. {token}/{app} still used on Basic endpoints).
  for (const a of [baseAuth, auth]) if (a?.mode.type === 'body_fields') Object.assign(allFields, stringCreds(a.creds))

  // Pre-auth: token_endpoint — obtain/reuse session token BEFORE substitution so {token} works in paths/bodies
  const tokenAuth = auth?.mode.type === 'token_endpoint' ? auth : baseAuth?.mode.type === 'token_endpoint' ? baseAuth : null
  const tokenCfg = tokenAuth ? tokenConfig(tokenAuth) : null
  let renewToken: (() => Promise<string>) | null = null
  if (tokenAuth && tokenCfg) {
    // Always inject static params (CLIENT_ID, PASSWORD, etc.) so they resolve in any template
    Object.assign(allFields, tokenCfg.params)
    if (endpoint.id !== tokenCfg.tokenEndpointId) {
      // Override TOKEN placeholder with the session token for non-auth endpoints
      const fetchNew = () => fetchTokenInline(company, tokenCfg, tokenAuth, environmentUrl ?? null, jar)
      const fromCache = isTokenFresh(tokenCfg)
      const token = fromCache ? tokenCfg.cachedToken! : await fetchNew()
      allFields['token'] = token
      allFields['TOKEN'] = token
      // A cached token may have been revoked or expired without a known lifetime: renew once on 401.
      if (fromCache) renewToken = fetchNew
    }
  }

  const headerAuth = auth && !['token_endpoint', 'body_fields'].includes(auth.mode.type) ? auth : null
  const authHeaders = headerAuth ? buildAuthHeadersForMode(headerAuth.mode.type, stringCreds(headerAuth.creds)) : {}

  const baseUrl = (environmentUrl ?? company.baseUrl).replace(/\/+$/, '')
  const rawEndpointHeaders = JSON.parse(endpoint.headers || '{}') as Record<string, string>

  const buildRequest = () => {
    const resolvedPath = substitute(endpoint.pathTemplate, allFields)
    const resolvedBody =
      customBody != null
        ? customBody
        : endpoint.bodyTemplate?.trim()
          ? substitute(endpoint.bodyTemplate, allFields)
          : null
    const endpointHeaders: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawEndpointHeaders)) endpointHeaders[k] = substitute(v, allFields)
    const url = customUrl?.trim() || `${baseUrl}${resolvedPath}`
    assertCompanyOrigin(url, origins)
    try {
      validatePublicUrl(url)
    } catch (err) {
      throw new ValidationError(String(err))
    }
    const requestHeaders: Record<string, string> = {
      ...(resolvedBody != null && !endpointHeaders['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
      ...endpointHeaders,
      ...authHeaders,
    }
    return { url, resolvedBody, requestHeaders }
  }

  let { url, resolvedBody, requestHeaders } = buildRequest()

  logger.info({ endpointId, url, method: endpoint.method }, 'execute start')

  const startMs = Date.now()
  let statusCode = 0
  let responseBody = ''
  let responseHeaders: Record<string, string> = {}
  let mimeType = ''
  let fileName: string | null = null
  let contentCategory: ContentCategory = 'json'
  let isBinary = false

  const send = async () => {
    try {
      const res = await httpFetch(url, endpoint.method, requestHeaders, resolvedBody, jar)
      statusCode = res.status
      responseBody = res.body
      responseHeaders = res.headers
      mimeType = res.mimeType
      fileName = res.fileName
      contentCategory = res.contentCategory
      isBinary = res.isBinary
    } catch (err: unknown) {
      statusCode = 0
      responseBody = JSON.stringify({ error: String(err) })
      logger.warn({ url, err: String(err) }, 'execute http error')
    }
  }

  await send()
  if (statusCode === 401 && renewToken) {
    const token = await renewToken()
    allFields['token'] = token
    allFields['TOKEN'] = token
    ;({ url, resolvedBody, requestHeaders } = buildRequest())
    logger.info({ endpointId, url }, 'execute retry after token renewal')
    await send()
  }

  const durationMs = Date.now() - startMs
  logger.info({ url, statusCode, durationMs }, 'execute complete')

  // Auto-save token when the token endpoint itself was just executed successfully
  if (tokenAuth && tokenCfg && endpoint.id === tokenCfg.tokenEndpointId && statusCode >= 200 && statusCode < 300) {
    try {
      const json = JSON.parse(responseBody)
      const token = extractByPath(json, tokenCfg.tokenPath)
      if (token) {
        await saveTokenCache(company.id, withTokenCacheFor(company.authConfig, tokenAuth, tokenCacheEntry(json, tokenCfg.tokenPath, token)))
      }
    } catch { /* ignore */ }
  }

  if (jar.changed) {
    await saveCookieJar(company.id, jar.toJSON()).catch((err: unknown) =>
      logger.warn({ companyId: company.id, err: String(err) }, 'cookie jar save failed'))
  }

  await recordExecution({
    erpName: company.erp.name,
    companyName: company.name,
    companyId: company.id,
    endpointId: endpoint.id,
    testClientId: clientId ?? undefined,
    endpointName: endpoint.name,
    clientName,
    method: endpoint.method,
    url,
    requestBody: redactBody(resolvedBody) ?? '',
    requestHeaders: JSON.stringify(redactHeaders(requestHeaders)),
    statusCode,
    responseBody,
    responseHeaders: JSON.stringify(responseHeaders),
    durationMs,
    userId,
    userEmail,
  })

  return {
    statusCode,
    url,
    method: endpoint.method,
    requestBody: revealSecrets ? resolvedBody : (redactBody(resolvedBody) ?? null),
    requestHeaders: revealSecrets ? requestHeaders : redactHeaders(requestHeaders),
    responseBody,
    responseHeaders,
    durationMs,
    contentCategory,
    mimeType,
    fileName,
    isBinary,
  }
}
