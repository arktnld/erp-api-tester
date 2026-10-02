'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, Pencil, GripVertical, Zap, Copy, Terminal, Upload } from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { MethodBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { JsonTextarea } from '@/components/ui/json-textarea'
import { BODY_MODES, contentTypeOf, modeOf, withContentType, type BodyModeId } from '@/lib/body-mode'

/** Headers JSON as typed in the form; {} while it is still invalid. */
function parseHeaders(text: string): Record<string, string> {
  try { const h = JSON.parse(text || '{}'); return h && typeof h === 'object' && !Array.isArray(h) ? h : {} } catch { return {} }
}

const BODY_PLACEHOLDER: Record<BodyModeId | 'other', string> = {
  json: '{"id": "{id}"}',
  xml: '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>…</soap:Body>\n</soap:Envelope>',
  soap12: '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">\n  <soap12:Body>…</soap12:Body>\n</soap12:Envelope>',
  form: 'grant_type=password&username={usuario}',
  text: '',
  other: '',
}
import {
  deleteEndpoint,
  createEndpoint,
  updateEndpoint,
  reorderEndpoints,
  duplicateEndpoint,
  importOpenApi,
  importWsdlOperations,
} from '@/lib/actions/endpoints'
import { createFieldSchema, updateFieldSchema, deleteFieldSchema, duplicateFieldSchema, reorderFieldSchemas } from '@/lib/actions/field-schemas'
import { AuthModesEditor } from './auth-modes-editor'
import { AUTH_TYPES, getAuthModes } from '@/lib/auth'
import { formLabel as labelStyle, selectStyle } from '@/lib/styles'
import { useRole } from '@/lib/role-context'


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
}
type FieldSchema = {
  id: number
  fieldName: string
  label: string
  fieldType: string
  required: boolean
  sourceEndpointId: number | null
  endpointParam: string
  responsePath: string
  defaultValue?: string
}
type ERP = {
  id: number
  name: string
  authTemplate: unknown
  endpoints: Endpoint[]
  fieldSchemas: FieldSchema[]
}

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

function parseCurl(raw: string): { method: string; path: string; headers: Record<string, string>; body: string } | null {
  try {
    const line = raw.replace(/\\\n\s*/g, ' ').trim()
    if (!line.startsWith('curl ')) return null

    let method = 'GET'
    let url = ''
    const headers: Record<string, string> = {}
    let body = ''

    const tokens: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === ' ') { i++; continue }
      if (line[i] === "'" || line[i] === '"') {
        const q = line[i]; let s = ''; i++
        while (i < line.length && line[i] !== q) {
          if (line[i] === '\\') { i++; s += line[i] ?? '' } else s += line[i]
          i++
        }
        i++; tokens.push(s)
      } else {
        let s = ''
        while (i < line.length && line[i] !== ' ') { s += line[i]; i++ }
        tokens.push(s)
      }
    }

    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j]
      if (t === 'curl') continue
      if (t === '-X' || t === '--request') { method = tokens[++j] ?? method; continue }
      if (t === '-H' || t === '--header') {
        const h = tokens[++j] ?? ''; const colon = h.indexOf(':')
        if (colon > 0) {
          const key = h.slice(0, colon).trim(); const val = h.slice(colon + 1).trim()
          if (!/^content-type$/i.test(key) && !/^authorization$/i.test(key)) headers[key] = val
        }
        continue
      }
      if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
        body = tokens[++j] ?? ''; if (method === 'GET') method = 'POST'; continue
      }
      if (!t.startsWith('-')) {
        try { const u = new URL(t); url = u.pathname + u.search } catch { if (t.startsWith('/')) url = t }
      }
    }

    if (!url) return null
    return { method, path: url, headers, body }
  } catch { return null }
}

// Endpoints are shown grouped, in this order; any other group follows alphabetically.
const GROUP_ORDER = ['Autenticação', 'Cliente', 'Contrato', 'Financeiro', 'Conexão', 'Equipamento', 'Atendimento']
const NO_GROUP = 'Sem grupo'

