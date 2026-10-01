export interface CollectionParam {
  name: string
  type: string
  format?: string
  enum?: string[]
  required: boolean
  in: 'path' | 'query' | 'header' | 'cookie'
  desc?: string
  example?: string
}

export interface CollectionEndpoint {
  id: string
  method: string
  path: string
  name: string
  desc?: string
  operationId?: string
  deprecated?: boolean
  auth?: { type: string; details?: { key: string; value: string }[] }
  security?: Record<string, string[]>[]
  headers?: { key: string; value: string; desc?: string }[]
  params?: CollectionParam[]
  queryParams?: CollectionParam[]
  body?: string
  bodyMode?: string
  bodyContentType?: string
  examples?: {
    name: string
    status: string
    statusText: string
    body: string
    headers: Record<string, string>
    requestBody?: string
  }[]
  responses?: { status: string; statusText?: string; desc?: string; example?: string | null }[]
}

export interface FolderNode {
  id: string
  name: string
  children: FolderNode[]
  eps: CollectionEndpoint[]
}

export interface CollectionStructure {
  name: string
  tree: FolderNode
}

export interface FlatEndpoint extends CollectionEndpoint {
  folderPath: string[]
  _paramNames: string
}

// ── Postman v2.1 ─────────────────────────────────────────────────────────────
type PostmanUrl = string | { raw?: string; query?: { key: string; value?: string; description?: string; disabled?: boolean }[]; variable?: { key: string; value?: string; description?: string }[] }
type PostmanBody = { mode?: string; raw?: string; urlencoded?: { key: string; value: string }[]; formdata?: { key: string; value?: string; type?: string }[] }
type PostmanAuth = { type: string; bearer?: { key: string; value: string }[]; basic?: { key: string; value: string }[]; apikey?: { key: string; value: string }[]; oauth2?: { key: string; value: string }[] }
type PostmanItem = { name: string; item?: PostmanItem[]; request?: { method?: string; url?: PostmanUrl; header?: { key: string; value: string; description?: string }[]; body?: PostmanBody; auth?: PostmanAuth; description?: string | { content?: string } }; response?: { name: string; code?: number; status?: string; header?: { key: string; value: string }[]; body?: string; originalRequest?: { body?: { raw?: string } } }[]; description?: string | { content?: string } }

function extractDesc(d: unknown): string | undefined {
  if (typeof d === 'string') return d || undefined
  if (d && typeof d === 'object' && 'content' in d) return (d as { content?: string }).content || undefined
  return undefined
}

function parsePostmanEndpoint(item: PostmanItem, id: string): CollectionEndpoint {
  const req = item.request ?? {}
  const urlObj = req.url
  let path = ''
  let queryParams: CollectionParam[] = []

  if (typeof urlObj === 'string') {
    try { path = new URL(urlObj).pathname } catch { path = urlObj }
  } else if (urlObj && typeof urlObj === 'object') {
    path = urlObj.raw ?? ''
    try { const u = new URL(path); path = u.pathname + u.search } catch {}
    queryParams = (urlObj.query ?? [])
      .filter((q) => !q.disabled)
      .map((q) => ({ name: q.key, type: 'string', required: false, in: 'query' as const, desc: q.description || undefined, example: q.value || undefined }))
    const pathVars = (urlObj.variable ?? []).map((v) => ({ name: v.key, type: 'string', required: true, in: 'path' as const, desc: v.description || undefined, example: v.value || undefined }))
    queryParams = [...pathVars, ...queryParams]
  }

  const headers = (req.header ?? []).map((h) => ({ key: h.key, value: h.value, desc: h.description || undefined }))

  let auth: CollectionEndpoint['auth'] | undefined
  if (req.auth?.type) {
    const t = req.auth.type
    const details = (req.auth[t as keyof PostmanAuth] as { key: string; value: string }[] | undefined) ?? []
    auth = { type: t, details }
  }

  let body: string | undefined
  let bodyMode: string | undefined
  let bodyContentType: string | undefined
  const bodyObj = req.body
  if (bodyObj?.mode === 'raw' && bodyObj.raw) {
    body = bodyObj.raw
    bodyMode = 'raw'
    bodyContentType = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? 'application/json'
  } else if (bodyObj?.mode === 'urlencoded' && bodyObj.urlencoded) {
    body = bodyObj.urlencoded.map((f) => `${f.key}=${f.value}`).join('&')
    bodyMode = 'urlencoded'
  }

  const examples = (item.response ?? []).map((r) => ({
    name: r.name,
    status: String(r.code ?? (typeof r.status === 'string' && /^\d+$/.test(r.status) ? r.status : '200')),
    statusText: typeof r.status === 'string' && !/^\d+$/.test(r.status) ? r.status : '',
    body: r.body ?? '',
    headers: Object.fromEntries((r.header ?? []).map((h) => [h.key, h.value])),
    requestBody: r.originalRequest?.body?.raw || undefined,
  }))

  const responses = Array.from(
    new Map(examples.map((e) => [e.status, { status: e.status, statusText: e.statusText, example: e.body || null }])).values()
  )

  return {
    id,
    method: (req.method ?? 'GET').toUpperCase(),
    path,
    name: item.name,
    desc: extractDesc(item.description) ?? extractDesc(req.description),
    auth,
    headers,
    params: queryParams,
    queryParams: queryParams.filter((p) => p.in === 'query'),
    body,
    bodyMode,
    bodyContentType,
    examples,
    responses,
  }
}

