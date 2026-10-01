'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Check, Lock, Plus, Trash2 } from 'lucide-react'
import { AUTH_TYPES, getAuthModes, type AuthModeConfig } from '@/lib/auth'
import { fieldsForType, toAuthTemplate, validateAuthModes as validate } from '@/lib/auth-template'
import { updateERPAuthTemplate } from '@/lib/actions/erps'
import { Button } from '@/components/ui/button'

type Endpoint = { id: number; name: string; method: string; pathTemplate: string; bodyTemplate: string; authMode?: string | null }
type Mode = AuthModeConfig & { saved: boolean }

const input: React.CSSProperties = {
  width: '100%', height: 32, padding: '0 10px', fontSize: 13, color: 'var(--text)',
  background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 'var(--radius)',
}
const mono: React.CSSProperties = { ...input, fontFamily: 'monospace', fontSize: 12 }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 4 }
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)' }

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const placeholdersOf = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])

export function AuthModesEditor({ erpId, authTemplate, endpoints, canAdmin }: {
  erpId: number
  authTemplate: unknown
  endpoints: Endpoint[]
  canAdmin: boolean
}) {
  const initial = useMemo(() => getAuthModes(authTemplate).map((m) => ({ ...m, fields: m.fields ?? [], saved: true })), [authTemplate])
  const [modes, setModes] = useState<Mode[]>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const readOnly = !canAdmin

  const update = (i: number, patch: Partial<Mode>) => setModes((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const updateField = (i: number, fi: number, patch: Partial<AuthModeConfig['fields'][number]>) =>
    update(i, { fields: modes[i].fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) })

  const addMode = () => setModes((prev) => [...prev, { id: '', type: 'bearer', label: '', fields: fieldsForType('bearer', []), tokenPath: 'token', saved: false }])

  const save = () => {
    const problems = validate(modes, endpoints)
    setErrors(problems)
    if (problems.length) return
    const template = toAuthTemplate(modes)
    startTransition(async () => {
      await updateERPAuthTemplate(erpId, template)
      setModes((prev) => prev.map((m) => ({ ...m, saved: true })))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ ...hint, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
        Como as empresas deste ERP se autenticam. Cada empresa preenche os campos do modo; a execução usa o modo do endpoint
        (quando ele escolhe um) ou o primeiro modo com credenciais preenchidas. Mudanças aqui valem na hora para todas as empresas.
      </p>

      {modes.length === 0 && (
        <div className="g-box" style={{ padding: 20, textAlign: 'center', ...hint }}>Sem autenticação: as requisições vão sem credenciais.</div>
      )}

      {modes.map((m, i) => {
        const type = AUTH_TYPES[m.type]
        const usedBy = endpoints.filter((e) => e.authMode && e.authMode === m.id)
        const tokenEp = endpoints.find((e) => e.id === m.tokenEndpointId)
        const missing = tokenEp ? placeholdersOf(tokenEp.pathTemplate + ' ' + tokenEp.bodyTemplate).filter((p) => !m.fields.some((f) => f.key === p)) : []
        return (
          <section key={i} className="g-box">
            <div className="g-box-header" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {m.label || 'Novo modo'}
                <code className="g-counter" style={{ fontFamily: 'monospace' }}>{m.id || '—'}</code>
                {i === 0 && <span style={{ ...hint, fontWeight: 400 }}>padrão</span>}
              </span>
              {!readOnly && (
                <button
                  type="button" title={usedBy.length ? 'Usado por endpoints: troque o modo deles antes' : 'Remover modo'} aria-label="Remover modo"
                  disabled={usedBy.length > 0}
                  onClick={() => {
                    if (m.saved && !confirm(`Remover "${m.label || m.id}"? As empresas deixam de usar as credenciais deste modo.`)) return
                    setModes((prev) => prev.filter((_, j) => j !== i))
                  }}
                  style={{ background: 'none', border: 'none', cursor: usedBy.length ? 'not-allowed' : 'pointer', color: 'var(--text-subtle)', opacity: usedBy.length ? 0.4 : 1 }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={label}>Nome (aparece na empresa)</label>
                  <input
                    style={input} value={m.label} disabled={readOnly} placeholder="Ex.: Token + App"
                    onChange={(e) => update(i, { label: e.target.value, ...(!m.saved ? { id: slug(e.target.value) } : {}) })}
                  />
                </div>
                <div>
                  <label style={label}>Tipo</label>
                  <select
                    style={input} value={m.type} disabled={readOnly}
                    onChange={(e) => update(i, { type: e.target.value, fields: fieldsForType(e.target.value, AUTH_TYPES[m.type]?.fixedKeys ? [] : m.fields) })}
                  >
                    {Object.entries(AUTH_TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={label}>ID do modo</label>
                {m.saved ? (
                  <div style={{ ...hint, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={12} /> <code>{m.id}</code> — fixo: as credenciais das empresas e os endpoints apontam para ele.
                  </div>
                ) : (
                  <input style={mono} value={m.id} disabled={readOnly} placeholder="gerado pelo nome" onChange={(e) => update(i, { id: e.target.value })} />
                )}
              </div>

              {m.type === 'token_endpoint' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                  <div>
                    <label style={label}>Endpoint que devolve o token</label>
                    <select style={input} value={m.tokenEndpointId ?? ''} disabled={readOnly} onChange={(e) => update(i, { tokenEndpointId: e.target.value ? Number(e.target.value) : undefined })}>
                      <option value="">Selecione…</option>
                      {endpoints.map((ep) => <option key={ep.id} value={ep.id}>{ep.method} {ep.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={label}>Onde está o token na resposta</label>
                    <input style={mono} value={m.tokenPath ?? ''} disabled={readOnly} placeholder="access_token" onChange={(e) => update(i, { tokenPath: e.target.value })} />
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ ...label, marginBottom: 0 }}>
                    Campos que a empresa preenche {type?.keysHint && <span style={{ ...hint, fontWeight: 400 }}>· {type.keysHint}</span>}
                  </label>
                  {!readOnly && !type?.fixedKeys && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => update(i, { fields: [...m.fields, { key: '', label: '', placeholder: '', default: '', hidden: false }] })}>
                      <Plus size={13} /> Campo
                    </Button>
                  )}
                </div>
                <div className="g-box">
                  {m.fields.length === 0 && <div style={{ padding: 12, ...hint }}>Nenhum campo.</div>}
                  {m.fields.map((f, fi) => (
                    <div key={fi} className="g-box-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ width: 150 }}>
                        {type?.fixedKeys ? (
                          <code title="Chave exigida por este tipo" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--link)' }}><Lock size={11} /> {f.key}</code>
                        ) : (
                          <input style={mono} value={f.key} disabled={readOnly} placeholder="chave" aria-label="Chave" onChange={(e) => updateField(i, fi, { key: e.target.value.trim() })} />
                        )}
                      </div>
                      <input style={{ ...input, flex: '1 1 140px', width: 'auto' }} value={f.label} disabled={readOnly} placeholder="Rótulo" aria-label="Rótulo" onChange={(e) => updateField(i, fi, { label: e.target.value })} />
                      <input style={{ ...mono, flex: '1 1 120px', width: 'auto' }} value={f.default ?? ''} disabled={readOnly} placeholder="valor padrão" aria-label="Valor padrão" onChange={(e) => updateField(i, fi, { default: e.target.value })} />
                      <label title="A empresa não vê o campo; vai sempre o valor padrão" style={{ ...hint, display: 'flex', alignItems: 'center', gap: 4, cursor: readOnly ? 'default' : 'pointer' }}>
                        <input type="checkbox" checked={f.hidden ?? false} disabled={readOnly} onChange={(e) => updateField(i, fi, { hidden: e.target.checked })} /> oculto
                      </label>
                      {!readOnly && !type?.fixedKeys && (
                        <button type="button" aria-label="Remover campo" onClick={() => update(i, { fields: m.fields.filter((_, j) => j !== fi) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ ...hint }}><strong style={{ color: 'var(--text-strong)' }}>Como vai na requisição:</strong> {type?.sends ?? '—'}</div>
                <div style={hint}>
                  {i === 0 ? 'Padrão: usado pelos endpoints que não escolhem modo' : 'Usado só pelos endpoints que escolhem este modo'}
                  {usedBy.length > 0 && <> · escolhido por {usedBy.length} endpoint{usedBy.length > 1 ? 's' : ''}: {usedBy.map((e) => e.name).join(', ')}</>}
                </div>
                {missing.length > 0 && (
                  <div style={{ ...hint, color: 'var(--status-warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={13} /> O endpoint de token usa {missing.map((p) => `{${p}}`).join(', ')}, que não {missing.length > 1 ? 'são campos' : 'é campo'} deste modo.
                  </div>
                )}
              </div>
            </div>
          </section>
        )
      })}

      {errors.length > 0 && (
        <div role="alert" style={{ padding: '10px 14px', fontSize: 13, color: 'var(--status-error)', background: 'color-mix(in srgb, var(--status-error) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--status-error) 30%, transparent)', borderRadius: 'var(--radius-box)' }}>
          <strong>Não salvei:</strong>
          <ul style={{ margin: '6px 0 0 18px' }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="ghost" onClick={addMode}><Plus size={13} /> Adicionar modo</Button>
          <Button type="button" onClick={save} disabled={isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {saved ? <><Check size={14} /> Salvo</> : isPending ? 'Salvando…' : 'Salvar autenticação'}
          </Button>
        </div>
      )}
    </div>
  )
}
