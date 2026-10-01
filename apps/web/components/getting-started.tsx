'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'

export type StartStep = { label: string; done: boolean; href: string; action: string }

const KEY = 'getting-started-dismissed'

/** "Primeiros passos" card on the home page: progress over the first-week tasks, until done or dismissed. */
export function GettingStarted({ steps }: { steps: StartStep[] }) {
  const [hidden, setHidden] = useState(true)
  useEffect(() => { try { setHidden(localStorage.getItem(KEY) === '1') } catch { setHidden(false) } }, [])
  const done = steps.filter((s) => s.done).length
  if (hidden || done === steps.length) return null

  const dismiss = () => { try { localStorage.setItem(KEY, '1') } catch { /* private mode */ } setHidden(true) }
  const next = steps.find((s) => !s.done)

  return (
    <section className="g-box" aria-labelledby="gs-title" style={{ marginBottom: 20 }}>
      <div className="g-box-header" style={{ justifyContent: 'space-between' }}>
        <span id="gs-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Primeiros passos <span className="g-counter">{done}/{steps.length}</span>
        </span>
        <button type="button" onClick={dismiss} aria-label="Esconder primeiros passos" title="Esconder" style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', display: 'flex' }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ height: 3, background: 'var(--surface-3)' }}>
        <div style={{ height: 3, width: `${(done / steps.length) * 100}%`, background: 'var(--accent)', transition: 'width .3s' }} />
      </div>
      {steps.map((s) => (
        <div key={s.label} className="g-box-row" style={{ gap: 10 }}>
          <span aria-hidden style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${s.done ? 'var(--status-success)' : 'var(--border-2)'}`, background: s.done ? 'color-mix(in srgb, var(--status-success) 15%, transparent)' : 'transparent',
          }}>
            {s.done && <Check size={11} style={{ color: 'var(--status-success)' }} />}
          </span>
          <span style={{ flex: 1, fontSize: 13, color: s.done ? 'var(--text-muted)' : 'var(--text-strong)', textDecoration: s.done ? 'line-through' : 'none' }}>
            {s.label}
          </span>
          {!s.done && (
            <Link href={s.href} className={s === next ? 'btn-default btn-sm' : 'btn-ghost btn-sm'} style={{ textDecoration: 'none' }}>{s.action}</Link>
          )}
        </div>
      ))}
    </section>
  )
}
