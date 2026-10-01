import { describe, it, expect } from 'vitest'
import { ERP_TEMPLATES, detectTemplate } from '.'
import { placeholdersIn } from '@/lib/placeholders'

describe('ERP templates', () => {
  it('detect the ERP from a company API URL', () => {
    expect(detectTemplate('https://api.provedorx.hubsoft.com.br')?.slug).toBe('hubsoft')
    expect(detectTemplate('https://acesso.provedor.com.br/webservice/v1')?.slug).toBe('ixc')
    expect(detectTemplate('https://provedorx.sgp.net.br')?.slug).toBe('sgp')
    expect(detectTemplate('https://mk-solutions.provedor.com.br/mk')?.slug).toBe('mk')
    expect(detectTemplate('https://erp.provedor.com.br:45700')?.slug).toBe('voalle')
    expect(detectTemplate('https://example.com')).toBeUndefined()
  })

  for (const t of ERP_TEMPLATES) {
    describe(t.name, () => {
      const keys = new Set(t.endpoints.map((e) => e.key))

      it('references only endpoints and modes that exist', () => {
        expect(keys.has(t.firstCall)).toBe(true)
        if (t.probeEndpoint) expect(keys.has(t.probeEndpoint)).toBe(true)
        for (const m of t.authModes) if (m.type === 'token_endpoint') expect(keys.has(m.tokenEndpoint!)).toBe(true)
        for (const f of t.fieldSchemas) if (f.source) expect(keys.has(f.source)).toBe(true)
        const modeIds = new Set(t.authModes.map((m) => m.id))
        for (const e of t.endpoints) if (e.authMode) expect(modeIds.has(e.authMode)).toBe(true)
      })

      it('can test the connection: a token endpoint or a probe for every mode', () => {
        for (const m of t.authModes) expect(m.type === 'token_endpoint' || !!t.probeEndpoint).toBe(true)
      })

      it('first call looks the client up by {cpfcnpj}', () => {
        const ep = t.endpoints.find((e) => e.key === t.firstCall)!
        expect(placeholdersIn(ep.pathTemplate + ep.bodyTemplate)).toContain('cpfcnpj')
      })

      it('carries no credential examples', () => {
        for (const m of t.authModes) for (const f of m.fields) expect(f.placeholder ?? '').toBe('')
      })
    })
  }
})
