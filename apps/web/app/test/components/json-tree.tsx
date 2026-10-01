'use client'

import { useState } from 'react'

const treeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  fontSize: 10,
  padding: '0 2px',
  verticalAlign: 'middle',
  lineHeight: 1,
  userSelect: 'none',
}

export function JsonTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [open, setOpen] = useState(true)

  if (value === null) return <span style={{ color: 'var(--json-null)' }}>null</span>
  if (value === undefined) return <span style={{ color: 'var(--json-null)' }}>undefined</span>
  if (typeof value === 'boolean') return <span style={{ color: 'var(--json-bool)' }}>{String(value)}</span>
  if (typeof value === 'number') return <span style={{ color: 'var(--json-number)' }}>{String(value)}</span>
  if (typeof value === 'string') return <span style={{ color: 'var(--json-string)' }}>&quot;{value}&quot;</span>

  const isArr = Array.isArray(value)
  const entries: [string, unknown][] = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>)
  const openChar = isArr ? '[' : '{'
  const closeChar = isArr ? ']' : '}'

  if (entries.length === 0) {
    return <span style={{ color: 'var(--json-punct)' }}>{openChar}{closeChar}</span>
  }

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} style={treeBtnStyle}>
        {open ? '▾' : '▸'}
      </button>
      {open ? (
        <>
          <span style={{ color: 'var(--json-punct)' }}>{openChar}</span>
          <div style={{ paddingLeft: 18, marginLeft: 2, borderLeft: '1px solid var(--border)' }}>
            {entries.map(([k, v], i) => (
              <div key={k + String(i)} style={{ lineHeight: 1.7 }}>
                {isArr ? (
                  <span style={{ color: 'var(--json-punct)', marginRight: 6, fontSize: 10 }}>{k}</span>
                ) : (
                  <>
                    <span style={{ color: 'var(--json-key)' }}>&quot;{k}&quot;</span>
                    <span style={{ color: 'var(--json-punct)' }}>: </span>
                  </>
                )}
                <JsonTree value={v} depth={depth + 1} />
                {i < entries.length - 1 && <span style={{ color: 'var(--json-punct)' }}>,</span>}
              </div>
            ))}
          </div>
          <span style={{ color: 'var(--json-punct)' }}>{closeChar}</span>
        </>
      ) : (
        <span style={{ color: 'var(--json-punct)', cursor: 'pointer' }} onClick={() => setOpen(true)}>
          {openChar}…{closeChar}
        </span>
      )}
    </>
  )
}
