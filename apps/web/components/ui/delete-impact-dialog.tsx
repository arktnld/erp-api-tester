'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from './button'

export type ImpactItem = { label: string; detail?: string }
export type Impact = { items: ImpactItem[]; kept?: string }

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Confirmation that lists everything a delete takes with it (and what stays) before running it.
 * `load` fetches the impact when the dialog opens; `confirm` does the delete, all or nothing.
 */
export function DeleteImpactDialog({ title, load, confirm, onClose }: {
  title: string
  load: () => Promise<Impact>
  confirm: () => Promise<void>
  onClose: () => void
}) {
  const [impact, setImpact] = useState<Impact | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per open
  useEffect(() => { load().then(setImpact).catch(() => setError('Não consegui ver o que será excluído.')) }, [])

  const run = () => startTransition(async () => {
    try { await confirm(); onClose() } catch { setError('A exclusão falhou; nada foi apagado.') }
  })

  const row: React.CSSProperties = { padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }
  const sub: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div className="g-box" onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,.35)' }}>
        <div id="del-title" className="g-box-header">{title}</div>
        <div style={{ padding: 16, overflow: 'auto' }}>
          {!impact && !error && <p style={sub}>Verificando o que está ligado…</p>}
          {impact && (
            <>
              <p style={{ fontSize: 13, margin: '0 0 8px', color: 'var(--text-strong)' }}>Vai ser excluído junto, sem volta:</p>
              {impact.items.map((it) => (
                <div key={it.label} style={row}>
                  {it.label}
                  {it.detail && <div style={sub}>{it.detail}</div>}
                </div>
              ))}
              {impact.kept && <p style={{ ...sub, marginTop: 10 }}>{impact.kept}</p>}
            </>
          )}
          {error && <p role="alert" style={{ fontSize: 13, color: 'var(--status-error)', margin: '8px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="danger" size="sm" disabled={!impact || isPending} onClick={run}>
              {isPending ? 'Excluindo…' : 'Excluir tudo'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
