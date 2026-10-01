'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Clock, Building2, Server, Copy, Check } from 'lucide-react'
import { MethodBadge, StatusBadge } from '@/components/ui/badge'
import dynamic from 'next/dynamic'

const CodeBlock = dynamic(() => import('@/components/ui/code-block').then(m => ({ default: m.CodeBlock })), { ssr: false })

export type StepResult = {
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
  assertions?: { line: string; ok: boolean; actual?: string; error?: string }[]
}

type RunMeta = {
  status: string
  id: number
  startedAt: Date | string
  endedAt: Date | string | null
  playbook: { name: string; erp: { name: string } }
  company: { name: string }
}

function buildCurl(method: string, url: string, headers: Record<string, string>, body: string | null | undefined): string {
  const lines: string[] = [`curl -X ${method} '${url}'`]
  for (const [k, v] of Object.entries(headers ?? {})) {
    lines.push(`  -H '${k}: ${v}'`)
  }
  if (body) {
    try {
      lines.push(`  -d '${JSON.stringify(JSON.parse(body), null, 2)}'`)
    } catch {
      lines.push(`  -d '${body}'`)
    }
  }
  return lines.join(' \\\n')
}

function tryPretty(s: string) {
  try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function InnerTabs({ tabs, children }: { tabs: string[]; children: (active: number) => React.ReactNode }) {
  const [active, setActive] = useState(0)
  return (
    <div>
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', width: 'fit-content', marginBottom: 10 }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActive(i)} style={{ padding: '4px 12px', fontSize: 11, color: active === i ? 'var(--text)' : 'var(--text-muted)', background: active === i ? 'var(--surface-2)' : 'none', border: 'none', cursor: 'pointer', transition: 'all .15s' }}>
            {t}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  )
}

/** Card before step 1 showing test client fields */
function InitialCard({ fields, clientName, allSteps }: { fields: Record<string, string>; clientName: string; allSteps: StepResult[] }) {
  const entries = Object.entries(fields)
  if (entries.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', border: '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)', borderRadius: 8, padding: '10px 16px', background: 'color-mix(in srgb, var(--status-warning) 4%, transparent)', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'color-mix(in srgb, var(--status-warning) 20%, transparent)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-warning)', whiteSpace: 'nowrap' }}>
            Cliente teste · {clientName}
          </span>
          <div style={{ flex: 1, height: 1, background: 'color-mix(in srgb, var(--status-warning) 20%, transparent)' }} />
        </div>
        {entries.map(([field, val]) => (
          <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'color-mix(in srgb, var(--status-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)', color: 'var(--status-warning)', flexShrink: 0 }}>
              {field}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {val.length > 40 ? val.slice(0, 40) + '…' : val}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-subtle)', flexShrink: 0 }}>→ usado em</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--link)', flexShrink: 0 }}>Step 1</span>
          </div>
        ))}
      </div>
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
    </div>
  )
}

