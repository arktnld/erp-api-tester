'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { changeOwnPassword } from './actions'

// UX hint only; the server action enforces MIN_PASSWORD_LENGTH (lib/password.ts, not importable here: node:crypto).
const MIN_PASSWORD_LENGTH = 8

const inputStyle: React.CSSProperties = {
  height: 32, padding: '0 10px', fontSize: 13, border: '1px solid var(--input-border)', borderRadius: 'var(--radius)',
  backgroundColor: 'var(--input-bg)', color: 'var(--text)', width: '100%',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }

export function AccountSection({ email }: { email: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) { setMsg({ ok: false, text: 'A confirmação não bate com a senha nova' }); return }
    setLoading(true); setMsg(null)
    try {
      const res = await changeOwnPassword({ current, next })
      if ('error' in res) { setMsg({ ok: false, text: res.error }); return }
      setCurrent(''); setNext(''); setConfirm('')
      setMsg({ ok: true, text: 'Senha trocada.' })
    } catch (err) { setMsg({ ok: false, text: String(err) }) } finally { setLoading(false) }
  }

  return (
    <form onSubmit={submit} style={{ padding: '14px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>Trocar senha</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 12 }}>As outras sessões abertas com a sua conta são encerradas.</div>
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
        <div>
          <label htmlFor="pw-current" style={labelStyle}>Senha atual</label>
          <input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="pw-next" style={labelStyle}>Senha nova</label>
          <input id="pw-next" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`} value={next} onChange={(e) => setNext(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label htmlFor="pw-confirm" style={labelStyle}>Confirmar senha nova</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button type="submit" size="sm" disabled={loading}>{loading ? 'Salvando…' : 'Trocar senha'}</Button>
        {msg && <span role="status" style={{ fontSize: 12, color: msg.ok ? 'var(--status-success)' : 'var(--status-error)' }}>{msg.text}</span>}
      </div>
    </form>
  )
}
