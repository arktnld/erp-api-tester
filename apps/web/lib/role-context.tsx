'use client'

import { createContext, useContext } from 'react'
import type { Role } from './roles'
import { canEdit as _canEdit, canAdmin as _canAdmin } from './roles'

const RoleContext = createContext<Role>('viewer')

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole() {
  const role = useContext(RoleContext)
  return { role, canEdit: _canEdit(role), canAdmin: _canAdmin(role) }
}
