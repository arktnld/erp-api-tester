import { AUTH_TYPES, type AuthModeConfig } from './auth'

// Pure helpers of the ERP auth editor (app/erps/[id]/auth-modes-editor.tsx), kept here so the
// save format and the validation are unit-tested against the real templates.

const KEY_RE = /^[A-Za-z_][\w-]*$/

/** Fields for a type: the fixed keys of that type (keeping labels already set), or the current free list. */
export function fieldsForType(type: string, current: AuthModeConfig['fields']): AuthModeConfig['fields'] {
  const fixed = AUTH_TYPES[type]?.fixedKeys
  if (!fixed) return current
  return fixed.map((f) => current.find((c) => c.key === f.key) ?? { key: f.key, label: f.label, placeholder: '', default: '', hidden: false })
}

/** Problems that would make a mode useless; empty when it can be saved. */
export function validateAuthModes(modes: AuthModeConfig[], endpoints: { id: number }[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  modes.forEach((m, i) => {
    const name = m.label || `Modo ${i + 1}`
    if (!m.id) errors.push(`${name}: falta o ID.`)
    else if (!/^[a-z0-9_]+$/.test(m.id)) errors.push(`${name}: ID só com letras minúsculas, números e _.`)
    else if (ids.has(m.id)) errors.push(`${name}: o ID "${m.id}" já existe.`)
    ids.add(m.id)
    if (!AUTH_TYPES[m.type]) errors.push(`${name}: escolha o tipo.`)
    if (m.type === 'token_endpoint' && !endpoints.some((e) => e.id === m.tokenEndpointId)) errors.push(`${name}: escolha o endpoint que devolve o token.`)
    if (m.type === 'token_endpoint' && !m.tokenPath?.trim()) errors.push(`${name}: informe onde o token vem na resposta.`)
    const keys = new Set<string>()
    for (const f of m.fields) {
      if (!KEY_RE.test(f.key)) errors.push(`${name}: a chave "${f.key || '(vazia)'}" é inválida.`)
      else if (keys.has(f.key)) errors.push(`${name}: a chave "${f.key}" está repetida.`)
      keys.add(f.key)
    }
    if (!m.fields.length && m.type !== 'token_endpoint') errors.push(`${name}: adicione pelo menos um campo.`)
  })
  return errors
}

/** Stored shape: {} without modes, the original flat object for a single "default" mode, a list otherwise. */
export function toAuthTemplate(modes: (AuthModeConfig & { saved?: boolean })[]): unknown {
  const clean = modes.map((m) => ({
    id: m.id, type: m.type, label: m.label, fields: m.fields,
    ...(m.type === 'token_endpoint' ? { tokenEndpointId: m.tokenEndpointId, tokenPath: m.tokenPath } : {}),
  }))
  if (clean.length === 0) return {}
  if (clean.length === 1 && clean[0].id === 'default') {
    const { id: _id, ...rest } = clean[0]
    return rest
  }
  return clean
}