/** Card between steps showing what was captured and where it goes */
function FlowCard({ step, stepNum, allSteps, isLast }: { step: StepResult; stepNum: number; allSteps: StepResult[]; isLast?: boolean }) {
  const entries = Object.entries(step.capturedFields)
  if (entries.length === 0) {
    if (isLast) return null
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      </div>
    )
  }

  const borderColor = isLast ? 'color-mix(in srgb, var(--status-success) 40%, transparent)' : 'var(--border)'
  const bgColor = isLast ? 'color-mix(in srgb, var(--status-success) 6%, transparent)' : 'var(--surface-2)'
  const titleColor = isLast ? 'var(--status-success)' : 'var(--text-subtle)'
  const dividerColor = isLast ? 'color-mix(in srgb, var(--status-success) 20%, transparent)' : 'var(--border)'
  const label = isLast ? `Resultado final · Step ${stepNum}` : `Dados capturados · Step ${stepNum}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
      <div style={{ width: '100%', border: `1px solid ${borderColor}`, borderRadius: 8, padding: '10px 16px', background: bgColor, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: dividerColor }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: titleColor, whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <div style={{ flex: 1, height: 1, background: dividerColor }} />
        </div>

        {/* Rows */}
        {entries.map(([field, val]) => {
          const usedInSteps: number[] = []
          if (!isLast) {
            for (let j = stepNum; j < allSteps.length; j++) {
              const next = allSteps[j]
              const haystack = (next.requestBody ?? '') + (next.url ?? '')
              if (val && haystack.includes(val)) usedInSteps.push(j + 1)
            }
          }
          return (
            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'color-mix(in srgb, var(--status-success) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--status-success) 30%, transparent)', color: 'var(--status-success)', flexShrink: 0 }}>
                {field}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                {val.length > 40 ? val.slice(0, 40) + '…' : val}
              </span>
              {!isLast && usedInSteps.length > 0 && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)', flexShrink: 0 }}>→ usado em</span>
                  {usedInSteps.map((n) => (
                    <span key={n} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', color: 'var(--link)', flexShrink: 0 }}>
                      Step {n}
                    </span>
                  ))}
                </>
              )}
              {!isLast && usedInSteps.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontStyle: 'italic' }}>→ não utilizado</span>
              )}
            </div>
          )
        })}
      </div>
      {!isLast && <div style={{ width: 1, height: 20, background: 'var(--border)' }} />}
    </div>
  )
}

function StepCard({ step, index }: { step: StepResult; index: number }) {
  const curl = buildCurl(step.method, step.url, step.requestHeaders ?? {}, step.requestBody)

  return (
    <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', backgroundColor: step.status === 'ok' ? 'color-mix(in srgb, var(--status-success) 4%, transparent)' : 'color-mix(in srgb, var(--status-error) 4%, transparent)' }}>
        {step.status === 'ok'
          ? <CheckCircle2 size={15} style={{ color: 'var(--status-success)' }} />
          : <XCircle size={15} style={{ color: 'var(--status-error)' }} />}
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 500, fontSize: 13 }}>{step.stepName || `Step ${index + 1}`}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>{step.endpointName}</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{step.durationMs}ms</span>
      </div>

      {/* URL bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
        {step.method && <MethodBadge method={step.method} />}
        {step.statusCode > 0 && <StatusBadge code={step.statusCode} />}
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {step.url || '—'}
        </span>
      </div>

      {step.assertions && step.assertions.length > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {step.assertions.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, fontFamily: 'monospace' }}>
              {a.ok ? <CheckCircle2 size={12} style={{ color: 'var(--status-success)' }} /> : <XCircle size={12} style={{ color: 'var(--status-error)' }} />}
              <span>{a.line}</span>
              {!a.ok && <span style={{ color: 'var(--text-muted)' }}>{a.error ?? `recebido: ${a.actual}`}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: 16 }}>
        <InnerTabs tabs={['Request', 'Resposta', 'cURL']}>
          {(active) => (
            <>
              {active === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.keys(step.requestHeaders ?? {}).length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Headers</p>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {Object.entries(step.requestHeaders ?? {}).map(([k, v]) => (
                            <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '5px 0', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', width: '40%', paddingRight: 12 }}>{k}</td>
                              <td style={{ padding: '5px 0', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {step.requestBody ? (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Body</p>
                      <CodeBlock language="json" customStyle={{ margin: 0, borderRadius: 8, fontSize: 11, backgroundColor: 'var(--surface-2)' }}>
                        {tryPretty(step.requestBody)}
                      </CodeBlock>
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-subtle)' }}>Sem body.</p>
                  )}
                </div>
              )}
              {active === 1 && (
                <CodeBlock language="json" customStyle={{ margin: 0, borderRadius: 8, fontSize: 11, backgroundColor: 'var(--surface-2)', maxHeight: 300, overflow: 'auto' }}>
                  {tryPretty(step.responseBody)}
                </CodeBlock>
              )}
              {active === 2 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <CopyButton text={curl} />
                  </div>
                  <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.7, margin: 0 }}>
                    {curl}
                  </pre>
                </div>
              )}
            </>
          )}
        </InnerTabs>
      </div>
    </div>
  )
}


export function RunResultClient({ run, clientFields, clientName }: { run: RunMeta & { steps: StepResult[] }; clientFields?: Record<string, string>; clientName?: string }) {
  const allOk = run.status === 'completed'
  const totalMs = run.endedAt
    ? new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime()
    : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>{run.playbook.name}</h1>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
          backgroundColor: allOk ? 'color-mix(in srgb, var(--status-success) 9%, transparent)' : 'color-mix(in srgb, var(--status-error) 9%, transparent)',
          color: allOk ? 'var(--status-success)' : 'var(--status-error)',
          border: `1px solid ${allOk ? 'color-mix(in srgb, var(--status-success) 27%, transparent)' : 'color-mix(in srgb, var(--status-error) 27%, transparent)'}`,
        }}>
          {allOk ? '✓ Concluído' : '✗ Falhou'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, fontSize: 13, color: 'var(--text-muted)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Server size={13} /> {run.playbook.erp.name}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Building2 size={13} /> {run.company.name}</span>
        {totalMs !== null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Clock size={13} /> {totalMs}ms total</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {clientFields && clientName && Object.keys(clientFields).length > 0 && (
          <InitialCard fields={clientFields} clientName={clientName} allSteps={run.steps} />
        )}
        {run.steps.map((step, i) => {
          const isLast = i === run.steps.length - 1
          return (
            <div key={step.stepId}>
              <StepCard step={step} index={i} />
              <FlowCard step={step} stepNum={i + 1} allSteps={run.steps} isLast={isLast} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
