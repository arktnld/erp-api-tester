'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Loader2, PartyPopper, Search, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AUTH_TYPES } from '@/lib/auth'
import { detectTemplate, type ErpTemplate } from '@/lib/erp-templates'
import { valueAt } from '@/lib/json-path'
import { bodyError, connected, parse, type Exec } from '@/lib/connection-check'
import { installErpTemplate, updateSetupCompany } from '@/lib/actions/setup'
import { createTestClient } from '@/lib/actions/test-clients'

type Step = 0 | 1 | 2 | 3
const STEPS = ['ERP', 'Empresa', 'Primeira chamada', 'Pronto']

const text: React.CSSProperties = { fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-strong)', margin: '14px 0 6px' }
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--text-subtle)', marginTop: 4, lineHeight: 1.5 }
const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: 13 }
const SECRET = /secret|password|token|senha|value/i

async function execute(endpointId: number, companyId: number, inlineFields?: Record<string, string>): Promise<Exec> {
  const res = await fetch('/api/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointId, companyId, ...(inlineFields ? { inlineFields } : {}) }),
  })
  return res.json()
}

/** What a failed connection test most likely means, in plain words. */
function explain(r: Exec, tpl: ErpTemplate): string {
  const json = parse(r.responseBody) as Record<string, unknown> | null
  let msg = bodyError(json) ?? ''
  if (!msg && json && typeof json === 'object') msg = String(json.error_description ?? json.message ?? json.error ?? '')
  if (!msg && !json) msg = r.responseBody?.slice(0, 160) ?? ''
  msg = msg.replace(/\.$/, '')
  if (r.statusCode >= 200 && r.statusCode < 300) return `O ${tpl.name} respondeu, mas recusou${msg ? `: "${msg}"` : ' (sem token na resposta)'}. Confira as credenciais.`
  if (r.statusCode === 401 || r.statusCode === 403) return `O ${tpl.name} recusou as credenciais${msg ? ` ("${msg}")` : ''}. Confira os campos acima.`
  if (r.statusCode === 404) return `O endereço respondeu 404: a URL base deve estar errada. Formato esperado: ${tpl.baseUrlExample}`
  if (r.statusCode === 400) return `O ${tpl.name} rejeitou o pedido${msg ? ` ("${msg}")` : ''}. Confira as credenciais e a URL base.`
  if (r.statusCode >= 500 && r.statusCode < 600) return `O ${tpl.name} respondeu com erro interno (${r.statusCode}). Tente de novo em instantes.`
  if (/ENOTFOUND|EAI_AGAIN/.test(msg)) return 'Não achei esse endereço (DNS). Confira a URL base.'
  if (/ECONNREFUSED|timeout|ETIMEDOUT/i.test(msg)) return 'O servidor não respondeu. Confira a URL e se ele aceita conexões da rede onde o ERP Tester roda.'
  return msg || `Resposta inesperada (${r.statusCode}).`
}

