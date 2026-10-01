'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2, GripVertical } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createPlaybook, updatePlaybook, upsertPlaybookSteps } from '@/lib/actions/playbooks'
import { formLabel as labelStyle, selectStyle } from '@/lib/styles'
import { useRole } from '@/lib/role-context'

const CodeEditor = dynamic(() => import('@/components/ui/code-editor').then(m => ({ default: m.CodeEditor })), { ssr: false })

type Endpoint = { id: number; name: string; method: string }
type ERP = { id: number; name: string; endpoints: Endpoint[] }
type StepForm = { id?: number; order: number; endpointId: number; stepName: string; bodyOverride: string; responseCapture: string; assertions: string }

type Props = {
  erps: ERP[]
  playbook?: {
    id: number
    erpId: number
    name: string
    description: string
    steps: Array<{ id: number; order: number; endpointId: number; stepName: string; bodyOverride: string; responseCapture: string; assertions: string; endpoint: { id: number; name: string; method: string } }>
  }
}

/** Parse responseCapture JSON and return field names */
function parseCaptureFields(responseCapture: string): string[] {
  try {
    const obj = JSON.parse(responseCapture)
    if (obj && typeof obj === 'object') return Object.keys(obj)
  } catch { /* ignore */ }
  return []
}

/** Collect all vars captured by steps before index i */
function availableVars(steps: StepForm[], beforeIndex: number): Array<{ field: string; stepNum: number }> {
  const result: Array<{ field: string; stepNum: number }> = []
  for (let i = 0; i < beforeIndex; i++) {
    for (const field of parseCaptureFields(steps[i].responseCapture)) {
      result.push({ field, stepNum: i + 1 })
    }
  }
  return result
}

