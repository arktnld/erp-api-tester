'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Plus, Trash2, Play, Share2, Check, ChevronDown, Copy, Terminal, Pencil, Download } from 'lucide-react'
import { addBlock, updateBlock, deleteBlock, updateRecordNotes, getRecordShareToken } from '@/app/actions/records'
import { useRole } from '@/lib/role-context'
import { substitute, tryPrettyXml } from '@/lib/utils'
import { mergeFields } from '@/lib/fields'
import { buildAuthHeaders } from '@/lib/auth'
import { JsonTree } from '@/app/test/components/json-tree'
import { HeaderValue } from '@/app/test/components/header-value'

const CodeBlock = dynamic(() => import('@/components/ui/code-block').then(m => ({ default: m.CodeBlock })), { ssr: false })

// ── Types ───────────────────────────────────────────────────────────────────

type Endpoint = {
  id: number
  name: string
  method: string
  pathTemplate: string
  bodyTemplate: string
  headers: string
  group: string
  requiresClient: boolean
  isModification: boolean
  notes: string
  authMode: string
  sortOrder: number
}

type TestClient = { id: number; name: string; fieldsData: unknown }

type Block = {
  id: number
  order: number
  endpointId: number | null
  clientId: number | null
  response: unknown | null
  note: string
  executedAt: Date | null
}

type Company = {
  id: number
  name: string
  baseUrl: string
  authType: string
  authConfig: unknown
  environments: unknown
  testClients: TestClient[]
  erp: { id: number; name: string; endpoints: Endpoint[] }
}

type RecordData = {
  id: number
  name: string
  notes: string
  createdAt: Date
  company: Company
  category: { id: number; name: string } | null
  blocks: Block[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
    <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, padding: '2px 5px', borderRadius: 3, flexShrink: 0 }}>
      {method}
    </span>
  )
}

function StatusBadge({ code }: { code: number }) {
  const color = code < 300 ? 'var(--status-success)' : code < 400 ? 'var(--status-warning)' : 'var(--status-error)'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, padding: '2px 7px', borderRadius: 4 }}>
      {code}
    </span>
  )
}

function tryPretty(v: unknown): string {
  if (typeof v === 'string') {
    try { return JSON.stringify(JSON.parse(v), null, 2) } catch { return v }
  }
  return JSON.stringify(v, null, 2)
}

type JsonToken = { t: 'key' | 'str' | 'num' | 'lit' | 'plain'; v: string }

function tokenizeJson(code: string): JsonToken[] {
  const tokens: JsonToken[] = []
  const re = /"([^"\n]+)"(\s*:)|: "([^"\n]*)"|: (-?\d+\.?\d*)\b|: (true|false|null)\b/g
  let last = 0; let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) tokens.push({ t: 'plain', v: code.slice(last, m.index) })
    if (m[1] !== undefined) { tokens.push({ t: 'plain', v: '"' }); tokens.push({ t: 'key', v: m[1] }); tokens.push({ t: 'plain', v: '"' + m[2] }) }
    else if (m[3] !== undefined) { tokens.push({ t: 'plain', v: ': "' }); tokens.push({ t: 'str', v: m[3] }); tokens.push({ t: 'plain', v: '"' }) }
    else if (m[4] !== undefined) { tokens.push({ t: 'plain', v: ': ' }); tokens.push({ t: 'num', v: m[4] }) }
    else if (m[5] !== undefined) { tokens.push({ t: 'plain', v: ': ' }); tokens.push({ t: 'lit', v: m[5] }) }
    last = m.index + m[0].length
  }
  if (last < code.length) tokens.push({ t: 'plain', v: code.slice(last) })
  return tokens
}

function JsonHighlight({ code }: { code: string }) {
  const clr: Record<string, string> = { key: '#d19a66', str: '#98c379', num: '#61afef', lit: '#56b6c2' }
  try {
    const tokens = tokenizeJson(code)
    return <>{tokens.map((tok, i) => tok.t === 'plain' ? tok.v : <span key={i} style={{ color: clr[tok.t] }}>{tok.v}</span>)}</>
  } catch { return <>{code}</> }
}