export function Journey({ templates, existing }: { templates: ErpTemplate[]; existing: string[] }) {
  const [step, setStep] = useState<Step>(0)
  const startedAt = useRef(Date.now())
  const [isPending, startTransition] = useTransition()

  // 1. ERP
  const [pastedUrl, setPastedUrl] = useState('')
  const [slug, setSlug] = useState('')
  const detected = useMemo(() => detectTemplate(pastedUrl), [pastedUrl])
  useEffect(() => {
    if (detected && !existing.includes(detected.name) && detected.slug !== slug) pickTemplate(detected)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to a new detection only
  }, [detected])
  const tpl = templates.find((t) => t.slug === slug)

  // 2. Empresa
  const [coName, setCoName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modeId, setModeId] = useState('')
  const [creds, setCreds] = useState<Record<string, Record<string, string>>>({})
  const [installed, setInstalled] = useState<{ erpId: number; companyId: number; endpointIds: Record<string, number> } | null>(null)
  const [conn, setConn] = useState<{ ok: boolean; msg: string } | null>(null)
  const [error, setError] = useState('')

  // 3. Primeira chamada
  const [cpf, setCpf] = useState('')
  const [first, setFirst] = useState<{ r: Exec; found: { label: string; field: string; value: string }[] } | null>(null)
  const [clientId, setClientId] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const allToken = !!tpl && tpl.authModes.every((m) => m.type === 'token_endpoint')
  const activeMode = tpl?.authModes.find((m) => m.id === modeId) ?? tpl?.authModes[0]

  const pickTemplate = (t: ErpTemplate) => {
    setSlug(t.slug); setError('')
    setModeId(t.authModes[0].id)
    // field defaults (e.g. Voalle's client id "synauth") pre-filled
    setCreds(Object.fromEntries(t.authModes.map((m) => [m.id, Object.fromEntries(m.fields.map((f) => [f.key, f.default ?? '']))])))
    if (pastedUrl.trim() && detectTemplate(pastedUrl)?.slug === t.slug) setBaseUrl(pastedUrl.trim())
  }

  /** Modes whose fields the company fills: the chosen one (token ERPs) or all (first required, rest optional). */
  const shownModes = !tpl ? [] : allToken ? tpl.authModes.filter((m) => m.id === activeMode?.id) : tpl.authModes
  const required = (mId: string) => (allToken ? mId === activeMode?.id : mId === tpl?.authModes[0].id)

  const saveAndTest = () => startTransition(async () => {
    if (!tpl || !activeMode) return
    setError(''); setConn(null)
    const missing = tpl.authModes.filter((m) => required(m.id)).flatMap((m) => m.fields.filter((f) => !f.hidden && !creds[m.id]?.[f.key]?.trim()).map((f) => f.label))
    if (!coName.trim() || !baseUrl.trim()) { setError('Preencha o nome e a URL base da empresa.'); return }
    if (missing.length) { setError(`Faltam: ${missing.join(', ')}.`); return }
    // Token ERPs: only the chosen mode keeps credentials, so it's the one used.
    const credentials = allToken ? { [activeMode.id]: creds[activeMode.id] ?? {} } : creds
    const company = { name: coName, baseUrl, credentials }
    let ids = installed
    if (!ids) {
      const res = await installErpTemplate(tpl.slug, company)
      if ('error' in res) { setError(res.error); return }
      ids = res
      setInstalled(res)
    } else {
      const res = await updateSetupCompany(ids.companyId, company)
      if ('error' in res) { setError(res.error); return }
    }
    const probeKey = activeMode.type === 'token_endpoint' ? activeMode.tokenEndpoint! : tpl.probeEndpoint!
    try {
      const r = await execute(ids.endpointIds[probeKey], ids.companyId)
      const ok = connected(r, activeMode.type === 'token_endpoint' ? activeMode.tokenPath ?? 'token' : undefined)
      setConn({ ok, msg: ok ? `Conectado: ${r.statusCode} em ${r.durationMs} ms.` : explain(r, tpl) })
    } catch {
      setConn({ ok: false, msg: 'Não consegui falar com o servidor do ERP Tester.' })
    }
  })

  const firstCall = () => startTransition(async () => {
    if (!tpl || !installed) return
    setError(''); setFirst(null)
    const r = await execute(installed.endpointIds[tpl.firstCall], installed.companyId, { cpfcnpj: cpf.replace(/\D/g, '') })
    let json: unknown = null
    try { json = JSON.parse(r.responseBody) } catch { /* not JSON */ }
    const found = tpl.fieldSchemas
      .filter((f) => f.source === tpl.firstCall && f.responsePath)
      .map((f) => ({ label: f.label, field: f.fieldName, value: (json ? valueAt(json, f.responsePath) : undefined) ?? '' }))
      .filter((f) => f.value)
    setFirst({ r, found })
    if (connected(r)) setElapsed(Math.round((Date.now() - startedAt.current) / 1000))
  })

  const saveClient = () => startTransition(async () => {
    if (!installed || !first) return
    const fields = { cpfcnpj: cpf.replace(/\D/g, ''), ...Object.fromEntries(first.found.map((f) => [f.field, f.value])) }
    const name = first.found.find((f) => f.field === 'nome')?.value || 'Cliente de teste'
    const res = await createTestClient({ name, companyId: installed.companyId, fieldsData: JSON.stringify(fields) })
    setClientId(res.id)
    setStep(3)
  })

  const testUrl = installed && tpl ? `/test?${new URLSearchParams({
    erpId: String(installed.erpId), companyId: String(installed.companyId), endpointId: String(installed.endpointIds[tpl.firstCall]),
    ...(clientId ? { clientId: String(clientId) } : {}),
  })}` : '/test'
  const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`)
  const ok2xx = !!first && connected(first.r)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 780 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text-strong)' }}>Vamos fazer sua primeira chamada</h1>
        <Link href="/erps" style={{ fontSize: 13, color: 'var(--link)', whiteSpace: 'nowrap' }}>Sair do assistente</Link>
      </div>
      <p style={{ ...text, marginBottom: 18 }}>Em uns 2 minutos: escolha o ERP, informe uma empresa e busque um cliente pelo CPF. O ERP Tester já vem com os endpoints de cada ERP configurados.</p>

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
              <label htmlFor="url" style={{ ...label, marginTop: 0 }}>Tem a URL da API de uma empresa? Cole aqui que eu descubro o ERP</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
                <Input id="url" value={pastedUrl} onChange={(e) => setPastedUrl(e.target.value)} placeholder="https://api.provedor.hubsoft.com.br" style={{ ...mono, paddingLeft: 30 }} />
              </div>
              {pastedUrl && (
                <p style={{ ...hint, color: detected ? 'var(--status-success)' : 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {detected ? <><Sparkles size={12} /> Parece {detected.name}.{existing.includes(detected.name) && ' Ele já está cadastrado.'}</> : 'Não reconheci; escolha abaixo.'}
                </p>
              )}

              <div style={label}>Ou escolha o ERP</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {templates.map((t) => {
                  const taken = existing.includes(t.name)
                  const active = t.slug === slug
                  return (
                    <button
                      key={t.slug} type="button" disabled={taken} aria-pressed={active} onClick={() => pickTemplate(t)}
                      style={{
                        textAlign: 'left', padding: 12, borderRadius: 'var(--radius-box)', cursor: taken ? 'not-allowed' : 'pointer',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-soft)' : 'var(--surface)',
                        opacity: taken ? 0.55 : 1, color: 'var(--text)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>
                        {t.name} {active && <Check size={15} style={{ color: 'var(--accent)' }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 6px', lineHeight: 1.5 }}>{t.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                        {taken ? 'Já cadastrado' : `${t.endpoints.length} endpoints prontos · ${[...new Set(t.authModes.map((m) => AUTH_TYPES[m.type]?.label ?? m.type))].join(' ou ')}`}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p style={{ ...hint, marginTop: 12 }}>
                O seu não está aqui? <Link href="/erps" style={{ color: 'var(--link)' }}>Cadastre do zero em ERPs</Link>: lá dá para importar uma coleção Postman, curl ou OpenAPI.
              </p>
            </>
          )}

          {step === 1 && tpl && (
            <>
              <p style={text}>Uma empresa que usa o {tpl.name}: o endereço da API dela e as credenciais. Eu testo a conexão antes de seguir.</p>
              <label htmlFor="co" style={label}>Nome da empresa</label>
              <Input id="co" autoFocus value={coName} onChange={(e) => setCoName(e.target.value)} placeholder="Provedor Exemplo" />
              <label htmlFor="base" style={label}>URL base da API</label>
              <Input id="base" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={tpl.baseUrlExample} style={mono} />
              <p style={hint}>Formato do {tpl.name}: <code>{tpl.baseUrlExample}</code></p>

              {allToken && tpl.authModes.length > 1 && (
                <>
                  <div style={label}>Como esta empresa entra na API</div>
                  <div role="radiogroup" className="g-box">
                    {tpl.authModes.map((m) => (
                      <label key={m.id} className="g-box-row" style={{ gap: 10, cursor: 'pointer' }}>
                        <input type="radio" name="mode" checked={activeMode?.id === m.id} onChange={() => setModeId(m.id)} />
                        <span style={{ fontSize: 13, color: 'var(--text-strong)' }}>{m.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {shownModes.map((m) => (
                <div key={m.id} style={{ marginTop: 6 }}>
                  {!allToken && tpl.authModes.length > 1 && (
                    <div style={{ ...label, marginBottom: 0 }}>{m.label} {!required(m.id) && <span style={{ ...hint, fontWeight: 400 }}>(opcional)</span>}</div>
                  )}
                  {m.fields.filter((f) => !f.hidden).map((f) => (
                    <div key={f.key}>
                      <label htmlFor={`${m.id}-${f.key}`} style={label}>{f.label}</label>
                      <Input
                        id={`${m.id}-${f.key}`} autoComplete="off" type={SECRET.test(f.key) ? 'password' : 'text'} style={mono}
                        value={creds[m.id]?.[f.key] ?? ''}
                        onChange={(e) => setCreds((c) => ({ ...c, [m.id]: { ...c[m.id], [f.key]: e.target.value } }))}
                      />
                      {tpl.credentialHints[f.key] && <p style={hint}>{tpl.credentialHints[f.key]}</p>}
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Button type="button" onClick={saveAndTest} disabled={isPending} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {isPending ? <><Loader2 size={14} className="spin" /> Testando…</> : installed ? 'Salvar e testar de novo' : 'Salvar e testar conexão'}
                </Button>
                {conn && (
                  <span role="status" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, color: conn.ok ? 'var(--status-success)' : 'var(--status-error)' }}>
                    {conn.ok ? <Check size={14} /> : <CircleAlert size={14} />} {conn.msg}
                  </span>
                )}
              </div>
            </>
          )}

          {step === 2 && tpl && (
            <>
              <p style={text}>Digite o CPF ou CNPJ de um cliente da {coName}. Eu chamo &quot;Cliente por CPF/CNPJ&quot; e já preencho os dados dele para os próximos testes.</p>
              <label htmlFor="cpf" style={label}>CPF ou CNPJ</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input id="cpf" autoFocus value={cpf} onChange={(e) => setCpf(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && cpf.trim() && firstCall()} placeholder="000.000.000-00" style={mono} />
                <Button type="button" onClick={firstCall} disabled={isPending || !cpf.trim()} style={{ whiteSpace: 'nowrap' }}>
                  {isPending ? 'Buscando…' : 'Buscar'}
                </Button>
              </div>

              {first && (
                <div className="g-box" style={{ marginTop: 14 }}>
                  <div className="g-box-header" style={{ color: ok2xx ? 'var(--status-success)' : 'var(--status-error)' }}>
                    {ok2xx
                      ? <><PartyPopper size={15} /> Primeira chamada funcionou em {fmt(elapsed)}</>
                      : <><CircleAlert size={15} /> {bodyError(parse(first.r.responseBody)) && first.r.statusCode < 300
                          ? `A conexão funciona, mas o ${tpl.name} respondeu: "${bodyError(parse(first.r.responseBody))!.replace(/\.$/, '')}". Tente o documento de um cliente que exista.`
                          : explain(first.r, tpl)}</>}
                    <span className="g-counter" style={{ marginLeft: 'auto' }}>{first.r.statusCode} · {first.r.durationMs} ms</span>
                  </div>
                  {first.found.map((f) => (
                    <div key={f.field} className="g-box-row" style={{ gap: 12 }}>
                      <span style={{ width: 160, fontSize: 12, color: 'var(--text-muted)' }}>{f.label}</span>
                      <span style={{ ...mono, color: 'var(--text-strong)' }}>{f.value}</span>
                    </div>
                  ))}
                  {ok2xx && first.found.length === 0 && <div className="g-box-row" style={hint}>A chamada funcionou, mas não achei um cliente com esse documento. Tente outro.</div>}
                  <details style={{ padding: '8px 14px' }}>
                    <summary style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>Ver resposta completa</summary>
                    <pre style={{ ...mono, fontSize: 11, maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{first.r.responseBody?.slice(0, 4000)}</pre>
                  </details>
                </div>
              )}
            </>
          )}

          {step === 3 && tpl && (
            <>
              <p style={{ ...text, color: 'var(--text-strong)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PartyPopper size={18} style={{ color: 'var(--accent)' }} /> Pronto: {tpl.name}, {coName} e o primeiro cliente de teste estão cadastrados.
              </p>
              <div className="g-box" style={{ marginTop: 12 }}>
                <div className="g-box-row" style={hint}>Os {tpl.endpoints.length} endpoints do {tpl.name} já funcionam com a {coName}: escolha um em Testar API.</div>
                <div className="g-box-row" style={hint}>Outras empresas desse ERP: Empresas → Nova Empresa. Outros ERPs: página ERPs.</div>
                <div className="g-box-row" style={hint}>No Início fica uma lista de primeiros passos (convidar o time, salvar um registro, criar um fluxo).</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <Link href={testUrl} className="btn-default btn-md" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Abrir no Testar API <ArrowRight size={14} /></Link>
                <Link href={`/erps/${installed?.erpId}`} className="btn-ghost btn-md" style={{ textDecoration: 'none' }}>Ver o ERP</Link>
                <Link href="/" className="btn-ghost btn-md" style={{ textDecoration: 'none' }}>Ir para o Início</Link>
              </div>
            </>
          )}

          {error && <p role="alert" style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--status-error)' }}>{error}</p>}

          {step < 3 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 8 }}>
              {step > 0 && !(step === 1 && installed)
                ? <Button type="button" variant="ghost" onClick={() => { setError(''); setStep((step - 1) as Step) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> Voltar</Button>
                : step === 2 ? <Button type="button" variant="ghost" onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={14} /> Voltar</Button> : <span />}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {step === 1 && installed && !conn?.ok && <button type="button" onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--link)', fontSize: 13, cursor: 'pointer' }}>Continuar mesmo assim</button>}
                {step === 2 && <button type="button" onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: 'var(--link)', fontSize: 13, cursor: 'pointer' }}>Pular</button>}
                {step === 0 && <Button type="button" disabled={!tpl} onClick={() => setStep(1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Continuar <ArrowRight size={14} /></Button>}
                {step === 1 && <Button type="button" disabled={!conn?.ok} onClick={() => setStep(2)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Continuar <ArrowRight size={14} /></Button>}
                {step === 2 && <Button type="button" disabled={!ok2xx || isPending} onClick={saveClient} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Salvar cliente e concluir <ArrowRight size={14} /></Button>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
