'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Loader2, PartyPopper } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AUTH_TYPES, SETUP_AUTH_TYPES } from '@/lib/auth'
import { bodyError, connected, parse, type Exec } from '@/lib/connection-check'
import { saveFirstSetup, type SetupIds, type SetupInput } from '@/lib/actions/setup'

type Step = 0 | 1 | 2
const STEPS = ['Sua API', 'Primeira chamada', 'Pronto']

/** Starting point for each kind of API: the request shape it usually needs. */
const KINDS = {
  rest: { label: 'REST / JSON', hint: 'A maioria das APIs: GET e POST com JSON.', method: 'GET', path: '/', contentType: 'application/json', body: '' },
  soap: {
    label: 'SOAP / XML', hint: 'Web services com WSDL: POST de um envelope XML.', method: 'POST', path: '/', contentType: 'text/xml; charset=utf-8',
    body: '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <!-- operação aqui -->\n  </soap:Body>\n</soap:Envelope>',
  },
  graphql: {
    label: 'GraphQL', hint: 'Um único endpoint que recebe a query no corpo.', method: 'POST', path: '/graphql', contentType: 'application/json',
    body: '{\n  "query": "{ __typename }"\n}',
  },
} as const
type Kind = keyof typeof KINDS

const text: React.CSSProperties = { fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-strong)', margin: '14px 0 6px' }
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-subtle)', marginTop: 4, lineHeight: 1.5 }
const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: 13 }
const field: React.CSSProperties = { ...mono, width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-box)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }

async function execute(endpointId: number, companyId: number): Promise<Exec> {
  const res = await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpointId, companyId }) })
  return res.json()
}

/** A failed first call in plain words. */
function explain(r: Exec): string {
  const json = parse(r.responseBody) as Record<string, unknown> | null
  const msg = (bodyError(json) ?? (json && typeof json === 'object' ? String(json.message ?? json.error ?? '') : r.responseBody?.slice(0, 160) ?? '')).replace(/\.$/, '')
  if (r.statusCode === 401 || r.statusCode === 403) return `A API recusou as credenciais${msg ? ` ("${msg}")` : ''}. Volte e confira a autenticação.`
  if (r.statusCode === 404) return 'A API respondeu 404: o caminho ou a URL base estão errados.'
  if (r.statusCode >= 500) return `A API respondeu com erro interno (${r.statusCode}). Confira o corpo da chamada ou tente de novo.`
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return 'Não achei esse endereço (DNS). Confira a URL base.'
  if (/ECONNREFUSED|timeout|ETIMEDOUT/i.test(msg)) return 'O servidor não respondeu. Confira a URL e se ele aceita conexões da rede onde o ERP Tester roda.'
  if (r.statusCode >= 200 && r.statusCode < 300) return `A API respondeu, mas com erro${msg ? `: "${msg}"` : ''}.`
  return msg || `Resposta inesperada (${r.statusCode}).`
}

