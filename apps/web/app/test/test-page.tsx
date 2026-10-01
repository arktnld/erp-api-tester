'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, Play, Square } from 'lucide-react'
import { TestSelectors } from './components/test-selectors'
import { TestRequest } from './components/test-request'
import { TestResponse } from './components/test-response'
import { SessionStrip } from './components/session-strip'
import type { SessionInfo } from './components/session-strip'
import { substitute, generateCurl, findErpIdForCompany } from './lib/utils'
import { fieldDefaults, mergeFields } from '@/lib/fields'
import { getAuthModes, pickModeConfig } from '@/lib/auth'
import type { ERP, Environment, ExecuteResponse } from './lib/types'

type Session = {
  id: string
  erpId: number | null
  companyId: number | null
  endpointId: number | null
  clientId: number | null
  environmentUrl: string | null
  customUrl: string | null
  bodyMode: 'form' | 'raw'
  rawBody: string
  response: ExecuteResponse | null
}

function detectLanguage(headersJson: string): 'json' | 'xml' | 'text' {
  try {
    const headers = JSON.parse(headersJson) as Record<string, string>
    const ct = Object.entries(headers)
      .find(([k]) => k.toLowerCase() === 'content-type')?.[1]?.toLowerCase() ?? ''
    if (ct.includes('xml')) return 'xml'
    if (ct.includes('json') || !ct) return 'json'
    return 'text'
  } catch {
    return 'json'
  }
}

