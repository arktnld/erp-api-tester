'use client'

import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useRole } from '@/lib/role-context'
import { ROLES, getRoleLabel, type Role } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { NewPassword, UsersSection, type UserRow } from './users-section'
import { createUser, listUsers } from './actions'

const inputStyle: React.CSSProperties = {
  height: 32, padding: '0 10px', fontSize: 13, border: '1px solid var(--input-border)', borderRadius: 'var(--radius)',
  backgroundColor: 'var(--input-bg)', color: 'var(--text)', minWidth: 0,
}

function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('viewer')
  const [error, setError] = useState('')
  const [password, setPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setPassword(null)
    try {
      const res = await createUser({ email, name, role })
      if ('error' in res) { setError(res.error); return }
      setPassword(res.password ?? '')
      setEmail(''); setName(''); setRole('viewer')
      onCreated()
    } catch (err) { setError(String(err)) } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 14, borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        Uma senha aleatória é gerada; passe-a para a pessoa trocar em Configurações.
      </div>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input aria-label="E-mail" type="email" required placeholder="email@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, flex: '2 1 200px' }} />
        <input aria-label="Nome" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, flex: '1 1 140px' }} />
        <select aria-label="Papel" value={role} onChange={(e) => setRole(e.target.value as Role)} style={inputStyle}>
          {ROLES.map((r) => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
        </select>
        <Button type="submit" size="sm" disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <UserPlus size={14} /> {loading ? 'Criando…' : 'Criar usuário'}
        </Button>
      </form>
      {error && <div style={{ fontSize: 12, color: 'var(--status-error)', marginTop: 8 }}>{error}</div>}
      {password && <div style={{ marginTop: 12 }}><NewPassword password={password} /></div>}
    </div>
  )
}

export function AdminSections({ currentUserId }: { currentUserId: number }) {
  const { canAdmin } = useRole()
  const [users, setUsers] = useState<UserRow[]>([])
  const [adding, setAdding] = useState(false)

  const load = () => { listUsers().then(setUsers).catch(() => {}) }
  useEffect(() => { if (canAdmin) load() }, [canAdmin])

  if (!canAdmin) return null

  return (
    <section className="g-box" aria-labelledby="s-usuarios">
      <div className="g-box-header" style={{ justifyContent: 'space-between', padding: '6px 6px 6px 14px' }}>
        <span id="s-usuarios" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Usuários <span className="g-counter">{users.length}</span>
        </span>
        <Button size="sm" variant={adding ? 'ghost' : 'default'} onClick={() => setAdding((v) => !v)} aria-expanded={adding}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {adding ? 'Fechar' : <><UserPlus size={14} /> Novo usuário</>}
        </Button>
      </div>
      {adding && <NewUserForm onCreated={load} />}
      <UsersSection users={users} currentUserId={currentUserId} />
    </section>
  )
}