function groupEndpoints(endpoints: Endpoint[]): [string, Endpoint[]][] {
  const map = new Map<string, Endpoint[]>()
  for (const ep of endpoints) {
    const g = ep.group?.trim() || NO_GROUP
    map.set(g, [...(map.get(g) ?? []), ep])
  }
  const rank = (g: string) => (g === NO_GROUP ? 1e9 : GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : 1e6)
  return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
}

function getEndpointsUsingField(fieldName: string, endpoints: Endpoint[]) {
  const pattern = `{${fieldName}}`
  return endpoints.filter(
    (ep) => ep.pathTemplate.includes(pattern) || ep.bodyTemplate.includes(pattern)
  )
}

const FIELD_TYPES = ['text', 'number', 'cpf', 'cnpj', 'email']

const TAG_BASE: React.CSSProperties = { fontSize: 11, fontWeight: 500, borderRadius: 4, padding: '1px 8px', whiteSpace: 'nowrap' }
const TAG_WARNING: React.CSSProperties = { ...TAG_BASE, color: 'var(--status-warning)', backgroundColor: 'color-mix(in srgb, var(--status-warning) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--status-warning) 27%, transparent)' }
const TAG_MUTED: React.CSSProperties = { ...TAG_BASE, color: 'var(--text-muted)', backgroundColor: 'var(--surface-3)', border: '1px solid var(--border)' }

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: active ? 500 : 400,
  color: active ? 'var(--text)' : 'var(--text-muted)',
  background: 'none',
  border: 'none',
  borderBottomStyle: 'solid',
  borderBottomWidth: 2,
  borderBottomColor: active ? 'var(--accent)' : 'transparent',
  cursor: 'pointer',
})

