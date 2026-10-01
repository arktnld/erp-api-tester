'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Pencil, Trash2, User, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteTestClient, duplicateTestClient } from '@/lib/actions/test-clients'
import { useRole } from '@/lib/role-context'

type FieldSchema = {
  id: number
  fieldName: string
  label: string
  fieldType: string
  required: boolean
}
type TestClient = {
  id: number
  name: string
  fieldsData: unknown
}
type ERP = {
  id: number
  name: string
  fieldSchemas: FieldSchema[]
}
type Company = {
  id: number
  name: string
  baseUrl: string
  authType: string
  authConfig: unknown
  notes: string
  erp: ERP
  testClients: TestClient[]
}

function copyText(text: string) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text)
  }
  // Fallback para HTTP (sem HTTPS clipboard API)
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;opacity:0'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  return Promise.resolve()
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const hasLabel = label !== ''

  function handleCopy() {
    copyText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title={`Copiar ${label || 'valor'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: hasLabel ? 4 : 0,
        fontSize: 11,
        padding: hasLabel ? '2px 8px' : '2px 5px',
        borderRadius: 4,
        border: `1px solid ${copied ? 'var(--status-success)' : 'var(--border)'}`,
        backgroundColor: copied ? 'color-mix(in srgb, var(--status-success) 12%, transparent)' : 'var(--surface-2)',
        color: copied ? 'var(--status-success)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
      {hasLabel && (
        <span style={{ display: 'inline-grid' }}>
          <span style={{ gridArea: '1/1', visibility: copied ? 'visible' : 'hidden' }}>Copiado!</span>
          <span style={{ gridArea: '1/1', visibility: copied ? 'hidden' : 'visible' }}>{label}</span>
        </span>
      )}
    </button>
  )
}

function AuthCopyButton({ authType, authConfig }: { authType: string; authConfig: unknown }) {
  if (authType === 'none' || !authConfig) return null
  const config = authConfig as Record<string, string>
  if (Object.keys(config).length === 0) return null

  let value: string | null = null
  if (authType === 'bearer' && config.token) {
    value = config.token
  } else if (authType === 'basic' && config.username && config.password) {
    value = btoa(`${config.username}:${config.password}`)
  } else if (authType === 'api_key' && config.value) {
    value = config.value
  } else if (authType === 'token_endpoint') {
    // Multi-grant ERPs nest the cache under the mode id, so look one level down too
    const nested = Object.values(config).filter((v) => v && typeof v === 'object') as { cachedToken?: string }[]
    value = config.cachedToken ?? nested.find((c) => c.cachedToken)?.cachedToken ?? null
  }

  if (!value) return null
  return <CopyButton value={value} label="Copiar token" />
}

export function CompanyDetailClient({ company }: { company: Company }) {
  const [, startTransition] = useTransition()
  const { canEdit } = useRole()

  return (
    <div style={{ padding: '32px 40px' }}>
      <Link
        href="/companies"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}
      >
        <ChevronLeft size={14} /> Empresas
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{company.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              ERP:{' '}
              <Link href={`/erps/${company.erp.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                {company.erp.name}
              </Link>
            </span>
            {company.baseUrl && (
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle)', backgroundColor: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                {company.baseUrl}
              </span>
            )}
            {company.authType !== 'none' && (
              <span style={{ fontSize: 11, color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '2px 8px', borderRadius: 4 }}>
                {company.authType}
              </span>
            )}
            <AuthCopyButton authType={company.authType} authConfig={company.authConfig} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {company.testClients.length} cliente{company.testClients.length !== 1 ? 's' : ''}
            </span>
          </div>
          {company.notes && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, maxWidth: 600 }}>
              {company.notes}
            </p>
          )}
        </div>
        {canEdit && (
          <Link href={`/companies/${company.id}/clients/new`}>
            <Button><Plus size={14} /> Novo Cliente</Button>
          </Link>
        )}
      </div>

      {company.testClients.length === 0 ? (
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 40px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <User size={24} color="var(--text-muted)" />
          </div>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Nenhum cliente cadastrado</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 320, margin: '0 auto' }}>
            Clique em &quot;Novo Cliente&quot; para adicionar um cliente de teste.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {company.testClients.map((client) => {
            const fields = client.fieldsData as unknown as Record<string, string>
            return (
              <div
                key={client.id}
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, transition: 'border-color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={15} color="var(--accent)" />
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{client.name}</span>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <Link href={`/companies/${company.id}/clients/${client.id}/edit`}>
                        <Button variant="ghost" size="sm" title="Editar"><Pencil size={12} /></Button>
                      </Link>
                      <Button variant="ghost" size="sm" title="Duplicar" onClick={() => startTransition(() => duplicateTestClient(client.id, company.id))}>
                        <Copy size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Excluir"
                        onClick={() => startTransition(() => deleteTestClient(client.id, company.id))}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>

                {company.erp.fieldSchemas.length > 0 && (
                  <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {company.erp.fieldSchemas.map((fs) => (
                      <div key={fs.fieldName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{fs.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'monospace', color: fields[fs.fieldName] ? 'var(--text)' : 'var(--text-subtle)' }}>
                            {fields[fs.fieldName] || '—'}
                          </span>
                          {fields[fs.fieldName] && (
                            <CopyButton value={fields[fs.fieldName]} label="" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