export function PlaybookEditClient({ erps, playbook }: Props) {
  const { canEdit } = useRole()
  const router = useRouter()
  const [, startTransition] = useTransition()

  if (!canEdit) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Sem permissão para editar playbooks.
      </div>
    )
  }

  const [name, setName] = useState(playbook?.name ?? '')
  const [erpId, setErpId] = useState(playbook?.erpId ?? erps[0]?.id ?? 0)
  const [description, setDescription] = useState(playbook?.description ?? '')
  const [steps, setSteps] = useState<StepForm[]>(
    playbook?.steps.map((s) => ({ id: s.id, order: s.order, endpointId: s.endpointId, stepName: s.stepName, bodyOverride: s.bodyOverride, responseCapture: s.responseCapture, assertions: s.assertions })) ?? []
  )

  const selectedErp = erps.find((e) => e.id === erpId)

  const addStep = () => {
    const firstEndpoint = selectedErp?.endpoints[0]
    if (!firstEndpoint) return
    setSteps([...steps, { order: steps.length, endpointId: firstEndpoint.id, stepName: '', bodyOverride: '', responseCapture: '', assertions: '' }])
  }

  const updateStep = (i: number, field: keyof StepForm, value: string | number) => {
    const next = [...steps]
    next[i] = { ...next[i], [field]: value }
    setSteps(next)
  }

  const removeStep = (i: number) => setSteps(steps.filter((_, idx) => idx !== i))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      let id = playbook?.id
      if (id) {
        await updatePlaybook(id, { name, erpId, description })
      } else {
        const result = await createPlaybook({ name, erpId, description })
        id = result.id
      }
      await upsertPlaybookSteps(id!, steps.map((s, i) => ({ ...s, order: i })))
      router.push('/playbooks')
    })
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', backgroundColor: 'var(--surface-2)',
    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)',
    fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720, margin: '0 auto' }}>
      <Link href="/playbooks" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ChevronLeft size={14} /> Fluxos
      </Link>

      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 28 }}>{playbook ? 'Editar Playbook' : 'Novo Playbook'}</h1>

      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>Nome</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Login + Consulta" required />

        <label style={labelStyle}>ERP</label>
        <select style={selectStyle} value={erpId} onChange={(e) => setErpId(Number(e.target.value))}>
          {erps.map((erp) => <option key={erp.id} value={erp.id}>{erp.name}</option>)}
        </select>

        <label style={labelStyle}>Descrição <span style={{ color: 'var(--text-subtle)' }}>(opcional)</span></label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Autentica e consulta o cliente..." rows={2} style={textareaStyle} />

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Steps ({steps.length})</p>
            <Button type="button" variant="ghost" onClick={addStep} disabled={!selectedErp?.endpoints.length}>
              <Plus size={13} /> Adicionar Step
            </Button>
          </div>

          {steps.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, backgroundColor: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              Nenhum step. Clique em &quot;Adicionar Step&quot; para começar.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((step, i) => {
              const vars = availableVars(steps, i)
              const captureFields = parseCaptureFields(step.responseCapture)

              return (
                <div key={i} style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <GripVertical size={14} color="var(--text-subtle)" />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>STEP {i + 1}</span>
                    <div style={{ flex: 1 }} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(i)}><Trash2 size={12} /></Button>
                  </div>

                  <label style={labelStyle}>Endpoint</label>
                  <select style={selectStyle} value={step.endpointId} onChange={(e) => updateStep(i, 'endpointId', Number(e.target.value))}>
                    {selectedErp?.endpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>{ep.method} {ep.name}</option>
                    ))}
                  </select>

                  <label style={labelStyle}>Nome do step <span style={{ color: 'var(--text-subtle)' }}>(opcional)</span></label>
                  <Input value={step.stepName} onChange={(e) => updateStep(i, 'stepName', e.target.value)} placeholder="Autenticação" />

                  {/* Body override com CodeEditor */}
                  <label style={labelStyle}>Body override <span style={{ color: 'var(--text-subtle)' }}>(JSON, opcional)</span></label>

                  {/* Chips de variáveis disponíveis de steps anteriores */}
                  {vars.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Disponíveis:</span>
                      {vars.map(({ field, stepNum }) => (
                        <button
                          key={field}
                          type="button"
                          title={`Capturado no Step ${stepNum} — clique para copiar`}
                          onClick={() => navigator.clipboard?.writeText(`{${field}}`)}
                          style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 7px', background: 'color-mix(in srgb, var(--status-warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--status-warning) 30%, transparent)', color: 'var(--status-warning)', borderRadius: 4, cursor: 'pointer' }}
                        >
                          {'{'}{ field }{'}'} · Step {stepNum}
                        </button>
                      ))}
                    </div>
                  )}

                  <CodeEditor
                    value={step.bodyOverride}
                    onChange={(v) => updateStep(i, 'bodyOverride', v)}
                    language="json"
                    minHeight={100}
                  />

                  {/* Response capture com CodeEditor */}
                  <label style={{ ...labelStyle, marginTop: 14 }}>
                    Response capture <span style={{ color: 'var(--text-subtle)' }}>{'{"campo": "path.da.resposta"}'}</span>
                  </label>
                  <CodeEditor
                    value={step.responseCapture}
                    onChange={(v) => updateStep(i, 'responseCapture', v)}
                    language="json"
                    minHeight={80}
                  />

                  <label style={{ ...labelStyle, marginTop: 14 }}>
                    Asserções <span style={{ color: 'var(--text-subtle)' }}>uma por linha — ex.: status eq 200 · body.data.status neq "erro" · body.total gt 0</span>
                  </label>
                  <CodeEditor
                    value={step.assertions}
                    onChange={(v) => updateStep(i, 'assertions', v)}
                    language="text"
                    minHeight={60}
                  />

                  {/* Preview das variáveis que este step vai capturar */}
                  {captureFields.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Captura:</span>
                      {captureFields.map((field) => (
                        <span key={field} style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 7px', background: 'color-mix(in srgb, var(--status-success) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--status-success) 30%, transparent)', color: 'var(--status-success)', borderRadius: 4 }}>
                          {'{'}{ field }{'}'}
                        </span>
                      ))}
                      <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>disponíveis para os próximos steps</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'var(--background)',
          borderTop: '1px solid var(--border)',
          padding: '16px 0',
          marginTop: 24,
        }}>
          <Button type="submit" style={{ width: '100%' }}>
            {playbook ? 'Salvar Playbook' : 'Criar Playbook'}
          </Button>
        </div>
      </form>
    </div>
  )
}
