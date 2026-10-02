export type AuthModeConfig = {
  id: string
  type: string
  label: string
  fields: { key: string; label: string; placeholder?: string; default?: string; hidden?: boolean }[]
  tokenEndpointId?: number
  tokenPath?: string
}

/**
 * What each auth type needs and how it goes into the request. Types with `fixedKeys` read
 * exactly those credential keys (buildAuthHeadersForMode); the others take any keys.
 */
export const AUTH_TYPES: Record<string, { label: string; fixedKeys?: { key: string; label: string }[]; keysHint?: string; sends: string }> = {
  bearer: { label: 'Bearer token', fixedKeys: [{ key: 'token', label: 'Token' }], sends: 'Header Authorization: Bearer {token}' },
  basic: {
    label: 'Usuário e senha (Basic)',
    fixedKeys: [{ key: 'username', label: 'Usuário' }, { key: 'password', label: 'Senha' }],
    sends: 'Header Authorization: Basic base64(usuário:senha)',
  },
  api_key: {
    label: 'Chave de API em header',
    fixedKeys: [{ key: 'header', label: 'Nome do header' }, { key: 'value', label: 'Valor da chave' }],
    sends: 'Header {nome do header}: {valor da chave}',
  },
  custom_headers: { label: 'Headers próprios', keysHint: 'Cada chave é o nome de um header', sends: 'Cada campo vira um header com o mesmo nome' },
  body_fields: { label: 'Campos no corpo', keysHint: 'Cada chave vira um {placeholder}', sends: 'Cada campo fica disponível como {chave} no caminho e no body dos endpoints' },
  token_endpoint: {
    label: 'Token obtido num endpoint',
    keysHint: 'Cada chave é um {placeholder} do endpoint de token',
    sends: 'O token obtido fica disponível como {token} nos outros endpoints',
  },
}

/** Auth types the first-run journey offers (the rest are set up on the API page). */
export const SETUP_AUTH_TYPES = ['none', 'bearer', 'basic', 'api_key'] as const

export function getAuthModes(authTemplate: unknown): AuthModeConfig[] {
  if (!authTemplate || typeof authTemplate !== 'object') return []
  if (Array.isArray(authTemplate)) return authTemplate as AuthModeConfig[]
  const t = authTemplate as Record<string, unknown>
  if (!t.type || t.type === 'none') return []
  return [{ id: 'default', type: String(t.type), label: String(t.label ?? ''), fields: (t.fields as AuthModeConfig['fields']) ?? [], tokenEndpointId: t.tokenEndpointId as number | undefined, tokenPath: t.tokenPath as string | undefined }]
}

export function getModeCredentials(
  authConfig: unknown,
  modeId: string,
  modeIds: string[]
): Record<string, string> {
  if (!authConfig || typeof authConfig !== 'object') return {}
  const cfg = authConfig as Record<string, unknown>
  const isNewFormat = modeIds.some((id) => id in cfg && typeof cfg[id] === 'object' && cfg[id] !== null)
  if (isNewFormat) return (cfg[modeId] ?? {}) as Record<string, string>
  // Legacy flat format ({ token, app }) predates multi-mode: it holds credentials
  // for the first mode only. Returning it for every mode leaks the wrong fields
  // (e.g. body_fields creds answering a 'basic' mode lookup).
  if (modeIds.length > 0 && modeId !== modeIds[0]) return {}
  return cfg as Record<string, string>
}

export function hasFilledCredentials(modeConfig: unknown): boolean {
  if (!modeConfig || typeof modeConfig !== 'object') return false
  const cfg = modeConfig as Record<string, unknown>
  // token_endpoint modes nest their credentials under `params`
  const values = cfg.params && typeof cfg.params === 'object' ? cfg.params : cfg
  return Object.values(values as Record<string, unknown>).some((v) => typeof v === 'string' && v.trim() !== '')
}

