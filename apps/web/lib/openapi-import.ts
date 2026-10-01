// OpenAPI 3.x / Swagger 2.0 (JSON) → endpoint drafts, like Bruno's converters.
// ponytail: JSON only; YAML specs need a parser dependency — add one if an ERP only publishes YAML.

export type EndpointDraft = {
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  pathTemplate: string
  bodyTemplate: string
  headers: string
  group: string
  requiresClient: boolean
  isModification: boolean
  notes: string
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
const MAX_REF_DEPTH = 6

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

/** Placeholders only accept \w (see substitute): {client-id} → {client_id}. */
const placeholder = (name: string) => name.replace(/\W/g, '_')

function resolveRef(doc: Obj, node: unknown, depth = 0): unknown {
  if (!isObj(node) || typeof node.$ref !== 'string') return node
  if (depth > MAX_REF_DEPTH || !node.$ref.startsWith('#/')) return {}
  let cur: unknown = doc
  for (const part of node.$ref.slice(2).split('/')) cur = isObj(cur) ? cur[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined
  return resolveRef(doc, cur, depth + 1)
}

/** Example value from a JSON schema: explicit example/default first, else a typed placeholder. */
function sample(doc: Obj, schema: unknown, depth = 0): unknown {
  const s = resolveRef(doc, schema)
  if (!isObj(s) || depth > MAX_REF_DEPTH) return null
  if (s.example !== undefined) return s.example
  if (s.default !== undefined) return s.default
  if (Array.isArray(s.enum) && s.enum.length) return s.enum[0]
  const all = (s.allOf ?? s.oneOf ?? s.anyOf) as unknown[] | undefined
  if (Array.isArray(all) && all.length) {
    const parts = (s.allOf ? all : all.slice(0, 1)).map((x) => sample(doc, x, depth + 1))
    return parts.every(isObj) ? Object.assign({}, ...parts) : parts[0]
  }
  switch (s.type) {
    case 'object': break
    case 'array': return [sample(doc, s.items, depth + 1)]
    case 'integer': case 'number': return 0
    case 'boolean': return false
    case 'string': return ''
    default: if (!isObj(s.properties)) return null
  }
  const props = isObj(s.properties) ? s.properties : {}
  return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, sample(doc, v, depth + 1)]))
}

function basePath(doc: Obj): string {
  if (typeof doc.basePath === 'string') return doc.basePath // Swagger 2.0
  const servers = doc.servers as { url?: unknown }[] | undefined
  const url = Array.isArray(servers) && typeof servers[0]?.url === 'string' ? servers[0].url : ''
  try { return new URL(url, 'http://placeholder').pathname } catch { return '' }
}

export function parseOpenApi(input: unknown): { endpoints: EndpointDraft[]; warnings: string[] } {
  if (!isObj(input) || (!input.openapi && !input.swagger)) throw new Error('Arquivo não parece OpenAPI/Swagger (faltam os campos "openapi" ou "swagger")')
  if (!isObj(input.paths)) throw new Error('Especificação sem "paths"')
  const doc = input
  const warnings: string[] = []
  const base = basePath(doc).replace(/\/+$/, '')
  const endpoints: EndpointDraft[] = []

  for (const [rawPath, rawItem] of Object.entries(doc.paths as Obj)) {
    const item = resolveRef(doc, rawItem)
    if (!isObj(item)) continue
    const shared = Array.isArray(item.parameters) ? item.parameters : []
    for (const m of METHODS) {
      const op = item[m]
      if (!isObj(op)) continue
      const params = [...shared, ...(Array.isArray(op.parameters) ? op.parameters : [])]
        .map((p) => resolveRef(doc, p)).filter(isObj)
      const path = (base + rawPath).replace(/\{([^}]+)\}/g, (_, n) => `{${placeholder(n)}}`)
      const query = params.filter((p) => p.in === 'query' && p.required && typeof p.name === 'string')
        .map((p) => `${p.name}={${placeholder(String(p.name))}}`)
      const headerParams = params.filter((p) => p.in === 'header' && p.required && typeof p.name === 'string')

      let body: unknown
      const content = isObj(resolveRef(doc, op.requestBody)) ? (resolveRef(doc, op.requestBody) as Obj).content : undefined
      const jsonType = isObj(content) ? Object.keys(content).find((t) => /^application\/([\w.-]+\+)?json/.test(t)) : undefined
      const json = jsonType && isObj(content) ? content[jsonType] : undefined
      if (isObj(json)) body = json.example ?? sample(doc, json.schema)
      const bodyParam = params.find((p) => p.in === 'body') // Swagger 2.0
      if (body === undefined && bodyParam) body = sample(doc, bodyParam.schema)
      if (!isObj(json) && isObj(content) && Object.keys(content).length) warnings.push(`${m.toUpperCase()} ${rawPath}: body ${Object.keys(content)[0]} não importado`)

      const headers: Record<string, string> = {}
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      for (const h of headerParams) headers[String(h.name)] = `{${placeholder(String(h.name))}}`

      const summary = typeof op.summary === 'string' ? op.summary.trim() : ''
      const opId = typeof op.operationId === 'string' ? op.operationId : ''
      endpoints.push({
        name: (summary || opId || `${m.toUpperCase()} ${rawPath}`).slice(0, 100),
        method: m.toUpperCase() as EndpointDraft['method'],
        pathTemplate: query.length ? `${path}?${query.join('&')}` : path,
        bodyTemplate: body === undefined ? '' : JSON.stringify(body, null, 2),
        headers: JSON.stringify(headers),
        group: Array.isArray(op.tags) && typeof op.tags[0] === 'string' ? op.tags[0] : '',
        requiresClient: /\{\w+\}/.test(path) || query.length > 0,
        isModification: m !== 'get',
        notes: (typeof op.description === 'string' ? op.description : '').slice(0, 2000),
      })
    }
  }
  if (!endpoints.length) warnings.push('Nenhuma operação GET/POST/PUT/PATCH/DELETE encontrada')
  return { endpoints, warnings }
}
