import { buildAuthBodyFields, getAuthModes, hasFilledCredentials, resolveAuth, stringCreds } from './auth'
import { substitute } from './utils'

/** Keep previews and execution consistent when a company uses another auth mode. */
export function resolveBodyTemplate(template: string, fields: Record<string, string>, authTemplate?: unknown): string {
  const body = substitute(template, fields)
  const unused = getAuthModes(authTemplate).filter((m) => m.type === 'body_fields')
    .flatMap((m) => m.fields.map((f) => f.key)).filter((key) => !fields[key])
  if (!unused.length) return body
  try {
    const doc = JSON.parse(body)
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return body
    const kept = Object.entries(doc).filter(([key, value]) => !(unused.includes(key) && value === `{${key}}`))
    return kept.length === Object.keys(doc).length ? body : JSON.stringify(Object.fromEntries(kept))
  } catch { return body }
}

/** Default values of an ERP's client fields, by field name (only the ones that have one). */
export function fieldDefaults(schemas: { fieldName: string; defaultValue?: string | null }[] | null | undefined): Record<string, string> {
  return Object.fromEntries((schemas ?? []).filter((f) => f.defaultValue).map((f) => [f.fieldName, f.defaultValue as string]))
}

/**
 * Values for {placeholders}: field defaults, then the test client's values (an empty value
 * falls back to the default), then auth fields.
 */
export function mergeFields(
  clientFields: Record<string, string>,
  company: { authType: string | null; authConfig: unknown } | null | undefined,
  defaults: Record<string, string> = {},
  context?: { authTemplate: unknown; endpoint?: { id: number; authMode?: string | null } }
): Record<string, string> {
  const filled = Object.fromEntries(Object.entries(clientFields).filter(([k, v]) => v !== '' || !(k in defaults)))
  clientFields = { ...defaults, ...filled }
  if (!company) return clientFields
  if (context) {
    const baseAuth = resolveAuth(context.authTemplate, company.authConfig, null, company.authType)
    const ownMode = getAuthModes(context.authTemplate).find((m) => m.type === 'token_endpoint' && m.tokenEndpointId === context.endpoint?.id)
    const auth = resolveAuth(context.authTemplate, company.authConfig, context.endpoint?.authMode || ownMode?.id, company.authType)
    const base = { ...clientFields }
    for (const a of [baseAuth, auth]) if (a?.mode.type === 'body_fields') Object.assign(base, stringCreds(a.creds))
    const tokenAuth = auth?.mode.type === 'token_endpoint' ? auth : baseAuth?.mode.type === 'token_endpoint' ? baseAuth : null
    if (tokenAuth) {
      const cfg = tokenAuth.creds as { params?: Record<string, string>; cachedToken?: string }
      Object.assign(base, cfg.params)
      if (cfg.cachedToken) { base.token = cfg.cachedToken; base.TOKEN = cfg.cachedToken }
    }
    return base
  }
  const base: Record<string, string> = { ...clientFields, ...buildAuthBodyFields(company) }
  if (company.authType === 'token_endpoint') {
    const rawCfg = (company.authConfig ?? {}) as Record<string, unknown>
    // Keyed multi-mode config: prefer the mode that actually has credentials —
    // the first declared mode is often left blank (e.g. a company on a legacy
    // flow fills only the password grant, never client_credentials).
    const modeCfgs = Object.values(rawCfg).filter(v => typeof v === 'object' && v !== null && !Array.isArray(v))
    const cfg = ('params' in rawCfg || 'tokenEndpointId' in rawCfg ? rawCfg : modeCfgs.length > 0
      ? (modeCfgs.find(hasFilledCredentials) ?? modeCfgs[0])
      : rawCfg) as { params?: Record<string, string>; cachedToken?: string }
    if (cfg.params) Object.assign(base, cfg.params)
    if (cfg.cachedToken) { base.token = cfg.cachedToken; base.TOKEN = cfg.cachedToken }
  }
  return base
}
