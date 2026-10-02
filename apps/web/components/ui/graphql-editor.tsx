'use client'

import { useEffect, useRef, useState } from 'react'
import { CodeEditor } from './code-editor'
import { buildGraphqlBody, parseGraphqlBody } from '@/lib/graphql-body'

const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 12px',
  borderBottom: '1px solid var(--border)', background: 'var(--surface)', textTransform: 'uppercase', letterSpacing: 0.4,
}

/** Query and Variables editors over a GraphQL JSON body; emits the rebuilt body on every valid change. */
export function GraphqlEditor({ value, onChange }: { value: string; onChange: (body: string) => void }) {
  const parsed = parseGraphqlBody(value) ?? { query: '', variables: '' }
  const [vars, setVars] = useState(parsed.variables)
  const [error, setError] = useState('')
  const lastEmitted = useRef(value)

  // A body loaded from outside (another endpoint) replaces what is being typed.
  useEffect(() => {
    if (value !== lastEmitted.current) { setVars(parseGraphqlBody(value)?.variables ?? ''); setError('') }
  }, [value])

  const emit = (query: string, variables: string) => {
    const r = buildGraphqlBody(query, variables)
    if ('error' in r) { setError(r.error); return }
    setError('')
    lastEmitted.current = r.body
    onChange(r.body)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={label}>Query</div>
      <div style={{ flex: 2, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
        <CodeEditor value={parsed.query} onChange={(q) => emit(q, vars)} language="text" fill />
      </div>
      <div style={{ ...label, borderTop: '1px solid var(--border)' }}>Variables</div>
      <div style={{ flex: 1, minHeight: 80, display: 'flex', flexDirection: 'column', outline: error ? '1px solid var(--status-error)' : 'none', outlineOffset: -1 }}>
        <CodeEditor value={vars} onChange={(v) => { setVars(v); emit(parsed.query, v) }} language="json" fill />
      </div>
      {error && <span role="alert" style={{ fontSize: 11, color: 'var(--status-error)', padding: '4px 12px' }}>{error}</span>}
    </div>
  )
}
