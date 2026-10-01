'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Play } from 'lucide-react'
import { MethodBadge } from '@/components/ui/badge'
import { runPlaybook } from '@/lib/actions/playbooks'

type Company = { id: number; name: string; testClients: Array<{ id: number; name: string }> }
type PlaybookStep = { id: number; order: number; stepName: string; endpoint: { id: number; name: string; method: string } }
type Playbook = { id: number; name: string; steps: PlaybookStep[] }

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
  color: 'var(--text)', outline: 'none', width: '100%',
}

export function RunClient({ playbook, companies }: { playbook: Playbook; companies: Company[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? 0)
  const [clientId, setClientId] = useState<number | ''>('')

  const selectedCompany = companies.find((c) => c.id === companyId)

  const handleRun = () => {
    startTransition(async () => {
      const result = await runPlaybook(playbook.id, companyId, clientId === '' ? null : clientId)
      router.push(`/playbooks/runs/${result.runId}`)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--surface)' }}>
        <Link href="/playbooks" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={16} />
        </Link>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{playbook.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>{playbook.steps.length} step{playbook.steps.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Steps preview */}
          {playbook.steps.length > 0 && (
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {playbook.steps.map((step, i) => (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < playbook.steps.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', minWidth: 20, textAlign: 'right' }}>{i + 1}</span>
                  <MethodBadge method={step.endpoint.method} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{step.stepName || step.endpoint.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Empresa</label>
              <select style={selectStyle} value={companyId} onChange={(e) => { setCompanyId(Number(e.target.value)); setClientId('') }}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Cliente de Teste <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>(opcional)</span>
              </label>
              <select style={selectStyle} value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">— Sem cliente —</option>
                {selectedCompany?.testClients.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </select>
            </div>

            <button
              onClick={handleRun}
              disabled={isPending || !companyId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: 'none', backgroundColor: companyId ? 'var(--accent)' : 'var(--surface-2)', color: companyId ? 'white' : 'var(--text-subtle)', cursor: companyId ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 500, transition: 'background-color 0.15s' }}
            >
              <Play size={14} />
              {isPending ? 'Executando…' : 'Executar Playbook'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
