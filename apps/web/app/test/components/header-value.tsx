'use client'

import { useState } from 'react'
import { ChevronRight, Copy, Check } from 'lucide-react'

const TRUNCATE_AT = 96

const monoBase = {
  fontFamily: 'monospace',
  fontSize: 12,
  color: 'var(--text)',
  wordBreak: 'break-all' as const,
}

/**
 * Renders a header value. Short values render as plain monospace text; long ones
 * collapse to a preview with a length badge and expand on click. Copy button
 * appears once expanded. Works for any header pair — request or response.
 */
export function HeaderValue({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  if (value.length <= TRUNCATE_AT) {
    return <span style={monoBase}>{value}</span>
  }

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard indisponível — ignore */
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        style={{
          display: 'flex',
          alignItems: expanded ? 'flex-start' : 'center',
          gap: 6,
          width: '100%',
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
        }}
      >
        <ChevronRight
          size={12}
          style={{
            flexShrink: 0,
            marginTop: expanded ? 3 : 0,
            color: 'var(--text-subtle)',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        />
        <span
          style={{
            ...monoBase,
            ...(expanded
              ? {}
              : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
            flex: 1,
            minWidth: 0,
          }}
        >
          {value}
        </span>
        {!expanded && (
          <span
            style={{
              flexShrink: 0,
              fontFamily: 'monospace',
              fontSize: 10,
              color: 'var(--text-subtle)',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '1px 6px',
              whiteSpace: 'nowrap',
            }}
          >
            {value.length}
          </span>
        )}
      </button>

      {expanded && (
        <button
          type="button"
          onClick={copy}
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginLeft: 18,
            fontSize: 11,
            padding: '2px 8px',
            backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 4,
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
    </div>
  )
}
