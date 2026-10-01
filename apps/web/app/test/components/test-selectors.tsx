'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, Search, CheckCircle2, KeyRound } from 'lucide-react'
import type { ERP, Endpoint, Company, Environment } from '../lib/types'
import { hasCachedToken } from '@/lib/auth'

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--method-get)',
  POST: 'var(--method-post)',
  PUT: 'var(--method-put)',
  PATCH: 'var(--method-patch)',
  DELETE: 'var(--method-delete)',
}

function MethodTag({ method }: { method: string }) {
  const color = METHOD_COLORS[method] ?? 'var(--text-muted)'
  return (
    <span style={{
      fontFamily: 'monospace', fontSize: 9, fontWeight: 700,
      color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      padding: '1px 5px', borderRadius: 3, flexShrink: 0,
    }}>
      {method}
    </span>
  )
}

function SectionHeader({
  number, label, selectedLabel, selectedExtra, isOpen, disabled, onToggle, buttonRef,
}: {
  number: number
  label: string
  selectedLabel?: string
  selectedExtra?: React.ReactNode
  isOpen: boolean
  disabled?: boolean
  onToggle: () => void
  buttonRef: React.RefObject<HTMLButtonElement | null>
}) {
  const completed = !!selectedLabel

  // Gitea form field: bold label (✓ when filled, else step number) over a selection dropdown.
  return (
    <div style={{ padding: '6px 8px', opacity: disabled ? 0.45 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>
        {completed
          ? <CheckCircle2 size={14} style={{ color: 'var(--status-success)', flexShrink: 0 }} aria-hidden />
          : <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--border-2)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{number}</span>}
        {label}
      </div>
      <button
        ref={buttonRef}
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-label={`${label}: ${selectedLabel ?? 'selecionar'}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', height: 34, padding: '0 10px', borderRadius: 'var(--radius)',
          background: 'var(--input-bg)',
          border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--input-border)'}`,
          boxShadow: isOpen ? '0 0 0 3px var(--accent-soft)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          transition: 'border-color 0.1s, box-shadow 0.1s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {selectedExtra}
          <span style={{ fontSize: 13, color: selectedLabel ? 'var(--text)' : 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedLabel ?? 'Selecionar...'}
          </span>
        </span>
        <ChevronDown
          size={14}
          style={{ color: 'var(--text-muted)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>
    </div>
  )
}

function SearchInput({ value, onChange, placeholder, inputRef }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div style={{ position: 'relative', marginBottom: 4 }}>
      <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar...'}
        style={{ width: '100%', padding: '6px 8px 6px 26px', fontSize: 13, borderRadius: 'var(--radius)', border: '1px solid var(--input-border)', backgroundColor: 'var(--input-bg)', color: 'var(--text)' }}
      />
    </div>
  )
}

function ItemList<T extends { id: number; name: string }>({
  items, selectedId, onSelect, renderLabel,
}: {
  items: T[]
  selectedId: number | null
  onSelect: (id: number) => void
  renderLabel?: (item: T) => React.ReactNode
}) {
  if (items.length === 0) {
    return <p style={{ fontSize: 11, color: 'var(--text-subtle)', padding: '4px 8px' }}>Nenhum resultado</p>
  }
  return (
    <>
      {items.map((item) => {
        const active = item.id === selectedId
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              width: '100%', padding: '6px 8px', borderRadius: 5,
              background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'none',
              border: 'none', cursor: 'pointer', textAlign: 'left',
              color: active ? 'var(--accent)' : 'var(--text)', fontSize: 12,
              transition: 'background 0.08s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {renderLabel ? renderLabel(item) : item.name}
            </span>
            <Check size={11} style={{ flexShrink: 0, opacity: active ? 1 : 0 }} />
          </button>
        )
      })}
    </>
  )
}

function EndpointList({ endpoints, selectedId, onSelect, query }: {
  endpoints: Endpoint[]
  selectedId: number | null
  onSelect: (id: number) => void
  query: string
}) {
  const q = query.toLowerCase()
  const filtered = endpoints.filter((ep) => ep.name && (
    ep.name.toLowerCase().includes(q) ||
    ep.method.toLowerCase().includes(q) ||
    (ep.group ?? '').toLowerCase().includes(q)
  ))

  const consulta = filtered.filter((ep) => !ep.isModification)
  const modificacao = filtered.filter((ep) => ep.isModification)

  function renderGroup(eps: Endpoint[]) {
    const withGroup = eps.filter((ep) => ep.group)
    const withoutGroup = eps.filter((ep) => !ep.group)
    const groups = [...new Set(withGroup.map((ep) => ep.group))]
    return (
      <>
        {groups.map((g) => (
          <div key={g}>
            <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 8px 2px', fontWeight: 600 }}>{g}</p>
            {withGroup.filter((ep) => ep.group === g).map((ep) => (
              <EndpointItem key={ep.id} ep={ep} active={ep.id === selectedId} onSelect={onSelect} />
            ))}
          </div>
        ))}
        {withoutGroup.map((ep) => (
          <EndpointItem key={ep.id} ep={ep} active={ep.id === selectedId} onSelect={onSelect} />
        ))}
      </>
    )
  }

  if (filtered.length === 0) {
    return <p style={{ fontSize: 11, color: 'var(--text-subtle)', padding: '4px 8px' }}>Nenhum resultado</p>
  }

  return (
    <>
      {consulta.length > 0 && (
        <>
          {modificacao.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 8px 2px', fontWeight: 600 }}>Consulta</p>
          )}
          {renderGroup(consulta)}
        </>
      )}
      {modificacao.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 8px 2px', fontWeight: 600 }}>Modificação</p>
          {renderGroup(modificacao)}
        </>
      )}
    </>
  )
}

function EndpointItem({ ep, active, onSelect }: { ep: Endpoint; active: boolean; onSelect: (id: number) => void }) {
  return (
    <button
      onClick={() => onSelect(ep.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '6px 8px', borderRadius: 5,
        background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'none',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        color: active ? 'var(--accent)' : 'var(--text)', fontSize: 12,
        transition: 'background 0.08s',
      }}
    >
      <MethodTag method={ep.method} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{ep.name}</span>
      <Check size={11} style={{ flexShrink: 0, opacity: active ? 1 : 0 }} />
    </button>
  )
}

interface TestSelectorsProps {
  erps: ERP[]
  erpId: number | null
  companyId: number | null
  endpointId: number | null
  clientId: number | null
  environmentUrl: string | null
  needsClient: boolean
  erp: ERP | undefined
  company: Company | undefined
  companyEnvironments: Environment[]
  tokenAcquired: boolean
  onErpChange: (id: number | null) => void
  onCompanyChange: (id: number | null) => void
  onEndpointChange: (id: number | null) => void
  onClientChange: (id: number | null) => void
  onEnvironmentChange: (url: string | null) => void
  onObtainToken: () => void
}

type OpenKey = 'erp' | 'company' | 'endpoint' | 'client'

export function TestSelectors({
  erps, erpId, companyId, endpointId, clientId, environmentUrl,
  needsClient, erp, company, companyEnvironments, tokenAcquired,
  onErpChange, onCompanyChange, onEndpointChange, onClientChange, onEnvironmentChange, onObtainToken,
}: TestSelectorsProps) {
  const [openKey, setOpenKey] = useState<OpenKey | null>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 260 })
  const [q, setQ] = useState({ erp: '', company: '', endpoint: '', client: '' })

  const erpBtnRef = useRef<HTMLButtonElement>(null)
  const companyBtnRef = useRef<HTMLButtonElement>(null)
  const endpointBtnRef = useRef<HTMLButtonElement>(null)
  const clientBtnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const erpInputRef = useRef<HTMLInputElement>(null)
  const companyInputRef = useRef<HTMLInputElement>(null)
  const endpointInputRef = useRef<HTMLInputElement>(null)
  const clientInputRef = useRef<HTMLInputElement>(null)

  function openSection(key: OpenKey) {
    const refs = { erp: erpBtnRef, company: companyBtnRef, endpoint: endpointBtnRef, client: clientBtnRef }
    const rect = refs[key].current?.getBoundingClientRect()
    if (rect) {
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 240) })
    }
    setQ(prev => ({ ...prev, [key]: '' }))
    setOpenKey(key)
    const inputRefs = { erp: erpInputRef, company: companyInputRef, endpoint: endpointInputRef, client: clientInputRef }
    setTimeout(() => inputRefs[key].current?.focus(), 30)
  }

  function closeDropdown() { setOpenKey(null) }

  function toggleSection(key: OpenKey) {
    if (openKey === key) closeDropdown()
    else openSection(key)
  }


  // Click outside to close
  useEffect(() => {
    if (!openKey) return
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (dropdownRef.current?.contains(target)) return
      if (
        erpBtnRef.current?.contains(target) ||
        companyBtnRef.current?.contains(target) ||
        endpointBtnRef.current?.contains(target) ||
        clientBtnRef.current?.contains(target)
      ) return
      closeDropdown()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [openKey])

  function handleErpSelect(id: number) {
    onErpChange(id === erpId ? null : id)
    if (id !== erpId) openSection('company')
  }

  function handleCompanySelect(id: number) {
    onCompanyChange(id === companyId ? null : id)
    if (id !== companyId) openSection('endpoint')
  }

  function handleEndpointSelect(id: number) {
    onEndpointChange(id === endpointId ? null : id)
    if (id !== endpointId) {
      const newEndpoint = erp?.endpoints.find(ep => ep.id === id)
      const newNeedsClient = newEndpoint?.requiresClient !== false
      if (newNeedsClient) openSection('client')
      else closeDropdown()
    }
  }

  function handleClientSelect(id: number) {
    onClientChange(id === clientId ? null : id)
    if (id !== clientId) closeDropdown()
  }

  const selectedEndpoint = erp?.endpoints.find((ep) => ep.id === endpointId)
  const selectedClient = company?.testClients.find((tc) => tc.id === clientId)

  const filteredErps = erps.filter((e) => e.name && e.name.toLowerCase().includes(q.erp.toLowerCase()))
  const filteredCompanies = (erp?.companies ?? []).filter((c) => c.name && c.name.toLowerCase().includes(q.company.toLowerCase()))
  const filteredClients = (company?.testClients ?? []).filter((tc) => tc.name && tc.name.toLowerCase().includes(q.client.toLowerCase()))

  return (
    <div style={{ width: 260, minWidth: 260, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '8px 6px', flex: 1 }}>

        {/* 1. ERP */}
        <SectionHeader
          number={1} label="ERP"
          selectedLabel={erp?.name}
          isOpen={openKey === 'erp'}
          buttonRef={erpBtnRef}
          onToggle={() => toggleSection('erp')}
        />

        {/* 2. Empresa */}
        <SectionHeader
          number={2} label="Empresa"
          selectedLabel={company?.name}
          isOpen={openKey === 'company'}
          disabled={!erpId}
          buttonRef={companyBtnRef}
          onToggle={() => toggleSection('company')}
        />

        {/* Token status */}
        {companyId && company?.authType === 'token_endpoint' && (() => {
          const valid = tokenAcquired || hasCachedToken(company.authConfig)
          const tone = valid ? 'var(--status-success)' : 'var(--status-warning)'
          // Gitea positive / warning message
          return (
            <div role="status" style={{ margin: '0 8px 6px', padding: '8px 10px', borderRadius: 'var(--radius)', border: `1px solid color-mix(in srgb, ${tone} 45%, transparent)`, backgroundColor: `color-mix(in srgb, ${tone} 10%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, color: tone, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                {valid ? <CheckCircle2 size={13} aria-hidden /> : <KeyRound size={13} aria-hidden />}
                {valid ? 'Token válido' : 'Sem token válido'}
              </span>
              <button onClick={onObtainToken} className="btn-ghost btn-sm" style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>
                Obter token
              </button>
            </div>
          )
        })()}

        {/* 3. Endpoint */}
        <SectionHeader
          number={3} label="Endpoint"
          selectedLabel={selectedEndpoint?.name}
          isOpen={openKey === 'endpoint'}
          disabled={!erpId}
          buttonRef={endpointBtnRef}
          onToggle={() => toggleSection('endpoint')}
        />

        {/* 4. Cliente de Teste */}
        <SectionHeader
          number={4} label={needsClient ? 'Cliente de Teste' : 'Cliente (não necessário)'}
          selectedLabel={selectedClient?.name}
          isOpen={openKey === 'client'}
          disabled={!companyId || !needsClient}
          buttonRef={clientBtnRef}
          onToggle={() => toggleSection('client')}
        />

      </div>

      {/* Floating dropdown panel */}
      {openKey && (
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 999,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-box)',
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
            padding: '6px 4px',
          }}
        >
          {openKey === 'erp' && (
            <>
              <SearchInput value={q.erp} onChange={(v) => setQ(prev => ({ ...prev, erp: v }))} placeholder="Buscar ERP..." inputRef={erpInputRef} />
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <ItemList items={filteredErps} selectedId={erpId} onSelect={handleErpSelect} />
              </div>
            </>
          )}

          {openKey === 'company' && (
            <>
              <SearchInput value={q.company} onChange={(v) => setQ(prev => ({ ...prev, company: v }))} placeholder="Buscar empresa..." inputRef={companyInputRef} />
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <ItemList items={filteredCompanies} selectedId={companyId} onSelect={handleCompanySelect} />
              </div>
              {companyEnvironments.length > 0 && companyId && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '0 8px 4px', fontWeight: 600 }}>Ambiente</p>
                  {[{ id: 'prod', name: 'Produção', url: '' }, ...companyEnvironments.map((e) => ({ id: e.name, name: e.name, url: e.url }))].map((env) => (
                    <button
                      key={env.id}
                      onClick={() => onEnvironmentChange(env.url || null)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                        width: '100%', padding: '6px 8px', borderRadius: 5, fontSize: 12,
                        background: (environmentUrl ?? '') === env.url ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'none',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        color: (environmentUrl ?? '') === env.url ? 'var(--accent)' : 'var(--text)',
                        transition: 'background 0.08s',
                      }}
                    >
                      {env.name}
                      <Check size={11} style={{ flexShrink: 0, opacity: (environmentUrl ?? '') === env.url ? 1 : 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {openKey === 'endpoint' && (
            <>
              <SearchInput value={q.endpoint} onChange={(v) => setQ(prev => ({ ...prev, endpoint: v }))} placeholder="Buscar endpoint..." inputRef={endpointInputRef} />
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                <EndpointList
                  endpoints={erp?.endpoints ?? []}
                  selectedId={endpointId}
                  onSelect={handleEndpointSelect}
                  query={q.endpoint}
                />
              </div>
            </>
          )}

          {openKey === 'client' && (
            <>
              <SearchInput value={q.client} onChange={(v) => setQ(prev => ({ ...prev, client: v }))} placeholder="Buscar cliente..." inputRef={clientInputRef} />
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                <ItemList items={filteredClients} selectedId={clientId} onSelect={handleClientSelect} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
