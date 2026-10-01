'use client'

import { useState } from 'react'
import { ROLES, getRoleLabel, type Role } from '@/lib/roles'
import { updateUserRole } from './actions'

export function RoleSelect({ userId, currentRole }: { userId: number; currentRole: Role }) {
  const [role, setRole] = useState(currentRole)

  const handleClick = async (r: Role) => {
    const previous = role
    setRole(r)
    try {
      const res = await updateUserRole(userId, r)
      if ('error' in res) { setRole(previous); alert(res.error) }
    } catch { setRole(previous) }
  }

  return (
    <div role="group" aria-label="Papel" style={{ display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--input-border)', width: 'fit-content' }}>
      {ROLES.map((r, i) => {
        const active = r === role
        return (
          <button key={r} aria-pressed={active} onClick={() => handleClick(r)}
            style={{
              height: 26, padding: '0 10px', fontSize: 12, cursor: 'pointer', border: 'none',
              fontWeight: active ? 600 : 400,
              backgroundColor: active ? 'var(--surface-3)' : 'var(--input-bg)',
              color: active ? 'var(--text-strong)' : 'var(--text-muted)',
              borderLeft: i > 0 ? '1px solid var(--input-border)' : 'none',
            }}>
            {getRoleLabel(r)}
          </button>
        )
      })}
    </div>
  )
}