/**
 * Which key of a keyed authConfig ({ modeId: { ... } }) holds the active config,
 * or null when the config is the legacy flat format. The form writes every
 * declared mode, so "first mode wins" would pick blank credentials whenever a
 * company authenticates through a later mode (e.g. an OAuth password grant vs
 * client_credentials) — the filled one wins instead.
 */
function resolveModeKey(cfg: Record<string, unknown>, modeIds: string[]): string | null {
  const chosen = modeIds.find((id) => hasFilledCredentials(cfg[id])) ?? modeIds[0]
  if (chosen == null) return null
  const nested = cfg[chosen]
  return nested && typeof nested === 'object' ? chosen : null
}

/** Credentials of the active auth mode. Legacy flat configs are returned as-is. */
export function pickModeConfig(authConfig: unknown, modeIds: string[]): Record<string, unknown> {
  if (!authConfig || typeof authConfig !== 'object') return {}
  const cfg = authConfig as Record<string, unknown>
  const key = resolveModeKey(cfg, modeIds)
  return key ? (cfg[key] as Record<string, unknown>) : cfg
}

/**
 * Merges a patch (cached token, timestamp) into the active mode and returns the
 * FULL authConfig, so persisting it never clobbers the other modes' credentials.
 */
export function withTokenCache(
  authConfig: unknown,
  modeIds: string[],
  patch: Record<string, unknown>
): Record<string, unknown> {
  const cfg = (authConfig && typeof authConfig === 'object' ? authConfig : {}) as Record<string, unknown>
  const key = resolveModeKey(cfg, modeIds)
  if (!key) return { ...cfg, ...patch }
  return { ...cfg, [key]: { ...(cfg[key] as Record<string, unknown>), ...patch } }
}

/** Auth chosen for a request: the mode (from the ERP's current template) and its credentials. */
export type ResolvedAuth = {
  mode: AuthModeConfig
  creds: Record<string, unknown>
  /** Credentials stored per mode ({ modeId: {...} }) rather than the legacy flat shape. */
  keyed: boolean
}

/**
 * The auth a request uses: the endpoint's mode when it names a declared one, otherwise the
 * first mode with credentials filled in (or the first mode). Type, token endpoint and token
 * path always come from the ERP's template as it is now, never from the copy a company saved,
 * so editing the ERP applies to every company. Credentials are read in either stored shape:
 * keyed by mode, or legacy flat (= the first mode), so adding a mode doesn't strand them.
 */
export function resolveAuth(
  authTemplate: unknown,
  authConfig: unknown,
  endpointAuthMode?: string | null,
  /** Company's own type, used only when the ERP declares no mode (companies from before templates). */
  legacyType?: string | null
): ResolvedAuth | null {
  let modes = getAuthModes(authTemplate)
  if (!modes.length) {
    if (!legacyType || legacyType === 'none') return null
    modes = [{ id: 'default', type: legacyType, label: '', fields: [] }]
  }
  const modeIds = modes.map((m) => m.id)
  const cfg = (authConfig && typeof authConfig === 'object' ? authConfig : {}) as Record<string, unknown>
  const keyed = modeIds.some((id) => cfg[id] !== null && typeof cfg[id] === 'object')
  const credsOf = (id: string) => (keyed ? ((cfg[id] ?? {}) as Record<string, unknown>) : id === modeIds[0] ? cfg : {})
  const mode = modes.find((m) => m.id === endpointAuthMode)
    ?? modes.find((m) => hasFilledCredentials(credsOf(m.id)))
    ?? modes[0]
  return { mode, creds: credsOf(mode.id), keyed }
}

/** withTokenCache for a known mode: writes the token next to that mode's credentials. */
export function withTokenCacheFor(authConfig: unknown, auth: ResolvedAuth, patch: Record<string, unknown>): Record<string, unknown> {
  const cfg = (authConfig && typeof authConfig === 'object' ? authConfig : {}) as Record<string, unknown>
  if (!auth.keyed) return { ...cfg, ...patch }
  return { ...cfg, [auth.mode.id]: { ...((cfg[auth.mode.id] ?? {}) as Record<string, unknown>), ...patch } }
}

