'use client'

import { useState } from 'react'
import { Pencil, KeyRound, Trash2 } from 'lucide-react'
import { getRoleLabel, type Role } from '@/lib/roles'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { RoleSelect } from './role-select'
import { updateUserName, resetUserPassword, deleteUser } from './actions'

export type UserRow = { id: number; name: string; email: string; role: Role }

type EditingState = { type: 'name'; userId: number; name: string }
  | { type: 'password'; userId: number; password: string | null }
  | { type: 'delete'; userId: number }
  | null

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6,
  backgroundColor: 'var(--surface-2)', color: 'var(--text)', outline: 'none', width: '100%',
}

export function UsersSection({ users: initialUsers, currentUserId }: { users: UserRow[]; currentUserId: number }) {
  const [users, setUsers] = useState(initialUsers)
  const [editing, setEditing] = useState<EditingState>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (initialUsers !== users && initialUsers.length !== users.length) {
    setUsers(initialUsers)
  }

  const openEditName = (u: UserRow) => {
    setEditing({ type: 'name', userId: u.id, name: u.name === 'Sem nome' ? '' : u.name })
    setError('')
  }

  const openChangePassword = (u: UserRow) => {
    setEditing({ type: 'password', userId: u.id, password: null })
    setError('')
  }

  const openDelete = (u: UserRow) => {
    setEditing({ type: 'delete', userId: u.id })
    setError('')
  }

  const close = () => { setEditing(null); setError('') }

  const handleSaveName = async () => {
    if (!editing || editing.type !== 'name') return
    setLoading(true); setError('')
    try {
      await updateUserName(editing.userId, editing.name)
      const newName = editing.name.trim() || 'Sem nome'
      setUsers(prev => prev.map(u => u.id === editing.userId ? { ...u, name: newName } : u))
      close()
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const handleSavePassword = async () => {
    if (!editing || editing.type !== 'password') return
    setLoading(true); setError('')
    try {
      const res = await resetUserPassword(editing.userId)
      if ('error' in res) setError(res.error)
      else setEditing({ ...editing, password: res.password ?? '' })
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!editing || editing.type !== 'delete') return
    setLoading(true); setError('')
    try {
      const res = await deleteUser(editing.userId)
      if ('error' in res) { setError(res.error); return }
      setUsers(prev => prev.filter(u => u.id !== editing.userId))
      close()
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }

  const editingUser = editing ? users.find(u => u.id === editing.userId) : null

  return (
    <>
      {users.map(user => {
        const isSelf = user.id === currentUserId
        return (
          <div key={user.id} className="g-box-row" style={{ gap: 12 }}>
            <Avatar name={user.name === 'Sem nome' ? user.email : user.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {user.name}
                {isSelf && <span className="g-counter">você</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
            {isSelf
              ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getRoleLabel(user.role)}</span>
              : <RoleSelect userId={user.id} currentRole={user.role} />}
            <div style={{ display: 'flex', gap: 2, width: 96, justifyContent: 'flex-end' }}>
              {!isSelf && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => openEditName(user)} title="Editar nome" aria-label={`Editar nome de ${user.email}`}>
                    <Pencil size={13} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openChangePassword(user)} title="Redefinir senha" aria-label={`Redefinir senha de ${user.email}`}>
                    <KeyRound size={13} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openDelete(user)} title="Remover usuário" aria-label={`Remover ${user.email}`}>
                    <Trash2 size={13} />
                  </Button>
                </>
              )}
            </div>
          </div>
        )
      })}

      {editing && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={close}
        >
          <div
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, width: 380, maxWidth: '90vw' }}
            onClick={e => e.stopPropagation()}
          >
            {editing.type === 'name' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Editar nome</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{editingUser?.email}</div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Nome</label>
                  <input style={inputStyle} value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()} autoFocus />
                </div>
                {error && <div style={{ fontSize: 12, color: 'var(--status-error)', marginBottom: 10 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onClick={close}>Cancelar</Button>
                  <Button size="sm" onClick={handleSaveName} disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</Button>
                </div>
              </>
            )}

            {editing.type === 'password' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Redefinir senha</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{editingUser?.email}</div>
                {editing.password === null ? (
                  <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                    Uma senha nova será gerada e o usuário sairá de todas as sessões. Passe a senha para ele trocar em Configurações.
                  </p>
                ) : (
                  <NewPassword password={editing.password} />
                )}
                {error && <div style={{ fontSize: 12, color: 'var(--status-error)', marginBottom: 10 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onClick={close}>{editing.password === null ? 'Cancelar' : 'Fechar'}</Button>
                  {editing.password === null && (
                    <Button size="sm" onClick={handleSavePassword} disabled={loading}>{loading ? 'Gerando…' : 'Gerar senha nova'}</Button>
                  )}
                </div>
              </>
            )}

            {editing.type === 'delete' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Remover usuário</div>
                <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                  Remover <strong>{editingUser?.name}</strong> ({editingUser?.email})?
                  O acesso é cortado na hora. O histórico de requisições continua guardado.
                </p>
                {error && <div style={{ fontSize: 12, color: 'var(--status-error)', marginBottom: 10 }}>{error}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button variant="ghost" size="sm" onClick={close}>Cancelar</Button>
                  <Button variant="danger" size="sm" onClick={handleDelete} disabled={loading}>{loading ? 'Removendo…' : 'Remover'}</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** Shows a generated password once, with a copy button. */
export function NewPassword({ password }: { password: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Senha gerada (só aparece agora):</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ flex: 1, padding: '8px 10px', fontSize: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', userSelect: 'all' }}>{password}</code>
        <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard?.writeText(password); setCopied(true) }}>{copied ? 'Copiada' : 'Copiar'}</Button>
      </div>
    </div>
  )
}