function extractTemplateVars(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

function buildCurlCmd(
  endpoint: Endpoint,
  company: Pick<Company, 'baseUrl' | 'authType' | 'authConfig'>,
  fields: Record<string, string>,
  extraParams: Record<string, string> = {},
): string {
  const allFields = mergeFields({ ...fields, ...extraParams }, company)
  const url = `${company.baseUrl}${substitute(endpoint.pathTemplate, allFields)}`
  const parts = [`curl -X ${endpoint.method} '${url}'`]
  const authHeaders = buildAuthHeaders(company)
  for (const [k, v] of Object.entries(authHeaders)) parts.push(`  -H '${k}: ${v}'`)
  try {
    const h = JSON.parse(endpoint.headers || '{}') as Record<string, string>
    for (const [k, v] of Object.entries(h)) parts.push(`  -H '${k}: ${v}'`)
  } catch {}
  const body = endpoint.bodyTemplate?.trim() ? substitute(endpoint.bodyTemplate, allFields) : ''
  if (body) parts.push(`  -d '${body}'`)
  return parts.join(' \\\n')
}

// ── Endpoint Select ──────────────────────────────────────────────────────────

function EndpointSelect({
  endpoints,
  value,
  onChange,
}: {
  endpoints: Endpoint[]
  value: number | null
  onChange: (id: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = endpoints.find((e) => e.id === value)

  const filtered = endpoints.filter(
    (e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.group.toLowerCase().includes(q.toLowerCase()),
  )
  const groups = [...new Set(filtered.filter((e) => e.group).map((e) => e.group))]
  const noGroup = filtered.filter((e) => !e.group)

  const handleOpen = () => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const dropdownHeight = 300
    const spaceBelow = window.innerHeight - rect.bottom
    const openUpward = spaceBelow < dropdownHeight + 8 && rect.top > dropdownHeight
    setDropdownStyle({
      position: 'fixed',
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      left: rect.left,
      width: Math.max(rect.width, 320),
      zIndex: 9999,
    })
    setOpen(true)
  }

  // Close on scroll (but not when scrolling inside the dropdown itself)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [open])

  const dropdown = open ? (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
      <div style={{ ...dropdownStyle, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 300, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar endpoint…"
            style={{ width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div ref={dropdownRef} style={{ overflowY: 'auto', padding: '4px' }}>
          {groups.map((g) => (
            <div key={g}>
              <div style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 8px 2px', fontWeight: 600 }}>{g}</div>
              {filtered.filter((e) => e.group === g).map((ep) => (
                <button key={ep.id} onClick={() => { onChange(ep.id); setOpen(false); setQ('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', borderRadius: 5, border: 'none', backgroundColor: ep.id === value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: ep.id === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                  <MethodTag method={ep.method} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.name}</span>
                  {ep.id === value && <Check size={11} style={{ flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          ))}
          {noGroup.map((ep) => (
            <button key={ep.id} onClick={() => { onChange(ep.id); setOpen(false); setQ('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 8px', borderRadius: 5, border: 'none', backgroundColor: ep.id === value ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent', color: ep.id === value ? 'var(--accent)' : 'var(--text)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
              <MethodTag method={ep.method} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.name}</span>
              {ep.id === value && <Check size={11} style={{ flexShrink: 0 }} />}
            </button>
          ))}
          {filtered.length === 0 && <div style={{ padding: '8px', fontSize: 12, color: 'var(--text-subtle)' }}>Nenhum resultado</div>}
        </div>
      </div>
    </>
  ) : null

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}
      >
        {selected ? (
          <>
            <MethodTag method={selected.method} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-subtle)', flex: 1 }}>Selecione um endpoint…</span>
        )}
        <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-subtle)' }} />
      </button>
      {typeof document !== 'undefined' && dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}

// ── Block Editor ─────────────────────────────────────────────────────────────

const METHOD_BORDER: Record<string, string> = {
  GET: 'var(--status-success)', POST: 'var(--method-post)', PUT: 'var(--status-warning)', PATCH: 'var(--method-patch)', DELETE: 'var(--status-error)',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-subtle)' }}>{children}</span>
      <div style={{ flex: 1, height: 1, backgroundColor: 'var(--border)' }} />
    </div>
  )
}

function BlockEditor({
  block,
  index,
  endpoints,
  clients,
  company,
  onDelete,
  canEdit,
}: {
  block: Block
  index: number
  endpoints: Endpoint[]
  clients: TestClient[]
  company: Company
  onDelete: () => void
  canEdit: boolean
}) {
  const [endpointId, setEndpointId] = useState<number | null>(block.endpointId)
  const [clientId, setClientId] = useState<number | null>(block.clientId)
  type BlockResponse = {
    statusCode: number
    responseBody: string
    durationMs: number
    responseHeaders?: Record<string, string>
    contentCategory?: string
    isBinary?: boolean
    mimeType?: string
    fileName?: string | null
  }
  const [response, setResponse] = useState<BlockResponse | null>(block.response as BlockResponse | null)
  const [note, setNote] = useState(block.note)
  const [executing, setExecuting] = useState(false)
  const [showCurl, setShowCurl] = useState(false)
  const [showBody, setShowBody] = useState(false)
  const [bodyParams, setBodyParams] = useState<Record<string, string>>({})
  const [curlCopied, setCurlCopied] = useState(false)
  const [resTab, setResTab] = useState<'json' | 'raw' | 'headers'>('json')
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto'
      noteRef.current.style.height = noteRef.current.scrollHeight + 'px'
    }
  }, [])

  const endpoint = endpoints.find((e) => e.id === endpointId)
  const client = clients.find((c) => c.id === clientId)
  const needsClient = endpoint?.requiresClient !== false
  const canExecute = !!endpointId && (!needsClient || !!clientId)

  const methodColor = endpoint ? (METHOD_BORDER[endpoint.method] ?? 'var(--border)') : 'var(--border)'
  const statusColor = !response ? 'var(--text-subtle)' : response.statusCode < 300 ? 'var(--status-success)' : 'var(--status-error)'

  const clientFields = client ? (client.fieldsData as Record<string, string> ?? {}) : {}
  const allBodyFields = mergeFields({ ...clientFields, ...bodyParams }, company)
  const missingVars = endpoint?.bodyTemplate
    ? extractTemplateVars(endpoint.bodyTemplate).filter((v) => !(v in allBodyFields) || allBodyFields[v] === '')
    : []
  const hasBodyTemplate = !!(endpoint?.bodyTemplate?.trim())
  const curlCmd = endpoint
    ? buildCurlCmd(endpoint, company, clientFields, bodyParams)
    : null

  const execute = async () => {
    if (!canExecute || executing) return
    setExecuting(true)
    try {
      const rawBody = bodyParams.__raw__ !== undefined
        ? bodyParams.__raw__
        : Object.keys(bodyParams).length && endpoint?.bodyTemplate?.trim()
          ? substitute(endpoint.bodyTemplate, mergeFields({ ...clientFields, ...bodyParams }, company))
          : undefined
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointId, clientId: needsClient ? clientId : null, companyId: company.id, ...(rawBody ? { rawBody } : {}) }),
      })
      const data = await res.json()
      setResponse(data)
      await updateBlock(block.id, { endpointId, clientId: needsClient ? clientId : null, response: data, executedAt: new Date() })
    } finally {
      setExecuting(false)
    }
  }

  const saveNote = useCallback((value: string) => {
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
    noteTimerRef.current = setTimeout(() => { updateBlock(block.id, { note: value }) }, 600)
  }, [block.id])

  const handleNoteChange = (value: string) => { setNote(value); saveNote(value) }

  const copyCurl = () => {
    if (!curlCmd) return
    const done = () => { setCurlCopied(true); setTimeout(() => setCurlCopied(false), 1500) }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(curlCmd).then(done).catch(() => fallbackCopyText(curlCmd, done))
    } else {
      fallbackCopyText(curlCmd, done)
    }
  }

  const fallbackCopyText = (text: string, cb: () => void) => {
    const ta = document.createElement('textarea')
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta); ta.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(ta); cb()
  }

  let parsedJson: unknown = null
  if (response) { try { parsedJson = JSON.parse(response.responseBody) } catch {} }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, fontWeight: active ? 500 : 400,
    color: active ? 'var(--text)' : 'var(--text-muted)',
    background: 'none', border: 'none', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {/* Number outside the card */}
      <div style={{ paddingTop: 38, flexShrink: 0, width: 32, textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: statusColor, fontVariantNumeric: 'tabular-nums', transition: 'color 0.2s' }}>
          #{index + 1}
        </span>
      </div>

    <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
      {/* Left method stripe */}
      <div style={{ width: 3, backgroundColor: methodColor, flexShrink: 0, transition: 'background 0.2s' }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ── NOTE ── */}
        {(canEdit || note) && (
          <div style={{
            display: 'flex', gap: 8, padding: '8px 14px',
            backgroundColor: note ? 'color-mix(in srgb, var(--status-warning) 8%, transparent)' : 'transparent',
            borderBottom: note ? '1px solid color-mix(in srgb, var(--status-warning) 20%, transparent)' : '1px solid transparent',
            transition: 'background 0.2s, border-color 0.2s',
          }}>
            <Pencil size={12} style={{ color: note ? 'var(--status-warning)' : 'var(--text-subtle)', marginTop: 3, flexShrink: 0, transition: 'color 0.2s' }} />
            <textarea
              ref={noteRef}
              value={note}
              onChange={(e) => canEdit && handleNoteChange(e.target.value)}
              placeholder={canEdit ? 'Adicionar anotação…' : ''}
              readOnly={!canEdit}
              rows={1}
              style={{ flex: 1, padding: 0, fontSize: 12, border: 'none', backgroundColor: 'transparent', color: note ? 'var(--status-warning)' : 'var(--text)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', cursor: canEdit ? 'text' : 'default' }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
              onFocus={(e) => { if (canEdit) e.currentTarget.style.color = 'var(--text)' }}
              onBlur={(e) => { e.currentTarget.style.color = note ? 'var(--status-warning)' : 'var(--text)' }}
            />
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 6px' }}>

          <EndpointSelect endpoints={endpoints} value={endpointId} onChange={setEndpointId} />

          {needsClient && endpointId && (
            <select
              value={clientId ?? ''}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '5px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: clientId ? 'var(--text)' : 'var(--text-subtle)', width: 150, flexShrink: 0 }}
            >
              <option value="">Cliente…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {canEdit && (
            <button
              onClick={execute}
              disabled={!canExecute || executing}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', backgroundColor: canExecute ? 'var(--accent)' : 'var(--surface-2)', color: canExecute ? 'white' : 'var(--text-subtle)', cursor: canExecute ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 500, flexShrink: 0 }}
            >
              <Play size={11} />
              {executing ? 'Executando…' : 'Executar'}
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {hasBodyTemplate && (
              <button onClick={() => setShowBody((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, border: `1px solid ${bodyParams.__raw__ !== undefined ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: showBody ? 'var(--surface-2)' : 'transparent', color: bodyParams.__raw__ !== undefined ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
                Body{bodyParams.__raw__ !== undefined ? ' ✎' : ''}
              </button>
            )}
            {curlCmd && (
              <button onClick={() => setShowCurl((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: showCurl ? 'var(--surface-2)' : 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
                <Terminal size={11} /> cURL
              </button>
            )}
            {canEdit && (
              <button onClick={onDelete}
                style={{ padding: '4px 6px', borderRadius: 5, border: 'none', backgroundColor: 'transparent', color: 'var(--text-subtle)', cursor: 'pointer' }}
                title="Remover bloco">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Path + meta */}
        {endpoint && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 14px 10px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle)' }}>{endpoint.pathTemplate}</span>
            {endpoint.isModification && <span style={{ fontSize: 10, color: 'var(--status-warning)', backgroundColor: 'color-mix(in srgb, var(--status-warning) 10%, transparent)', padding: '1px 6px', borderRadius: 3 }}>modificação</span>}
            {endpoint.notes && <span style={{ fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {endpoint.notes}</span>}
          </div>
        )}

        {/* ── BODY PARAMS ── */}
        {hasBodyTemplate && showBody && (() => {
          const resolved = substitute(endpoint!.bodyTemplate, allBodyFields)
          const rawVal = bodyParams.__raw__ ?? resolved
          return (
            <>
              <SectionLabel>Body</SectionLabel>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <textarea
                  value={rawVal}
                  onChange={(e) => setBodyParams({ __raw__: e.target.value })}
                  rows={6}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.6, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text)', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )
        })()}

        {/* ── REQUEST ── */}
        {curlCmd && showCurl && (
          <>
            <SectionLabel>Request</SectionLabel>
            <div style={{ padding: '10px 14px', position: 'relative', borderBottom: '1px solid var(--border)' }}>
              <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6 }}>
                {curlCmd}
              </pre>
              <button onClick={copyCurl}
                style={{ position: 'absolute', top: 18, right: 22, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: curlCopied ? 'var(--status-success)' : 'var(--text-muted)', cursor: 'pointer' }}>
                {curlCopied ? <Check size={10} /> : <Copy size={10} />}
                {curlCopied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </>
        )}

        {/* ── RESPONSE ── */}
        {response && (
          <>
            <SectionLabel>Response</SectionLabel>
            {/* Status bar + tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px 0', borderBottom: '1px solid var(--border)' }}>
              <StatusBadge code={response.statusCode} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{response.durationMs}ms</span>
              <div style={{ marginLeft: 8, display: 'flex' }}>
                {(['json', 'raw', 'headers'] as const).map((t) => (
                  <button key={t} style={tabStyle(resTab === t)} onClick={() => setResTab(t)}>
                    {t === 'json' ? 'JSON' : t === 'raw' ? 'Raw' : 'Headers'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              {resTab === 'json' && (() => {
                const cat = response.contentCategory
                const isBin = response.isBinary
                if (cat === 'image') {
                  const name = response.fileName ?? `imagem.${response.mimeType?.split('/')[1] ?? 'jpg'}`
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <img src={`data:${response.mimeType};base64,${response.responseBody}`} alt={name}
                        style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }} />
                      <a href={`data:${response.mimeType};base64,${response.responseBody}`} download={name}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
                        <Download size={12} />{name}
                      </a>
                    </div>
                  )
                }
                if (isBin) {
                  const name = response.fileName ?? `download.${response.mimeType?.split('/')[1] ?? 'bin'}`
                  const sizeKb = (Math.floor(response.responseBody.length * 3 / 4) / 1024).toFixed(1)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{response.mimeType} · {sizeKb}KB</span>
                      <a href={`data:${response.mimeType};base64,${response.responseBody}`} download={name}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', fontSize: 13, fontWeight: 500, backgroundColor: 'var(--accent)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
                        <Download size={13} />Baixar {name}
                      </a>
                    </div>
                  )
                }
                if (cat === 'xml' || cat === 'html') {
                  return (
                    <CodeBlock language="xml" customStyle={{ borderRadius: 8, fontSize: 12, backgroundColor: 'var(--surface-2)', lineHeight: 1.7, maxHeight: 400, overflowY: 'auto' }} wrapLongLines>
                      {tryPrettyXml(response.responseBody)}
                    </CodeBlock>
                  )
                }
                return (
                  <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, color: 'var(--json-punct)', maxHeight: 400, overflowY: 'auto' }}>
                    {parsedJson !== null
                      ? <JsonTree value={parsedJson} />
                      : <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text)' }}>{response.responseBody}</pre>
                    }
                  </div>
                )
              })()}
              {resTab === 'raw' && (
                response.contentCategory === 'image' || response.isBinary
                  ? <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>[conteúdo binário — use a aba JSON para baixar]</pre>
                  : <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', maxHeight: 400, overflowY: 'auto', fontFamily: 'monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {response.responseBody}
                    </pre>
              )}
              {resTab === 'headers' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {Object.entries(response.responseHeaders ?? {}).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '5px 0', fontFamily: 'monospace', color: 'var(--text-muted)', width: '35%', paddingRight: 12, verticalAlign: 'top' }}>{k}</td>
                        <td style={{ padding: '5px 0' }}><HeaderValue value={String(v)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

      </div>
    </div>
    </div>
  )
}

// ── Record Detail Client ─────────────────────────────────────────────────────

export function RecordDetailClient({ record: initial }: { record: RecordData }) {
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks)
  const [addingBlock, setAddingBlock] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const { canEdit } = useRole()

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.style.height = 'auto'
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px'
    }
  }, [notes])

  const saveNotes = (value: string) => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => { updateRecordNotes(initial.id, value) }, 600)
  }

  const handleNotesChange = (value: string) => { setNotes(value); saveNotes(value) }

  const { company } = initial
  const { endpoints } = company.erp
  const clients = company.testClients

  const handleAddBlock = async () => {
    setAddingBlock(true)
    const block = await addBlock(initial.id)
    setBlocks((prev) => [...prev, block as Block])
    setAddingBlock(false)
  }

  const handleDeleteBlock = async (blockId: number) => {
    await deleteBlock(blockId, initial.id)
    setBlocks((prev) => prev.filter((b) => b.id !== blockId))
  }

  const handleShare = async () => {
    const token = await getRecordShareToken(initial.id)
    const url = `${window.location.origin}/records/${token}/view`
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done))
    } else {
      fallbackCopy(url, done)
    }
  }

  const fallbackCopy = (text: string, cb: () => void) => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch {}
    document.body.removeChild(ta)
    cb()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--surface)' }}>
        <Link href="/records" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={16} />
        </Link>

        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
          {company.name}
        </span>

        {initial.category && (
          <span style={{ fontSize: 11, color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '3px 8px', borderRadius: 10, flexShrink: 0, fontWeight: 500 }}>
            {initial.category.name}
          </span>
        )}

        <button
          onClick={handleShare}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: copied ? 'var(--status-success)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
        >
          {copied ? <Check size={13} /> : <Share2 size={13} />}
          {copied ? 'Copiado!' : 'Compartilhar'}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* General notes */}
          {(canEdit || notes) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 32, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, backgroundColor: notes ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'transparent', border: `1px solid ${notes ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'var(--border)'}`, transition: 'background-color 0.2s, border-color 0.2s' }}>
                <Pencil size={12} style={{ color: notes ? 'var(--accent)' : 'var(--text-subtle)', marginTop: 3, flexShrink: 0, transition: 'color 0.2s' }} />
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => canEdit && handleNotesChange(e.target.value)}
                  readOnly={!canEdit}
                  placeholder={canEdit ? 'Comentário geral do registro…' : ''}
                  rows={1}
                  style={{ flex: 1, padding: 0, fontSize: 13, border: 'none', backgroundColor: 'transparent', color: notes ? 'var(--accent)' : 'var(--text)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', cursor: canEdit ? 'text' : 'default', overflow: 'hidden' }}
                  onFocus={(e) => { e.currentTarget.style.color = 'var(--text)' }}
                  onBlur={(e) => { e.currentTarget.style.color = notes ? 'var(--accent)' : 'var(--text)' }}
                />
              </div>
            </div>
          )}

          {blocks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Adicione o primeiro bloco de requisição abaixo.
            </div>
          )}

          {blocks.map((block, i) => (
            <BlockEditor
              key={block.id}
              block={block}
              index={i}
              endpoints={endpoints}
              clients={clients}
              company={company}
              onDelete={() => handleDeleteBlock(block.id)}
              canEdit={canEdit}
            />
          ))}

          {canEdit && (
            <button
              onClick={handleAddBlock}
              disabled={addingBlock}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 8, border: '1px dashed var(--border)', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, transition: 'border-color 0.1s, color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <Plus size={14} />
              {addingBlock ? 'Adicionando…' : 'Adicionar bloco'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
