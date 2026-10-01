import type { AuthModeConfig } from '@/lib/auth'
import ixc from './ixc.json'
import sgp from './sgp.json'
import hubsoft from './hubsoft.json'
import voalle from './voalle.json'
import mk from './mk.json'

// Ready-made ERP configurations (endpoints, auth modes, client fields with auto-fill) taken
// from the ones in production, without companies, credentials or clients. Used by /setup.
export type ErpTemplate = {
  slug: string
  name: string
  description: string
  /** Regexes matched against a company's API URL to suggest this template. */
  detect: string[]
  baseUrlExample: string
  /** Where to find each credential, by auth field key. */
  credentialHints: Record<string, string>
  /** Cheap read used to test the connection when the auth mode doesn't have a token endpoint. */
  probeEndpoint: string | null
  /** Endpoint for the first real call: looks a client up by {cpfcnpj}. */
  firstCall: string
  authModes: (Omit<AuthModeConfig, 'tokenEndpointId'> & { tokenEndpoint?: string })[]
  endpoints: {
    key: string; name: string; method: string; pathTemplate: string; bodyTemplate: string; headers: string
    group: string; requiresClient: boolean; isModification: boolean; notes: string; authMode: string
  }[]
  fieldSchemas: {
    fieldName: string; label: string; fieldType: string; required: boolean
    endpointParam: string; responsePath: string; defaultValue: string; source: string | null
  }[]
}

export const ERP_TEMPLATES = [ixc, sgp, hubsoft, voalle, mk] as ErpTemplate[]

export function templateBySlug(slug: string): ErpTemplate | undefined {
  return ERP_TEMPLATES.find((t) => t.slug === slug)
}

/** The template whose URL patterns match, e.g. "...hubsoft.com.br" → Hubsoft. */
export function detectTemplate(url: string): ErpTemplate | undefined {
  const u = url.trim()
  if (!u) return undefined
  return ERP_TEMPLATES.find((t) => t.detect.some((re) => new RegExp(re, 'i').test(u)))
}