export function TestPage({
  erps,
  initialCompanyId,
  initialEndpointId,
  initialClientId,
}: {
  erps: ERP[]
  initialCompanyId?: number
  initialEndpointId?: number
  initialClientId?: number
}) {
  const [erpId, setErpId] = useState<number | null>(
    initialCompanyId ? findErpIdForCompany(erps, initialCompanyId) : null
  )
  const [companyId, setCompanyId] = useState<number | null>(initialCompanyId ?? null)
  const [endpointId, setEndpointId] = useState<number | null>(initialEndpointId ?? null)
  const [clientId, setClientId] = useState<number | null>(initialClientId ?? null)
  const [environmentUrl, setEnvironmentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ExecuteResponse | null>(null)
  const [tokenAcquired, setTokenAcquired] = useState<Record<number, boolean>>({})
  const [bodyMode, setBodyMode] = useState<'form' | 'raw'>('form')
  const [rawBody, setRawBody] = useState('')
  const [customUrl, setCustomUrl] = useState<string | null>(null)
  const [editingUrl, setEditingUrl] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(false)
  const isRestoringRef = useRef(false)
  const sessionCounterRef = useRef(2)

  const [sessions, setSessions] = useState<Session[]>([{
    id: 's1',
    erpId: initialCompanyId ? findErpIdForCompany(erps, initialCompanyId) : null,
    companyId: initialCompanyId ?? null,
    endpointId: initialEndpointId ?? null,
    clientId: initialClientId ?? null,
    environmentUrl: null,
    customUrl: null,
    bodyMode: 'form',
    rawBody: '',
    response: null,
  }])
  const [activeSessionId, setActiveSessionId] = useState('s1')

  // Restore sessions from localStorage on mount (skip if URL params were provided)
  useEffect(() => {
    isMountedRef.current = true
    if (initialCompanyId || initialEndpointId) return

    try {
      const raw = localStorage.getItem('test_sessions')
      if (raw) {
        const saved = JSON.parse(raw) as Session[]
        if (Array.isArray(saved) && saved.length > 0) {
          const savedActiveId = localStorage.getItem('test_activeSessionId') ?? saved[0].id
          const target = saved.find(s => s.id === savedActiveId) ?? saved[0]
          // Restore session counter to avoid ID collisions
          const maxNum = saved.reduce((m, s) => Math.max(m, parseInt(s.id.replace('s', ''), 10) || 0), 0)
          sessionCounterRef.current = maxNum + 1
          setSessions(saved)
          isRestoringRef.current = true
          setErpId(target.erpId)
          setCompanyId(target.companyId)
          setEndpointId(target.endpointId)
          setClientId(target.clientId)
          setEnvironmentUrl(target.environmentUrl)
          setCustomUrl(target.customUrl)
          setBodyMode(target.bodyMode)
          setRawBody(target.rawBody)
          setActiveSessionId(target.id)
          setTimeout(() => { isRestoringRef.current = false }, 0)
          return
        }
      }
    } catch { /* invalid JSON, fall through */ }

    // Legacy fallback: individual keys (migration)
    const savedErpId      = localStorage.getItem('test_erpId')
    const savedCompanyId  = localStorage.getItem('test_companyId')
    const savedEndpointId = localStorage.getItem('test_endpointId')
    const savedClientId   = localStorage.getItem('test_clientId')
    if (savedErpId)      setErpId(parseInt(savedErpId, 10))
    if (savedCompanyId)  setCompanyId(parseInt(savedCompanyId, 10))
    if (savedEndpointId) setEndpointId(parseInt(savedEndpointId, 10))
    if (savedClientId)   setClientId(parseInt(savedClientId, 10))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist sessions (without response bodies to avoid storage quota issues)
  useEffect(() => {
    if (!isMountedRef.current) return
    const toSave = sessions.map(s =>
      s.id === activeSessionId
        ? { ...s, erpId, companyId, endpointId, clientId, environmentUrl, customUrl, bodyMode, rawBody, response: null }
        : { ...s, response: null }
    )
    localStorage.setItem('test_sessions', JSON.stringify(toSave))
    localStorage.setItem('test_activeSessionId', activeSessionId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, activeSessionId, erpId, companyId, endpointId, clientId, environmentUrl, customUrl, bodyMode, rawBody])

  // Reset custom URL + editing mode when any selector changes (skip during session restore)
  useEffect(() => {
    if (isRestoringRef.current) return
    setCustomUrl(null)
    setEditingUrl(false)
  }, [erpId, companyId, endpointId, clientId, environmentUrl])

  // Sync active session response to sessions array for strip display
  useEffect(() => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, response } : s))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response])

  const captureCurrentSession = useCallback((): Session => ({
    id: activeSessionId,
    erpId, companyId, endpointId, clientId,
    environmentUrl, customUrl, bodyMode, rawBody, response,
  }), [activeSessionId, erpId, companyId, endpointId, clientId, environmentUrl, customUrl, bodyMode, rawBody, response])

  const restoreSession = useCallback((target: Session) => {
    isRestoringRef.current = true
    setErpId(target.erpId)
    setCompanyId(target.companyId)
    setEndpointId(target.endpointId)
    setClientId(target.clientId)
    setEnvironmentUrl(target.environmentUrl)
    setCustomUrl(target.customUrl)
    setBodyMode(target.bodyMode)
    setRawBody(target.rawBody)
    setResponse(target.response)
    setActiveSessionId(target.id)
    setTimeout(() => { isRestoringRef.current = false }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchSession = useCallback((id: string) => {
    setSessions(prev => {
      const target = prev.find(s => s.id === id)
      if (!target || id === activeSessionId) return prev
      const updated = prev.map(s => s.id === activeSessionId ? captureCurrentSession() : s)
      restoreSession(target)
      return updated
    })
  }, [activeSessionId, captureCurrentSession, restoreSession])

  const createSession = useCallback(() => {
    const newId = `s${sessionCounterRef.current++}`
    const blank: Session = {
      id: newId, erpId: null, companyId: null, endpointId: null, clientId: null,
      environmentUrl: null, customUrl: null, bodyMode: 'form', rawBody: '', response: null,
    }
    setSessions(prev => [...prev.map(s => s.id === activeSessionId ? captureCurrentSession() : s), blank])
    restoreSession(blank)
  }, [activeSessionId, captureCurrentSession, restoreSession])

  const closeSession = useCallback((id: string) => {
    setSessions(prev => {
      if (prev.length <= 1) return prev
      const idx = prev.findIndex(s => s.id === id)
      if (idx === -1) return prev
      const next = prev.filter(s => s.id !== id)
      if (id === activeSessionId) {
        const target = next[Math.min(idx, next.length - 1)]
        restoreSession(target)
      }
      return next
    })
  }, [activeSessionId, restoreSession])

  const sessionInfos: SessionInfo[] = sessions.map(s => {
    const sErp = erps.find(e => e.id === (s.id === activeSessionId ? erpId : s.erpId))
    const sEndpointId = s.id === activeSessionId ? endpointId : s.endpointId
    const sEndpoint = sErp?.endpoints.find(ep => ep.id === sEndpointId)
    const sResponse = s.id === activeSessionId ? response : s.response
    return {
      id: s.id,
      endpointName: sEndpoint?.name ?? null,
      endpointMethod: sEndpoint?.method ?? null,
      statusCode: sResponse?.statusCode ?? null,
      durationMs: sResponse?.durationMs ?? null,
      isActive: s.id === activeSessionId,
      isLoading: s.id === activeSessionId && loading,
    }
  })

  const erp = erps.find((e) => e.id === erpId)
  const company = erp?.companies.find((c) => c.id === companyId)
  const endpoint = erp?.endpoints.find((ep) => ep.id === endpointId)
  const client = company?.testClients.find((tc) => tc.id === clientId)

  const companyEnvironments: Environment[] = company ? (company.environments ?? []) : []
  const activeUrl = environmentUrl ?? company?.baseUrl ?? ''
  const fields = client ? client.fieldsData : {}
  const allFields = mergeFields(fields as Record<string, string>, company, fieldDefaults(erp?.fieldSchemas))
  const resolvedUrl = endpoint && company ? `${activeUrl}${substitute(endpoint.pathTemplate, allFields)}` : ''
  const resolvedBody = endpoint?.bodyTemplate?.trim() ? substitute(endpoint.bodyTemplate, allFields) : ''
  const needsClient = endpoint?.requiresClient !== false
  const canExecute = !!(erpId && companyId && endpointId && (!needsClient || clientId))
  const editorLanguage = detectLanguage(endpoint?.headers ?? '{}')
  // Header names whose values should be fully masked
  const sensitiveHeaderKeys: Set<string> = (() => {
    const cfg = company?.authConfig as Record<string, unknown> | null
    switch (company?.authType) {
      case 'bearer':
      case 'basic':
        return new Set(['Authorization'])
      case 'api_key':
        return cfg?.header ? new Set([String(cfg.header)]) : new Set<string>()
      case 'custom_headers':
        return cfg ? new Set(Object.keys(cfg)) : new Set<string>()
      default:
        return new Set<string>()
    }
  })()
  // Body field values to mask (body_fields auth injects them literally into the body)
  const sensitiveValues: Set<string> = new Set(
    company?.authType === 'body_fields' && company?.authConfig
      ? Object.values(company.authConfig as Record<string, unknown>).filter(
          (v) => typeof v === 'string' && (v as string).length > 4
        ) as string[]
      : []
  )

  const execute = async () => {
    if (!canExecute) return
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setShowCancel(false)
    setResponse(null)
    cancelTimerRef.current = setTimeout(() => setShowCancel(true), 400)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId,
          clientId: needsClient ? clientId : null,
          companyId: !needsClient ? companyId : null,
          environmentUrl: environmentUrl ?? undefined,
          ...(customUrl ? { customUrl } : {}),
          ...(bodyMode === 'raw' ? { rawBody } : {}),
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      setResponse(data)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err
    } finally {
      setLoading(false)
      setShowCancel(false)
      if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current)
      abortRef.current = null
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  const obtainToken = async () => {
    if (!companyId) return
    // Multi-grant ERPs key the config by mode id, so the token endpoint id lives
    // inside the active mode, not at the top level (flat single-mode ERPs).
    const modeIds = getAuthModes(erp?.authTemplate).map((m) => m.id)
    const cfg = pickModeConfig(company?.authConfig, modeIds) as { tokenEndpointId?: number }
    if (!cfg?.tokenEndpointId) return
    setLoading(true)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointId: cfg.tokenEndpointId, companyId, environmentUrl: environmentUrl ?? undefined }),
      })
      const data = await res.json()
      if (data.statusCode >= 200 && data.statusCode < 300) {
        setTokenAcquired((prev) => ({ ...prev, [companyId]: true }))
        setResponse(data)
      } else {
        setResponse(data)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* URL bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--nav-bg)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0, height: 38, border: '1px solid var(--input-border)', borderRadius: 'var(--radius)', background: 'var(--input-bg)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: 'var(--surface-2)', borderRight: '1px solid var(--input-border)', flexShrink: 0 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: `var(--method-${(endpoint?.method ?? 'get').toLowerCase()}, var(--text-subtle))` }}>
              {endpoint?.method ?? 'GET'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, padding: '0 8px 0 12px' }}>
            {editingUrl ? (
              <input
                autoFocus
                aria-label="URL da requisição"
                value={customUrl ?? resolvedUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingUrl(false)
                  if (e.key === 'Escape') { setCustomUrl(null); setEditingUrl(false) }
                }}
                onBlur={() => setEditingUrl(false)}
                style={{ fontFamily: 'monospace', fontSize: 13, flex: 1, height: '100%', background: 'none', border: 'none', outline: 'none', boxShadow: 'none', color: 'var(--text)', minWidth: 0, padding: 0 }}
              />
            ) : (
              <>
                <span style={{ fontFamily: 'monospace', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: resolvedUrl ? (customUrl ? 'var(--accent)' : 'var(--text)') : 'var(--text-subtle)' }}>
                  {resolvedUrl
                    ? (customUrl ?? resolvedUrl).split(/(\{[^}]+\})/).map((part, i) =>
                        i % 2 ? <span key={i} style={{ color: 'var(--status-warning)' }}>{part}</span> : part
                      )
                    : 'Selecione ERP, empresa e endpoint...'}
                </span>
                {resolvedUrl && (
                  <button
                    onClick={() => { setCustomUrl(customUrl ?? resolvedUrl); setEditingUrl(true) }}
                    title="Editar URL"
                    aria-label="Editar URL"
                    style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: customUrl ? 'var(--accent)' : 'var(--text-muted)', borderRadius: 4, flexShrink: 0 }}
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <button
          onClick={showCancel ? cancel : execute}
          disabled={!loading && !canExecute}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, width: 136, fontSize: 14, fontWeight: 600, color: '#fff', backgroundColor: showCancel ? 'var(--status-error)' : 'var(--accent)', border: `1px solid ${showCancel ? 'var(--status-error)' : 'var(--accent)'}`, borderRadius: 'var(--radius)', cursor: showCancel || canExecute ? 'pointer' : 'not-allowed', opacity: loading || canExecute ? 1 : 0.5, flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {loading
            ? (showCancel ? <><Square size={12} fill="currentColor" /> Cancelar</> : 'Executando...')
            : <><Play size={13} fill="currentColor" /> Executar</>}
        </button>
      </div>

      {/* Modification warning */}
      {endpoint?.isModification && (
        <div style={{ padding: '6px 16px', backgroundColor: 'color-mix(in srgb, var(--status-warning) 9%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--status-warning) 27%, transparent)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--status-warning)', flexShrink: 0 }}>
          ⚠ Endpoint de modificação — esta requisição pode alterar dados. Confirme antes de executar.
        </div>
      )}

      {/* Notes */}
      {endpoint?.notes && (
        <div style={{ padding: '6px 16px', backgroundColor: 'color-mix(in srgb, var(--accent) 9%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--accent) 27%, transparent)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--link)', flexShrink: 0 }}>
          💬 {endpoint.notes}
        </div>
      )}

      {/* Three panes */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <TestSelectors
          erps={erps}
          erpId={erpId}
          companyId={companyId}
          endpointId={endpointId}
          clientId={clientId}
          environmentUrl={environmentUrl}
          needsClient={needsClient}
          erp={erp}
          company={company}
          companyEnvironments={companyEnvironments}
          tokenAcquired={companyId ? (tokenAcquired[companyId] ?? false) : false}
          onErpChange={(id) => { setErpId(id); setCompanyId(null); setEndpointId(null); setClientId(null); setResponse(null) }}
          onCompanyChange={(id) => { setCompanyId(id); setClientId(null); setEnvironmentUrl(null) }}
          onEndpointChange={setEndpointId}
          onClientChange={setClientId}
          onEnvironmentChange={setEnvironmentUrl}
          onObtainToken={obtainToken}
        />
        <TestRequest
          response={response}
          resolvedBody={resolvedBody}
          bodyMode={bodyMode}
          rawBody={rawBody}
          editorLanguage={editorLanguage}
          sensitiveValues={sensitiveValues}
          sensitiveHeaderKeys={sensitiveHeaderKeys}
          onBodyModeChange={setBodyMode}
          onRawBodyChange={setRawBody}
        />
        <TestResponse
          response={response}
          loading={loading}
          erpName={erp?.name}
          companyName={company?.name}
          curlString={endpoint && company ? generateCurl(endpoint, { ...company, baseUrl: activeUrl }, allFields, bodyMode === 'raw' ? rawBody : undefined, customUrl ?? undefined) : undefined}
        />
        <SessionStrip
          sessions={sessionInfos}
          onSwitch={switchSession}
          onCreate={createSession}
          onClose={closeSession}
        />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
