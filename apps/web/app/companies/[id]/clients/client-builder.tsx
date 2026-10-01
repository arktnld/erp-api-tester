'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2, Check, Zap, ChevronDown, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTestClient, updateTestClient } from '@/lib/actions/test-clients'
import { formLabel as labelStyle } from '@/lib/styles'
import { getAuthModes, pickModeConfig } from '@/lib/auth'
import { useClientAutoFill } from './use-client-auto-fill'

type FieldSchema = {
  id: number
  fieldName: string
  label: string
  fieldType: string
  required: boolean
  sourceEndpointId: number | null
  endpointParam: string
  responsePath: string
}
type Endpoint = {
  id: number
  name: string
  method: string
  pathTemplate: string
  bodyTemplate: string | null
}
type ERP = {
  id: number
  name: string
  authTemplate: unknown
  fieldSchemas: FieldSchema[]
  endpoints: Endpoint[]
}
type TokenEndpointConfig = { tokenEndpointId?: number; cachedToken?: string }
type Company = {
  id: number
  name: string
  baseUrl: string
  authType: string
  authConfig: unknown
  erp: ERP
  testClients: { id: number; name: string; fieldsData: unknown }[]
}
type TestClient = {
  id: number
  name: string
  fieldsData: unknown
}

export function ClientBuilder({ company, client }: { company: Company; client?: TestClient }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Multi-grant ERPs key the config by mode id, so read it through the active mode
  const tokenCfg =
    company.authType === 'token_endpoint'
      ? (pickModeConfig(
          company.authConfig,
          getAuthModes(company.erp.authTemplate).map((m) => m.id)
        ) as TokenEndpointConfig)
      : null
  const [tokenValid, setTokenValid] = useState(!!(tokenCfg?.cachedToken))
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState('')

  const obtainToken = async () => {
    if (!tokenCfg?.tokenEndpointId) return
    setTokenLoading(true)
    setTokenError('')
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointId: tokenCfg.tokenEndpointId, companyId: company.id }),
      })
      const data = await res.json() as { statusCode: number; responseBody: string }
      if (data.statusCode >= 200 && data.statusCode < 300) {
        setTokenValid(true)
      } else {
        setTokenError('Falha ao obter token — verifique as credenciais')
      }
    } catch {
      setTokenError('Erro ao conectar com o servidor')
    } finally {
      setTokenLoading(false)
    }
  }

  const [clientName, setClientName] = useState(client?.name ?? '')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const parsed = client ? (client.fieldsData as unknown as Record<string, string>) : {}
    const defaults: Record<string, string> = {}
    company.erp.fieldSchemas.forEach((fs) => {
      defaults[fs.fieldName] = parsed[fs.fieldName] ?? ''
    })
    return defaults
  })

  const {
    endpointGroups,
    uniqueParams,
    autoFillFields,
    identifiers,
    setIdentifiers,
    fetchOpen,
    setFetchOpen,
    fetchLoading,
    fetchStatus,
    fetchError,
    filledCount,
    fetchMissing,
    setFetchMissing,
    handleFetch,
  } = useClientAutoFill(company, fieldValues, setFieldValues)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const fieldsData = JSON.stringify(fieldValues)
    startTransition(async () => {
      if (client) {
        await updateTestClient(client.id, company.id, { name: clientName, fieldsData })
      } else {
        await createTestClient({ name: clientName, companyId: company.id, fieldsData })
      }
      router.push(`/companies/${company.id}`)
    })
  }

  const unmappedFields = company.erp.fieldSchemas.filter((fs) => !fs.sourceEndpointId)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720 }}>
      <Link
        href={`/companies/${company.id}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}
      >
        <ChevronLeft size={14} /> {company.name}
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        {client ? 'Editar Cliente' : 'Novo Cliente de Teste'}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
        {company.name} · {company.erp.name}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Nome do cliente</label>
          <Input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Empresa ABC - Contrato 001"
            required
          />
        </div>

        {endpointGroups.length > 0 && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setFetchOpen((v) => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={14} color="var(--accent)" />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Buscar automaticamente</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  — preenche {company.erp.fieldSchemas.filter((fs) => fs.sourceEndpointId && fs.responsePath).length} campos via API
                </span>
              </div>
              <ChevronDown size={14} color="var(--text-muted)" style={{ transform: fetchOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>

            {fetchOpen && (
              <div style={{ padding: '0 20px 20px' }}>
                {tokenCfg && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, backgroundColor: tokenValid ? 'color-mix(in srgb, var(--status-success) 8%, transparent)' : 'color-mix(in srgb, var(--accent) 6%, transparent)', border: `1px solid ${tokenValid ? 'color-mix(in srgb, var(--status-success) 25%, transparent)' : 'color-mix(in srgb, var(--accent) 25%, transparent)'}`, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: tokenValid ? 'var(--status-success)' : 'var(--text-subtle)', fontWeight: 500 }}>
                      {tokenValid ? '🟢 Token válido' : '🔑 Sem token — busca vai falhar'}
                    </span>
                    <button
                      type="button"
                      onClick={obtainToken}
                      disabled={tokenLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '3px 10px', backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', borderRadius: 4, color: 'var(--accent)', cursor: tokenLoading ? 'default' : 'pointer', opacity: tokenLoading ? 0.6 : 1 }}
                    >
                      {tokenLoading ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Obtendo...</> : <><KeyRound size={11} /> Obter token</>}
                    </button>
                  </div>
                )}
                {tokenError && <p style={{ fontSize: 12, color: 'var(--status-error)', marginBottom: 10 }}>{tokenError}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {uniqueParams.map((param) => (
                    <div key={param}>
                      <label style={{ ...labelStyle, marginTop: 0 }}>
                        <code style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--accent)' }}>{`{${param}}`}</code>
                      </label>
                      <Input
                        value={identifiers[param] ?? ''}
                        onChange={(e) => setIdentifiers((prev) => ({ ...prev, [param]: e.target.value }))}
                        placeholder={`Valor de ${param}`}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetch() } }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                  <button
                    type="button"
                    disabled={fetchLoading || (tokenCfg && !tokenValid) || (uniqueParams.length > 0 && uniqueParams.every((p) => !identifiers[p]))}
                    onClick={handleFetch}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, fontWeight: 500, color: 'white', backgroundColor: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: fetchLoading || uniqueParams.every((p) => !identifiers[p]) ? 0.5 : 1 }}
                  >
                    {fetchLoading ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Buscando...</> : <><Zap size={13} /> Buscar</>}
                  </button>
                  {fetchStatus === 'ok' && (
                    <span style={{ fontSize: 12, color: 'var(--status-success)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} /> {filledCount} campo{filledCount !== 1 ? 's' : ''} preenchido{filledCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {fetchStatus === 'error' && (
                    <span style={{ fontSize: 12, color: 'var(--status-error)' }}>{fetchError}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {company.erp.fieldSchemas.length > 0 && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16 }}>
              Campos do {company.erp.name}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {company.erp.fieldSchemas.map((fs) => {
                const filled = !!fieldValues[fs.fieldName]
                const hasMapping = !!(fs.sourceEndpointId && fs.responsePath)
                const missing = fetchMissing.has(fs.fieldName)
                return (
                  <div key={fs.fieldName}>
                    <label style={labelStyle}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {hasMapping && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: missing ? 'var(--status-error)' : filled ? 'var(--status-success)' : 'var(--border)', flexShrink: 0, display: 'inline-block' }} />
                        )}
                        {fs.label}
                        {fs.required && <span style={{ color: 'var(--status-error)' }}>*</span>}
                        <code style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'monospace' }}>{`{${fs.fieldName}}`}</code>
                        {missing && (
                          <span style={{ fontSize: 10, color: 'var(--status-error)' }}>não encontrado</span>
                        )}
                      </span>
                    </label>
                    <Input
                      value={fieldValues[fs.fieldName] ?? ''}
                      onChange={(e) => {
                        setFieldValues((prev) => ({ ...prev, [fs.fieldName]: e.target.value }))
                        if (missing) setFetchMissing((prev) => { const s = new Set(prev); s.delete(fs.fieldName); return s })
                      }}
                      required={fs.required}
                      placeholder={`${fs.fieldType}...`}
                      style={missing ? { borderColor: 'var(--status-error)' } : undefined}
                    />
                  </div>
                )
              })}
            </div>

            {unmappedFields.length > 0 && endpointGroups.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 12 }}>
                {unmappedFields.length} campo{unmappedFields.length !== 1 ? 's' : ''} sem preenchimento automático — preencha manualmente.
              </p>
            )}
          </div>
        )}

        <Button type="submit" disabled={isPending} style={{ width: '100%' }}>
          {isPending ? 'Salvando...' : client ? 'Atualizar Cliente' : 'Criar Cliente'}
        </Button>
      </form>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