function parsePostmanNode(item: PostmanItem, counter: { n: number }): { folder: FolderNode } | { ep: CollectionEndpoint } {
  if (Array.isArray(item.item)) {
    const node: FolderNode = { id: `f-${item.name}-${Math.random().toString(36).slice(2, 6)}`, name: item.name, children: [], eps: [] }
    for (const child of item.item) {
      const r = parsePostmanNode(child, counter)
      if ('folder' in r) node.children.push(r.folder)
      else node.eps.push(r.ep)
    }
    return { folder: node }
  }
  counter.n++
  return { ep: parsePostmanEndpoint(item, String(counter.n)) }
}

function parsePostmanV2(raw: Record<string, unknown>): CollectionStructure {
  const info = raw.info as Record<string, unknown> | undefined
  const name = (info?.name as string) ?? 'Collection'
  const items = (raw.item as PostmanItem[]) ?? []
  const root: FolderNode = { id: 'root', name, children: [], eps: [] }
  const counter = { n: 0 }
  for (const item of items) {
    const r = parsePostmanNode(item, counter)
    if ('folder' in r) root.children.push(r.folder)
    else root.eps.push(r.ep)
  }
  return { name, tree: root }
}

// ── OpenAPI 3.0 ───────────────────────────────────────────────────────────────
function schemaToExample(schema: Record<string, unknown>): string | null {
  if (!schema) return null
  if (schema.example !== undefined) return JSON.stringify(schema.example, null, 2)
  if (schema.type === 'object' && schema.properties) {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      obj[k] = v.example ?? v.type ?? null
    }
    return JSON.stringify(obj, null, 2)
  }
  return null
}

function parseOpenAPI(raw: Record<string, unknown>): CollectionStructure {
  const info = (raw.info as Record<string, unknown>) ?? {}
  const name = (info.title as string) ?? 'OpenAPI'
  const paths = (raw.paths as Record<string, Record<string, unknown>>) ?? {}
  const root: FolderNode = { id: 'root', name, children: [], eps: [] }
  const folderMap = new Map<string, FolderNode>()
  let counter = 0

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']) {
      const op = pathItem[method] as Record<string, unknown> | undefined
      if (!op) continue
      counter++
      const tag = ((op.tags as string[]) ?? [])[0] ?? 'Geral'
      if (!folderMap.has(tag)) {
        const folder: FolderNode = { id: `tag-${tag}`, name: tag, children: [], eps: [] }
        folderMap.set(tag, folder)
        root.children.push(folder)
      }
      const params: CollectionParam[] = ((op.parameters ?? []) as Record<string, unknown>[]).map((p) => {
        const schema = (p.schema as Record<string, unknown>) ?? {}
        return {
          name: p.name as string,
          type: (schema.type as string) ?? 'string',
          format: schema.format as string | undefined,
          required: Boolean(p.required),
          in: (p.in as CollectionParam['in']) ?? 'query',
          desc: p.description as string | undefined,
          example: (p.example as string | undefined) ?? (schema.example as string | undefined),
          enum: schema.enum as string[] | undefined,
        }
      })
      const responses = Object.entries((op.responses ?? {}) as Record<string, Record<string, unknown>>).map(([status, resp]) => {
        const content = resp.content as Record<string, unknown> | undefined
        const schema = (content?.['application/json'] as Record<string, unknown>)?.schema as Record<string, unknown> | undefined
        return { status, desc: resp.description as string | undefined, example: schema ? schemaToExample(schema) : null }
      })
      let body: string | undefined
      let bodyContentType: string | undefined
      const reqBody = op.requestBody as Record<string, unknown> | undefined
      if (reqBody?.content) {
        const content = reqBody.content as Record<string, unknown>
        const ct = Object.keys(content)[0] ?? 'application/json'
        bodyContentType = ct
        const schema = (content[ct] as Record<string, unknown>)?.schema as Record<string, unknown> | undefined
        if (schema) body = schemaToExample(schema) ?? undefined
      }
      folderMap.get(tag)!.eps.push({
        id: String(counter),
        method: method.toUpperCase(),
        path,
        name: (op.summary as string) ?? (op.operationId as string) ?? path,
        desc: op.description as string | undefined,
        operationId: op.operationId as string | undefined,
        deprecated: Boolean(op.deprecated),
        security: op.security as Record<string, string[]>[] | undefined,
        params,
        queryParams: params.filter((p) => p.in === 'query'),
        body,
        bodyMode: body ? 'raw' : undefined,
        bodyContentType,
        responses,
      })
    }
  }
  return { name, tree: root }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function parseCollectionStructure(rawJson: unknown): CollectionStructure {
  if (!rawJson || typeof rawJson !== 'object') return { name: 'Collection', tree: { id: 'root', name: 'Collection', children: [], eps: [] } }
  const raw = rawJson as Record<string, unknown>
  const info = raw.info as Record<string, unknown> | undefined
  if (raw.item && info && (info._postman_id || String(info.schema ?? '').includes('getpostman.com'))) return parsePostmanV2(raw)
  if (raw.openapi || raw.swagger) return parseOpenAPI(raw)
  return { name: 'Collection', tree: { id: 'root', name: 'Collection', children: [], eps: [] } }
}
