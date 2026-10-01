import { buildAuthBodyFields, hasFilledCredentials } from './auth'

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
  defaults: Record<string, string> = {}
): Record<string, string> {
  const filled = Object.fromEntries(Object.entries(clientFields).filter(([k, v]) => v !== '' || !(k in defaults)))
  clientFields = { ...defaults, ...filled }
  if (!company) return clientFields
  const base: Record<string, string> = { ...clientFields, ...buildAuthBodyFields(company) }
  if (company.authType === 'token_endpoint') {
    const rawCfg = (company.authConfig ?? {}) as Record<string, unknown>
    // Keyed multi-mode config: prefer the mode that actually has credentials —
    // the first declared mode is often left blank (e.g. a Voalle company on the legacy
    // flow fills only the password grant, never client_credentials).
    const modeCfgs = Object.values(rawCfg).filter(v => typeof v === 'object' && v !== null && !Array.isArray(v))
    const cfg = (modeCfgs.length > 0
      ? (modeCfgs.find(hasFilledCredentials) ?? modeCfgs[0])
      : rawCfg) as { params?: Record<string, string>; cachedToken?: string }
    if (cfg.params) Object.assign(base, cfg.params)
    if (cfg.cachedToken) { base.token = cfg.cachedToken; base.TOKEN = cfg.cachedToken }
  }
  return base
}
