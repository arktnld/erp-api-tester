'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Play, Pencil, Share2, Check, Copy } from 'lucide-react'
import { runPlaybook, getPlaybookRun } from '@/lib/actions/playbooks'
import { useRole } from '@/lib/role-context'

// ── Types ────────────────────────────────────────────────────────────────────

type StepResult = {
  stepId: number
  stepName: string
  endpointName: string
  status: 'ok' | 'error'
  statusCode: number
  method: string
  url: string
  responseBody: string
  capturedFields: Record<string, string>
  injectedFields?: Record<string, string>
  requestBody?: string | null
  requestHeaders?: Record<string, string>
  durationMs: number
}

type Step = { id: number; order: number; stepName: string; endpoint: { id: number; name: string; method: string } }
type Company = { id: number; name: string; testClients: Array<{ id: number; name: string }> }
type Playbook = { id: number; name: string; description: string; erp: { name: string }; steps: Step[] }
type LastRun = { id: number; status: string; startedAt: Date | string; endedAt: Date | string | null; companyId: number; clientId: number | null; steps: unknown; company: { name: string } } | null

// ── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--status-success)', POST: 'var(--method-post)', PUT: 'var(--status-warning)', PATCH: 'var(--method-patch)', DELETE: 'var(--status-error)',
}

function MethodTag({ method }: { method: string }) {
  const color = METHOD_COLORS[method] ?? 'var(--text-muted)'
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, padding: '2px 5px', borderRadius: 3, flexShrink: 0 }}>
      {method}
    </span>
  )
}

function tryPretty(s: string) {
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}

function buildCurl(method: string, url: string, headers: Record<string, string>, body: string | null | undefined): string {
  const lines = [`curl -X ${method} '${url}'`]
  for (const [k, v] of Object.entries(headers ?? {})) lines.push(`  -H '${k}: ${v}'`)
  if (body) { try { lines.push(`  -d '${JSON.stringify(JSON.parse(body), null, 2)}'`) } catch { lines.push(`  -d '${body}'`) } }
  return lines.join(' \\\n')
}

// ── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, index, result }: { step: Step; index: number; result?: StepResult }) {
  const [tab, setTab] = useState<'response' | 'request' | 'curl'>('response')
  const [curlCopied, setCurlCopied] = useState(false)

  const methodColor = METHOD_COLORS[step.endpoint.method] ?? 'var(--border)'
  const statusColor = !result ? 'var(--text-subtle)' : result.status === 'ok' ? 'var(--status-success)' : 'var(--status-error)'
  const stripeColor = !result ? methodColor : result.status === 'ok' ? 'var(--status-success)' : 'var(--status-error)'

  const curl = result ? buildCurl(result.method, result.url, result.requestHeaders ?? {}, result.requestBody) : null

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 11, fontWeight: active ? 500 : 400,
    color: active ? 'var(--text)' : 'var(--text-muted)',
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
    cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {/* Number */}
      <div style={{ paddingTop: 14, flexShrink: 0, width: 32, textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: statusColor, fontVariantNumeric: 'tabular-nums', transition: 'color 0.2s' }}>
          #{index + 1}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
        {/* Left stripe */}
        <div style={{ width: 3, backgroundColor: stripeColor, flexShrink: 0, transition: 'background 0.2s' }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: result ? '1px solid var(--border)' : 'none' }}>
            <MethodTag method={step.endpoint.method} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>
              {step.stepName || step.endpoint.name}
            </span>
            {step.stepName && (
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {step.endpoint.name}
              </span>
            )}
            {result && (
              <>
                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`, padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                  {result.statusCode || '—'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', flexShrink: 0 }}>{result.durationMs}ms</span>
              </>
            )}
          </div>

          {/* URL */}
          {result && (
            <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>{result.url}</span>
            </div>
          )}

          {/* Tabs + Content */}
          {result && (
            <>
              <div style={{ display: 'flex', gap: 0, padding: '0 8px', borderBottom: '1px solid var(--border)' }}>
                {(['response', 'request', 'curl'] as const).map((t) => (
                  <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
                    {t === 'response' ? 'Resposta' : t === 'request' ? 'Request' : 'cURL'}
                  </button>
                ))}
              </div>

              <div style={{ padding: '10px 14px' }}>
                {tab === 'response' && (
                  <pre style={{ margin: 0, fontSize: 11, backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', maxHeight: 300, overflowY: 'auto', fontFamily: 'monospace', lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {tryPretty(result.responseBody)}
                  </pre>
                )}
                {tab === 'request' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {Object.keys(result.requestHeaders ?? {}).length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <tbody>
                          {Object.entries(result.requestHeaders ?? {}).map(([k, v]) => (
                            <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '4px 0', fontFamily: 'monospace', color: 'var(--text-muted)', width: '35%', paddingRight: 12 }}>{k}</td>
                              <td style={{ padding: '4px 0', wordBreak: 'break-all' }}>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {result.requestBody ? (
                      <pre style={{ margin: 0, fontSize: 11, backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', fontFamily: 'monospace', lineHeight: 1.6, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                        {tryPretty(result.requestBody)}
                      </pre>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>Sem body.</span>
                    )}
                  </div>
                )}
                {tab === 'curl' && curl && (
                  <div style={{ position: 'relative' }}>
                    <pre style={{ margin: 0, fontSize: 11, backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', fontFamily: 'monospace', lineHeight: 1.6, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {curl}
                    </pre>
                    <button
                      onClick={() => { navigator.clipboard.writeText(curl); setCurlCopied(true); setTimeout(() => setCurlCopied(false), 1500) }}
                      style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: curlCopied ? 'var(--status-success)' : 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      {curlCopied ? <Check size={10} /> : <Copy size={10} />} {curlCopied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Company/Client Selector ───────────────────────────────────────────────────

function RunBar({ companies, onRun, running }: {
  companies: Company[]
  onRun: (companyId: number, clientId: number | null) => void
  running: boolean
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? 0)
  const [clientId, setClientId] = useState<number | null>(null)
  const selectedCompany = companies.find((c) => c.id === companyId)
  const selectedClient = selectedCompany?.testClients.find((c) => c.id === clientId)

  const selectStyle: React.CSSProperties = {
    padding: '5px 8px', fontSize: 12, borderRadius: 6,
    border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
    color: 'var(--text)', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', flexShrink: 0 }}>
      <select style={selectStyle} value={companyId} onChange={(e) => { setCompanyId(Number(e.target.value)); setClientId(null) }}>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <select style={selectStyle} value={clientId ?? ''} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}>
        <option value="">— Sem cliente —</option>
        {selectedCompany?.testClients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
      </select>

      <button
        onClick={() => onRun(companyId, clientId)}
        disabled={running || !companyId}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 6, border: 'none', backgroundColor: 'var(--accent)', color: 'white', cursor: running ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, opacity: running ? 0.7 : 1, flexShrink: 0 }}
      >
        <Play size={11} />
        {running ? 'Executando…' : 'Executar'}
      </button>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function PlaybookDetailClient({ playbook, companies, lastRun }: {
  playbook: Playbook
  companies: Company[]
  lastRun: LastRun
}) {
  const { canEdit } = useRole()
  const [results, setResults] = useState<StepResult[] | null>(lastRun ? (lastRun.steps as StepResult[]) : null)
  const [runStatus, setRunStatus] = useState<string | null>(lastRun?.status ?? null)
  const [runCompany, setRunCompany] = useState<string | null>(lastRun?.company.name ?? null)
  const [runId, setRunId] = useState<number | null>(lastRun?.id ?? null)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleRun = async (companyId: number, clientId: number | null) => {
    setRunning(true)
    setResults(null)
    setRunStatus('running')
    try {
      const { runId: newRunId } = await runPlaybook(playbook.id, companyId, clientId)
      const data = await getPlaybookRun(newRunId)
      setResults(data.steps as StepResult[])
      setRunStatus(data.status)
      setRunCompany(companies.find((c) => c.id === companyId)?.name ?? '')
      setRunId(newRunId)
    } catch (e) {
      setRunStatus('failed')
    } finally {
      setRunning(false)
    }
  }

  const handleShare = () => {
    const url = `${window.location.origin}/playbooks/${playbook.id}/view`
    navigator.clipboard?.writeText(url).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = url; ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allOk = results?.every((r) => r.status === 'ok')
  const statusColor = !results ? 'var(--text-subtle)' : allOk ? 'var(--status-success)' : 'var(--status-error)'

  const resultMap = new Map<number, StepResult>()
  results?.forEach((r) => resultMap.set(r.stepId, r))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--surface)' }}>
        <Link href="/playbooks" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={16} />
        </Link>

        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{playbook.name}</span>

        <span style={{ fontSize: 11, color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '3px 8px', borderRadius: 10, fontWeight: 500, flexShrink: 0 }}>
          {playbook.erp.name}
        </span>

        {results && (
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`, padding: '3px 8px', borderRadius: 10, flexShrink: 0 }}>
            {allOk ? '✓ Concluído' : '✗ Falhou'}
          </span>
        )}

        {canEdit && (
          <Link href={`/playbooks/${playbook.id}/edit`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>
            <Pencil size={13} /> Editar
          </Link>
        )}

        <button
          onClick={handleShare}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: copied ? 'var(--status-success)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
        >
          {copied ? <Check size={13} /> : <Share2 size={13} />}
          {copied ? 'Copiado!' : 'Compartilhar'}
        </button>
      </div>

      {/* Run bar */}
      {companies.length > 0 && (
        <RunBar companies={companies} onRun={handleRun} running={running} />
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {running && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Executando…
            </div>
          )}

          {!running && results && runCompany && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                Última execução · {runCompany}
              </span>
            </div>
          )}

          {playbook.steps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum step configurado.{' '}
              {canEdit && <Link href={`/playbooks/${playbook.id}/edit`} style={{ color: 'var(--accent)' }}>Editar playbook</Link>}
            </div>
          )}

          {playbook.steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              result={resultMap.get(step.id)}
            />
          ))}

        </div>
      </div>
    </div>
  )
}