export function ERPDetailClient({ erp }: { erp: ERP }) {
  const [tab, setTab] = useState<'endpoints' | 'fields' | 'auth'>('endpoints')
  const [endpoints, setEndpoints] = useState<Endpoint[]>(erp.endpoints)
  useEffect(() => { setEndpoints(erp.endpoints) }, [erp.endpoints])
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const handleImportOpenApi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportStatus('Importando…')
    try {
      const text = await file.text()
      // WSDL is XML, read here with the browser's DOMParser; OpenAPI is JSON, read on the server
      if (text.trimStart().startsWith('<')) {
        const { parseWsdl } = await import('@/lib/wsdl-import')
        const w = parseWsdl(text)
        const r = await importWsdlOperations(erp.id, w.endpoints)
        const origin = w.serviceUrl ? new URL(w.serviceUrl).origin : ''
        setImportStatus(`${r.created} operações SOAP importadas, ${r.skipped} já existiam${origin ? ` · URL base das empresas: ${origin}` : ''}${w.warnings.length ? ` · ${w.warnings[0]}` : ''}`)
        return
      }
      const r = await importOpenApi(erp.id, text)
      setImportStatus(`${r.created} importados, ${r.skipped} já existiam${r.warnings.length ? ` · ${r.warnings.length} aviso(s): ${r.warnings[0]}` : ''}`)
    } catch (err) {
      setImportStatus(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const [fieldSchemas, setFieldSchemas] = useState<FieldSchema[]>(erp.fieldSchemas)
  useEffect(() => { setFieldSchemas(erp.fieldSchemas) }, [erp.fieldSchemas])
  const [endpointSheet, setEndpointSheet] = useState<{ open: boolean; endpoint?: Endpoint }>({ open: false })
  const [fieldSheet, setFieldSheet] = useState<{ open: boolean; field?: FieldSchema }>({ open: false })
  const [isPending, startTransition] = useTransition()
  const { canAdmin: canEdit } = useRole()

  // cURL import state
  const [curlInput, setCurlInput] = useState('')
  const [curlOpen, setCurlOpen] = useState(false)
  const [curlError, setCurlError] = useState('')

  const handleImportCurl = () => {
    const result = parseCurl(curlInput)
    if (!result) { setCurlError('cURL inválido. Verifique o formato.'); return }
    setEpMethod(result.method)
    setEpPath(result.path)
    setEpBody(result.body)
    setEpHeaders(Object.keys(result.headers).length > 0 ? JSON.stringify(result.headers, null, 2) : '{}')
    setCurlOpen(false); setCurlInput(''); setCurlError('')
  }

  // Endpoint form state
  const [epName, setEpName] = useState('')
  const [epMethod, setEpMethod] = useState('GET')
  const [epPath, setEpPath] = useState('')
  const [epBody, setEpBody] = useState('')
  const [epHeaders, setEpHeaders] = useState('{}')
  const epBodyMode = modeOf(contentTypeOf(parseHeaders(epHeaders)))
  const [epGroup, setEpGroup] = useState('')
  const [epRequiresClient, setEpRequiresClient] = useState(true)
  const [epIsModification, setEpIsModification] = useState(false)
  const [epNotes, setEpNotes] = useState('')
  const [epAuthMode, setEpAuthMode] = useState('')


  // Field form state
  const [fsName, setFsName] = useState('')
  const [fsLabel, setFsLabel] = useState('')
  const [fsType, setFsType] = useState('text')
  const [fsRequired, setFsRequired] = useState(false)
  const [fsSourceEndpointId, setFsSourceEndpointId] = useState<number | null>(null)
  const [fsEndpointParam, setFsEndpointParam] = useState('')
  const [fsResponsePath, setFsResponsePath] = useState('')
  const [fsDefaultValue, setFsDefaultValue] = useState('')

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.type === 'FIELD') {
      const next = [...fieldSchemas]
      const [moved] = next.splice(result.source.index, 1)
      next.splice(result.destination.index, 0, moved)
      setFieldSchemas(next)
      startTransition(() => reorderFieldSchemas(erp.id, next.map((fs) => fs.id)))
    } else {
      // Endpoints move only inside their group (the group itself changes in the edit form).
      if (result.source.droppableId !== result.destination.droppableId) return
      const groups = groupEndpoints(endpoints).map(([g, eps]) => {
        if (`ep:${g}` !== result.source.droppableId) return eps
        const next = [...eps]
        const [moved] = next.splice(result.source.index, 1)
        next.splice(result.destination!.index, 0, moved)
        return next
      })
      const next = groups.flat()
      setEndpoints(next)
      startTransition(() => reorderEndpoints(erp.id, next.map((ep) => ep.id)))
    }
  }

  const openEndpointSheet = (ep?: Endpoint) => {
    setEpName(ep?.name ?? '')
    setEpMethod(ep?.method ?? 'GET')
    setEpPath(ep?.pathTemplate ?? '')
    setEpBody(ep?.bodyTemplate ?? '')
    setEpHeaders(ep?.headers ?? '{}')
    setEpGroup(ep?.group ?? '')
    setEpRequiresClient(ep?.requiresClient ?? true)
    setEpIsModification(ep?.isModification ?? false)
    setEpNotes(ep?.notes ?? '')
    setEpAuthMode(ep?.authMode ?? '')
    setCurlInput(''); setCurlOpen(false); setCurlError('')
    setEndpointSheet({ open: true, endpoint: ep })
  }

  const openFieldSheet = (fs?: FieldSchema) => {
    setFsName(fs?.fieldName ?? '')
    setFsLabel(fs?.label ?? '')
    setFsType(fs?.fieldType ?? 'text')
    setFsRequired(fs?.required ?? false)
    setFsSourceEndpointId(fs?.sourceEndpointId ?? null)
    setFsEndpointParam(fs?.endpointParam ?? '')
    setFsResponsePath(fs?.responsePath ?? '')
    setFsDefaultValue(fs?.defaultValue ?? '')
    setFieldSheet({ open: true, field: fs })
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <Link href="/erps" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ChevronLeft size={14} /> ERPs
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>{erp.name}</h1>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 24, display: 'flex', gap: 4 }}>
        <button style={tabStyle(tab === 'endpoints')} onClick={() => setTab('endpoints')}>
          Endpoints ({erp.endpoints.length})
        </button>
        <button style={tabStyle(tab === 'fields')} onClick={() => setTab('fields')}>
          Campos do Cliente ({erp.fieldSchemas.length})
        </button>
        {canEdit && (
          <button style={tabStyle(tab === 'auth')} onClick={() => setTab('auth')}>
            Autenticação
          </button>
        )}
      </div>

      {/* Endpoints Tab */}
      {tab === 'endpoints' && (
        <div>
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              {importStatus && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{importStatus}</span>}
              <input ref={importInput} type="file" accept=".json,.wsdl,.xml,application/json,text/xml,application/xml" style={{ display: 'none' }} onChange={handleImportOpenApi} />
              <Button variant="ghost" onClick={() => importInput.current?.click()}>
                <Upload size={14} /> Importar OpenAPI / WSDL
              </Button>
              <Button onClick={() => openEndpointSheet()}><Plus size={14} /> Endpoint</Button>
            </div>
          )}

          {endpoints.length === 0 ? (
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '32px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
              Nenhum endpoint cadastrado.
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {groupEndpoints(endpoints).map(([group, eps]) => (
                  <section key={group} className="g-box" aria-label={group}>
                    <div className="g-box-header">
                      {group} <span className="g-counter">{eps.length}</span>
                    </div>
                    <Droppable droppableId={`ep:${group}`}>
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef}>
                          {eps.map((ep, i) => (
                            <Draggable key={ep.id} draggableId={String(ep.id)} index={i}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="g-box-row"
                                  style={{ gap: 12, alignItems: 'flex-start', background: 'var(--surface)', ...provided.draggableProps.style }}
                                >
                                  <div {...provided.dragHandleProps} title="Arrastar para reordenar" style={{ cursor: 'grab', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', paddingTop: 2 }}>
                                    <GripVertical size={16} />
                                  </div>
                                  <div style={{ width: 60, flexShrink: 0, paddingTop: 1 }}><MethodBadge method={ep.method} /></div>
                                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{ep.name || 'Sem nome'}</span>
                                      {ep.isModification && <span style={TAG_WARNING}>modificação</span>}
                                      {ep.requiresClient && <span style={TAG_MUTED}>cliente de teste</span>}
                                      {ep.authMode && <span style={TAG_MUTED}>auth: {ep.authMode}</span>}
                                    </div>
                                    <code title={ep.pathTemplate} style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.pathTemplate}</code>
                                    {ep.notes && (
                                      <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                        {ep.notes}
                                      </p>
                                    )}
                                  </div>
                                  {canEdit && (
                                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                      <Button variant="ghost" size="sm" onClick={() => startTransition(() => duplicateEndpoint(ep.id, erp.id))} title="Duplicar" aria-label={`Duplicar ${ep.name}`}><Copy size={13} /></Button>
                                      <Button variant="ghost" size="sm" onClick={() => openEndpointSheet(ep)} title="Editar" aria-label={`Editar ${ep.name}`}><Pencil size={13} /></Button>
                                      <Button variant="ghost" size="sm" onClick={() => startTransition(() => deleteEndpoint(ep.id, erp.id))} title="Excluir" aria-label={`Excluir ${ep.name}`}><Trash2 size={13} /></Button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </section>
                ))}
              </div>
            </DragDropContext>
          )}
        </div>
      )}

      {/* Fields Tab */}
      {tab === 'fields' && (
        <div>
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <Button onClick={() => openFieldSheet()}><Plus size={14} /> Campo</Button>
            </div>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Campos definidos aqui aparecem nos clientes de teste. Configure a fonte automática para preencher via API.
          </p>

          {fieldSchemas.length === 0 ? (
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '32px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
              Nenhum campo definido.
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="fields" type="FIELD">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {fieldSchemas.map((fs, i) => {
                      const usedBy = getEndpointsUsingField(fs.fieldName, endpoints)
                      const sourceEp = fs.sourceEndpointId ? endpoints.find(e => e.id === fs.sourceEndpointId) : null
                      return (
                        <Draggable key={fs.id} draggableId={`field-${fs.id}`} index={i}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, ...provided.draggableProps.style }}
                            >
                              {canEdit && (
                                <div {...provided.dragHandleProps} style={{ cursor: 'grab', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center' }}>
                                  <GripVertical size={16} />
                                </div>
                              )}
                              <code style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                                {`{${fs.fieldName}}`}
                              </code>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 13 }}>{fs.label}</span>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 6px', backgroundColor: 'var(--surface-2)', borderRadius: 4 }}>{fs.fieldType}</span>
                                  {fs.required && <span style={{ fontSize: 11, color: 'var(--status-error)', padding: '2px 6px', backgroundColor: 'color-mix(in srgb, var(--status-error) 9%, transparent)', borderRadius: 4 }}>obrigatório</span>}
                                  {fs.defaultValue && <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 6px', backgroundColor: 'var(--surface-2)', borderRadius: 4, fontFamily: 'monospace' }}>padrão: {fs.defaultValue}</span>}
                                  {sourceEp && (
                                    <span style={{ fontSize: 11, color: 'var(--status-success)', padding: '2px 6px', backgroundColor: 'color-mix(in srgb, var(--status-success) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--status-success) 27%, transparent)', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <Zap size={10} /> {sourceEp.name} → {fs.responsePath || '?'}
                                    </span>
                                  )}
                                </div>
                                {usedBy.length > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    {usedBy.map((ep) => (
                                      <span key={ep.id} style={{ fontSize: 11, color: 'var(--text-muted)', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                                        {ep.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {canEdit && (
                                <div style={{ display: 'flex', gap: 2 }}>
                                  <Button variant="ghost" size="sm" onClick={() => openFieldSheet(fs)} title="Editar"><Pencil size={13} /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => startTransition(() => duplicateFieldSchema(fs.id, erp.id))} title="Duplicar"><Copy size={13} /></Button>
                                  <Button variant="ghost" size="sm" onClick={() => startTransition(() => deleteFieldSchema(fs.id, erp.id))} title="Excluir"><Trash2 size={13} /></Button>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      )
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      )}

      {/* Auth Template Tab */}
      {tab === 'auth' && (
        <AuthModesEditor erpId={erp.id} authTemplate={erp.authTemplate} endpoints={endpoints} canAdmin={canEdit} />
      )}

      {/* Endpoint Sheet */}
      {canEdit && <Sheet open={endpointSheet.open} onClose={() => setEndpointSheet({ open: false })} width={680} title={endpointSheet.endpoint ? 'Editar Endpoint' : 'Novo Endpoint'}>
        <form onSubmit={(e) => {
          e.preventDefault()
          startTransition(async () => {
            const data = { name: epName, method: epMethod, pathTemplate: epPath, bodyTemplate: epBody, headers: epHeaders, group: epGroup, requiresClient: epRequiresClient, isModification: epIsModification, notes: epNotes, authMode: epAuthMode }
            if (endpointSheet.endpoint) {
              await updateEndpoint(endpointSheet.endpoint.id, erp.id, data)
            } else {
              await createEndpoint({ erpId: erp.id, ...data })
            }
            setEndpointSheet({ open: false })
          })
        }}>
          {/* cURL Import */}
          <div style={{ marginBottom: 20, border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => { setCurlOpen((v) => !v); setCurlError('') }}
              style={{ width: '100%', padding: '9px 14px', background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}
            >
              <Terminal size={14} />
              Importar cURL
              <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>{curlOpen ? '▲' : '▼'}</span>
            </button>
            {curlOpen && (
              <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                <textarea
                  value={curlInput}
                  onChange={(e) => { setCurlInput(e.target.value); setCurlError('') }}
                  placeholder={"curl -X POST https://api.example.com/v1/endpoint \\\n  -H \"X-Token: abc\" \\\n  -d '{\"key\": \"value\"}'"}
                  rows={5}
                  style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontFamily: 'monospace', fontSize: 11, outline: 'none', resize: 'vertical' }}
                />
                {curlError && <p style={{ fontSize: 12, color: 'var(--status-error)', margin: '6px 0 0' }}>{curlError}</p>}
                <Button type="button" onClick={handleImportCurl} disabled={!curlInput.trim()} style={{ marginTop: 8 }}>
                  Preencher campos
                </Button>
              </div>
            )}
          </div>

          <label style={labelStyle}>Nome</label>
          <Input value={epName} onChange={(e) => setEpName(e.target.value)} placeholder="Contratos do cliente" required />

          <label style={labelStyle}>Grupo</label>
          <Input value={epGroup} onChange={(e) => setEpGroup(e.target.value)} placeholder="Contrato" list="endpoint-groups" />
          <datalist id="endpoint-groups">
            {[...new Set([...GROUP_ORDER, ...endpoints.map((ep) => ep.group).filter(Boolean)])].map((g) => <option key={g} value={g} />)}
          </datalist>

          <label style={labelStyle}>Método HTTP</label>
          <select style={selectStyle} value={epMethod} onChange={(e) => setEpMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>

          <label style={labelStyle}>Path Template</label>
          <Input value={epPath} onChange={(e) => setEpPath(e.target.value)} placeholder="/api/v1/clients/{client_id}" style={{ fontFamily: 'monospace', fontSize: 12 }} required />

          <label style={labelStyle}>Tipo do corpo</label>
          <select style={selectStyle} value={epBodyMode} onChange={(e) => {
            const mode = BODY_MODES.find((m) => m.id === e.target.value)
            if (mode) setEpHeaders(JSON.stringify(withContentType(parseHeaders(epHeaders), mode.contentType), null, 2))
          }}>
            {BODY_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            {epBodyMode === 'other' && <option value="other">Outro ({contentTypeOf(parseHeaders(epHeaders))})</option>}
          </select>

          <label style={labelStyle}>Body Template</label>
          <JsonTextarea value={epBody} onChange={setEpBody} json={epBodyMode === 'json'} placeholder={BODY_PLACEHOLDER[epBodyMode]} rows={epBodyMode === 'json' ? 5 : 8} />

          <label style={labelStyle}>Headers Extras (JSON)</label>
          <JsonTextarea value={epHeaders} onChange={setEpHeaders} rows={3} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={epRequiresClient} onChange={(e) => setEpRequiresClient(e.target.checked)} />
            Requer cliente de teste
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={epIsModification} onChange={(e) => setEpIsModification(e.target.checked)} />
            Endpoint de modificação
          </label>

          <label style={labelStyle}>Notas <span style={{ color: 'var(--text-subtle)' }}>(opcional)</span></label>
          <textarea
            value={epNotes}
            onChange={(e) => setEpNotes(e.target.value)}
            placeholder="Observações sobre este endpoint..."
            rows={3}
            style={{ width: '100%', padding: '8px 12px', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none', resize: 'vertical' }}
          />

          {getAuthModes(erp.authTemplate).length > 1 && (
            <>
              <label style={labelStyle}>Modo de autenticação</label>
              <select style={selectStyle} value={epAuthMode} onChange={(e) => setEpAuthMode(e.target.value)}>
                <option value="">Padrão da empresa</option>
                {getAuthModes(erp.authTemplate).map((m) => (
                  <option key={m.id} value={m.id}>{m.label || m.id} ({AUTH_TYPES[m.type]?.label ?? m.type})</option>
                ))}
              </select>
            </>
          )}

          <Button type="submit" disabled={isPending} style={{ width: '100%', marginTop: 24 }}>
            {isPending ? 'Salvando...' : 'Salvar Endpoint'}
          </Button>
        </form>
      </Sheet>}

      {/* Field Schema Sheet */}
      {canEdit && <Sheet open={fieldSheet.open} onClose={() => setFieldSheet({ open: false })} title={fieldSheet.field ? 'Editar Campo' : 'Novo Campo'} width={520}>
        <form onSubmit={(e) => {
          e.preventDefault()
          startTransition(async () => {
            const data = {
              fieldName: fsName,
              label: fsLabel,
              fieldType: fsType,
              required: fsRequired,
              sourceEndpointId: fsSourceEndpointId,
              endpointParam: fsEndpointParam,
              responsePath: fsResponsePath,
              defaultValue: fsDefaultValue,
            }
            if (fieldSheet.field) {
              await updateFieldSchema(fieldSheet.field.id, erp.id, data)
            } else {
              await createFieldSchema({ erpId: erp.id, ...data })
            }
            setFieldSheet({ open: false })
          })
        }}>
          <label style={labelStyle}>Nome do campo <span style={{ color: 'var(--text-subtle)' }}>(placeholder)</span></label>
          <Input value={fsName} onChange={(e) => setFsName(e.target.value)} placeholder="client_id" style={{ fontFamily: 'monospace' }} required />

          <label style={labelStyle}>Label (exibição)</label>
          <Input value={fsLabel} onChange={(e) => setFsLabel(e.target.value)} placeholder="ID do Cliente" required />

          <label style={labelStyle}>Valor padrão <span style={{ color: 'var(--text-subtle)' }}>(usado quando o cliente de teste não tem valor)</span></label>
          <Input value={fsDefaultValue} onChange={(e) => setFsDefaultValue(e.target.value)} placeholder="ex.: Senha-Teste-123" style={{ fontFamily: 'monospace' }} />

          <label style={labelStyle}>Tipo</label>
          <select style={selectStyle} value={fsType} onChange={(e) => setFsType(e.target.value)}>
            {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={fsRequired} onChange={(e) => setFsRequired(e.target.checked)} />
            Obrigatório
          </label>

          {/* Auto-fill config */}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>
              Preenchimento automático
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 10 }}>
              Configure para preencher este campo automaticamente via API ao criar clientes.
            </p>

            <label style={labelStyle}>Endpoint fonte</label>
            <select
              style={selectStyle}
              value={fsSourceEndpointId ?? ''}
              onChange={(e) => setFsSourceEndpointId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Sem preenchimento automático</option>
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>{ep.method} {ep.name}</option>
              ))}
            </select>

            {fsSourceEndpointId && (
              <>
                <label style={labelStyle}>
                  Parâmetro de entrada{' '}
                  <span style={{ color: 'var(--text-subtle)' }}>({'{'}placeholder{'}'} do endpoint que recebe o identificador)</span>
                </label>
                <Input
                  value={fsEndpointParam}
                  onChange={(e) => setFsEndpointParam(e.target.value)}
                  placeholder="CPF"
                  style={{ fontFamily: 'monospace' }}
                />

                <label style={labelStyle}>
                  Caminho na resposta{' '}
                  <span style={{ color: 'var(--text-subtle)' }}>(ex: registros[0].id)</span>
                </label>
                <Input
                  value={fsResponsePath}
                  onChange={(e) => setFsResponsePath(e.target.value)}
                  placeholder="data[0].document"
                  style={{ fontFamily: 'monospace' }}
                />
              </>
            )}
          </div>

          <Button type="submit" disabled={isPending} style={{ width: '100%', marginTop: 24 }}>
            {isPending ? 'Salvando...' : fieldSheet.field ? 'Salvar Campo' : 'Adicionar Campo'}
          </Button>
        </form>
      </Sheet>}
    </div>
  )
}