/** Only the string values of a credentials object (drops cached-token metadata, nested params). */
export function stringCreds(creds: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(creds).filter(([, v]) => typeof v === 'string')) as Record<string, string>
}

// Renew a little before the server-side expiry so a request never races it.
const TOKEN_EXPIRY_MARGIN_MS = 60_000

/** A cached token that is present and, when its lifetime is known, not about to expire. */
export function isTokenFresh(cfg: unknown, now = Date.now()): boolean {
  if (!cfg || typeof cfg !== 'object') return false
  const { cachedToken, expiresAt } = cfg as { cachedToken?: unknown; expiresAt?: unknown }
  if (typeof cachedToken !== 'string' || cachedToken === '') return false
  return typeof expiresAt !== 'number' || now < expiresAt - TOKEN_EXPIRY_MARGIN_MS
}

/** True if a usable token is cached, whether flat (single-mode) or nested under a mode. */
export function hasCachedToken(authConfig: unknown, now = Date.now()): boolean {
  if (!authConfig || typeof authConfig !== 'object') return false
  if (isTokenFresh(authConfig, now)) return true
  return Object.values(authConfig as Record<string, unknown>).some((v) => isTokenFresh(v, now))
}

/**
 * Cache entry for a token-endpoint response. Reads the OAuth-style `expires_in` (seconds)
 * next to the token or at the response root; without it the token is kept until a 401.
 */
export function tokenCacheEntry(json: unknown, tokenPath: string, token: string, now = Date.now()) {
  const parentPath = tokenPath.split('.').slice(0, -1)
  let parent: unknown = json
  for (const key of parentPath) parent = parent && typeof parent === 'object' ? (parent as Record<string, unknown>)[key] : undefined
  const pick = (o: unknown) => {
    if (!o || typeof o !== 'object') return undefined
    const r = o as Record<string, unknown>
    const v = Number(r.expires_in ?? r.expiresIn)
    return Number.isFinite(v) && v > 0 ? v : undefined
  }
  const expiresIn = pick(parent) ?? pick(json)
  return { cachedToken: token, cachedAt: now, ...(expiresIn ? { expiresAt: now + expiresIn * 1000 } : {}) }
}

export function buildAuthHeadersForMode(modeType: string, creds: Record<string, string>): Record<string, string> {
  switch (modeType) {
    case 'bearer':
      return creds.token ? { Authorization: `Bearer ${creds.token}` } : {}
    case 'api_key':
      return creds.header && creds.value ? { [creds.header]: creds.value } : {}
    case 'basic':
      return creds.username && creds.password
        ? { Authorization: `Basic ${btoa(`${creds.username}:${creds.password}`)}` }
        : {}
    case 'custom_headers':
      return { ...creds }
    default:
      return {}
  }
}

export function buildAuthHeaders(company: {
  authType: string | null
  authConfig: unknown
}): Record<string, string> {
  const cfg = (company.authConfig ?? {}) as Record<string, string>
  switch (company.authType) {
    case 'bearer':
      return cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}
    case 'api_key':
      return cfg.header && cfg.value ? { [cfg.header]: cfg.value } : {}
    case 'basic':
      return cfg.username && cfg.password
        ? { Authorization: `Basic ${btoa(`${cfg.username}:${cfg.password}`)}` }
        : {}
    case 'custom_headers':
      return { ...cfg }
    default:
      return {}
  }
}

export function buildAuthBodyFields(company: {
  authType: string | null
  authConfig: unknown
}): Record<string, string> {
  if (company.authType !== 'body_fields') return {}
  const cfg = (company.authConfig ?? {}) as Record<string, unknown>
  // Detect new keyed format: if any key maps to an object, use "default" mode
  const isKeyed = Object.values(cfg).some((v) => typeof v === 'object' && v !== null)
  if (isKeyed) return (cfg['default'] ?? {}) as Record<string, string>
  return cfg as Record<string, string>
}