export function Journey() {
  const [step, setStep] = useState<Step>(0)
  const startedAt = useRef(Date.now())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [kind, setKind] = useState<Kind>('rest')
  const [form, setForm] = useState<SetupInput>({
    name: '', baseUrl: '', authType: 'none', credentials: {},
    method: KINDS.rest.method, path: KINDS.rest.path, body: KINDS.rest.body, contentType: KINDS.rest.contentType,
  })
  const set = (patch: Partial<SetupInput>) => setForm((f) => ({ ...f, ...patch }))
  const pickKind = (k: Kind) => {
    setKind(k)
    const { method, path, body, contentType } = KINDS[k]
    set({ method, path, body, contentType })
  }

  const [ids, setIds] = useState<SetupIds | null>(null)
  const [result, setResult] = useState<Exec | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const ok = !!result && connected(result)
  const authFields = form.authType === 'none' ? [] : AUTH_TYPES[form.authType].fixedKeys ?? []

  const next0 = () => {
    setError('')
    if (!form.name.trim() || !form.baseUrl.trim()) { setError('Preencha o nome e a URL base.'); return }
    const missing = authFields.filter((f) => !form.credentials[f.key]?.trim()).map((f) => f.label)
    if (missing.length) { setError(`Faltam: ${missing.join(', ')}.`); return }
    setStep(1)
  }

  const run = () => startTransition(async () => {
    setError(''); setResult(null)
    const saved = await saveFirstSetup(form, ids)
    if ('error' in saved) { setError(saved.error); return }
    setIds(saved)
    try {
      const r = await execute(saved.endpointId, saved.companyId)
      setResult(r)
      if (connected(r)) setElapsed(Math.round((Date.now() - startedAt.current) / 1000))
    } catch {
      setError('Não consegui falar com o servidor do ERP Tester.')
    }
  })

  const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`)
  const testUrl = ids ? `/test?${new URLSearchParams({ erpId: String(ids.erpId), companyId: String(ids.companyId), endpointId: String(ids.endpointId) })}` : '/test'

  return (
    <div style={{ padding: '32px 40px', maxWidth: 780 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text-strong)' }}>Vamos fazer sua primeira chamada</h1>
        <Link href="/erps" style={{ fontSize: 13, color: 'var(--link)', whiteSpace: 'nowrap' }}>Sair do assistente</Link>
      </div>
      <p style={{ ...text, marginBottom: 18 }}>
        Qualquer API HTTP: REST, SOAP ou GraphQL. Informe o endereço e a autenticação, faça uma chamada e pronto. Depois dá para importar o resto dos endpoints de uma coleção Postman, OpenAPI ou curl.
      </p>

      <ol aria-label="Passos" style={{ display: 'flex', gap: 6, listStyle: 'none', padding: 0, margin: '0 0 16px', flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', fontSize: 12, borderRadius: 99,
            border: `1px solid ${i === step ? 'var(--accent)' : 'var(--border)'}`, background: i === step ? 'var(--accent-soft)' : 'transparent',
            color: i <= step ? 'var(--text-strong)' : 'var(--text-subtle)', fontWeight: i === step ? 600 : 400,
          }}>
            {i < step ? <Check size={12} /> : <span style={{ fontSize: 11 }}>{i + 1}</span>} {s}
          </li>
        ))}
      </ol>

      <section className="g-box">
        <div className="g-box-header">{STEPS[step]}</div>
        <div style={{ padding: 18 }}>
          {step === 0 && (
            <>
              <div style={{ ...label, marginTop: 0 }}>Que tipo de API é?</div>
              <div role="radiogroup" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {(Object.keys(KINDS) as Kind[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => pickKind(k)} style={{
                    textAlign: 'left', padding: 12, borderRadius: 'var(--radius-box)', cursor: 'pointer', color: 'var(--text)',
                    border: `1px solid ${kind === k ? 'var(--accent)' : 'var(--border)'}`, background: kind === k ? 'var(--accent-soft)' : 'var(--surface)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>
                      {KINDS[k].label} {kind === k && <Check size={15} style={{ color: 'var(--accent)' }} />}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{KINDS[k].hint}</div>
                  </button>
                ))}
              </div>

              <label htmlFor="name" style={label}>Nome</label>
              <Input id="name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Minha API" />
              <p style={hint}>Como ela vai aparecer no menu, por exemplo o nome do sistema.</p>

              <label htmlFor="base" style={label}>URL base</label>
              <Input id="base" value={form.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder="https://api.exemplo.com" style={mono} />
              <p style={hint}>O começo comum a todas as chamadas. O caminho de cada uma vem no próximo passo.</p>

              <label htmlFor="auth" style={label}>Autenticação</label>
              <select id="auth" value={form.authType} onChange={(e) => set({ authType: e.target.value as SetupInput['authType'], credentials: {} })} style={field}>
                {SETUP_AUTH_TYPES.map((t) => <option key={t} value={t}>{t === 'none' ? 'Nenhuma' : AUTH_TYPES[t].label}</option>)}
              </select>
              <p style={hint}>
                {form.authType === 'none' ? 'API pública ou de teste.' : `Envia: ${AUTH_TYPES[form.authType].sends}.`} OAuth2 e token obtido num endpoint ficam na página da API, depois.
              </p>
              {authFields.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`cred-${f.key}`} style={label}>{f.label}</label>
                  <Input
                    id={`cred-${f.key}`} autoComplete="off" type={/password|token|value/.test(f.key) ? 'password' : 'text'} style={mono}
                    value={form.credentials[f.key] ?? ''} onChange={(e) => set({ credentials: { ...form.credentials, [f.key]: e.target.value } })}
                  />
                </div>
              ))}
            </>
          )}

          {step === 1 && (
            <>
              <p style={text}>Uma chamada que você sabe que funciona, de preferência uma consulta que não altera nada.</p>
              <div style={label}>Chamada</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select aria-label="Método" value={form.method} onChange={(e) => set({ method: e.target.value as SetupInput['method'] })} style={{ ...field, width: 110 }}>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
                </select>
                <Input aria-label="Caminho" value={form.path} onChange={(e) => set({ path: e.target.value })} placeholder="/status" style={mono} />
              </div>
              <p style={hint}>Vai para <code>{(form.baseUrl.replace(/\/+$/, '') || 'https://…') + (form.path || '/')}</code></p>

              {form.method !== 'GET' && (
                <>
                  <label htmlFor="ctype" style={label}>Tipo do corpo (Content-Type)</label>
                  <Input id="ctype" value={form.contentType} onChange={(e) => set({ contentType: e.target.value })} style={mono} />
                  <label htmlFor="body" style={label}>Corpo</label>
                  <textarea id="body" value={form.body} onChange={(e) => set({ body: e.target.value })} rows={7} spellCheck={false} style={{ ...field, resize: 'vertical' }} />
                  {kind === 'soap' && <p style={hint}>Muitos serviços SOAP também pedem o header SOAPAction: dá para adicionar depois em Testar API.</p>}
                </>
              )}

              <div style={{ marginTop: 16 }}>
                <Button type="button" onClick={run} disabled={isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {isPending ? <><Loader2 size={14} className="spin" /> Chamando…</> : result ? 'Salvar e chamar de novo' : 'Salvar e fazer a chamada'}
                </Button>
              </div>

              {result && (
                <div className="g-box" style={{ marginTop: 14 }}>
                  <div className="g-box-header" style={{ color: ok ? 'var(--status-success)' : 'var(--status-error)' }}>
                    {ok ? <><PartyPopper size={15} /> Primeira chamada funcionou em {fmt(elapsed)}</> : <><CircleAlert size={15} /> {explain(result)}</>}
                    <span className="g-counter" style={{ marginLeft: 'auto' }}>{result.statusCode} · {result.durationMs} ms</span>
                  </div>
                  <pre style={{ ...mono, fontSize: 11, margin: 0, padding: '10px 14px', maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {result.responseBody?.slice(0, 4000) || '(resposta vazia)'}
                  </pre>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ ...text, color: 'var(--text-strong)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PartyPopper size={18} style={{ color: 'var(--accent)' }} /> Pronto: {form.name} está cadastrada e a primeira chamada está salva.
              </p>
              <div className="g-box" style={{ marginTop: 12 }}>
                <div className="g-box-row" style={hint}>Os outros endpoints: na página da API, importe uma coleção Postman, OpenAPI ou um curl.</div>
                <div className="g-box-row" style={hint}>Outros ambientes ou clientes da mesma API: Empresas → Nova Empresa.</div>
                <div className="g-box-row" style={hint}>No Início fica uma lista de primeiros passos (convidar o time, salvar um registro, criar um fluxo).</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <Link href={testUrl} className="btn-default btn-md" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Abrir no Testar API <ArrowRight size={14} /></Link>
                <Link href={`/erps/${ids?.erpId}`} className="btn-ghost btn-md" style={{ textDecoration: 'none' }}>Importar endpoints</Link>
                <Link href="/" className="btn-ghost btn-md" style={{ textDecoration: 'none' }}>Ir para o Início</Link>
              </div>
            </>
          )}

          {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--status-error)' }}>{error}</p>}

          {step < 2 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 8 }}>
              {step === 1
                ? <Button type="button" variant="ghost" onClick={() => { setError(''); setStep(0) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> Voltar</Button>
                : <span />}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {step === 1 && ids && !ok && <button type="button" onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--link)', fontSize: 13, cursor: 'pointer' }}>Continuar mesmo assim</button>}
                {step === 0 && <Button type="button" onClick={next0} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Continuar <ArrowRight size={14} /></Button>}
                {step === 1 && <Button type="button" disabled={!ok || isPending} onClick={() => setStep(2)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Concluir <ArrowRight size={14} /></Button>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
