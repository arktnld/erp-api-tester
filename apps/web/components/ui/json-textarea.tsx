'use client'

import { useState } from 'react'
import { tryPrettyJson } from '@/lib/utils'

interface JsonTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  style?: React.CSSProperties
}

function isValidJson(text: string): boolean {
  if (!text.trim()) return true
  try { JSON.parse(text); return true } catch { return false }
}

export function JsonTextarea({ value, onChange, placeholder, rows = 4, style }: JsonTextareaProps) {
  const [touched, setTouched] = useState(false)
  const invalid = touched && value.trim() !== '' && !isValidJson(value)

  function handleBlur() {
    setTouched(true)
    if (value.trim() && isValidJson(value)) {
      onChange(tryPrettyJson(value))
    }
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'var(--surface-2)',
          border: `1px solid ${invalid ? 'var(--status-error)' : 'var(--border)'}`,
          borderRadius: 6,
          color: 'var(--text)',
          fontSize: 12,
          fontFamily: 'monospace',
          outline: 'none',
          resize: 'vertical',
          transition: 'border-color 0.2s',
          ...style,
        }}
      />
      {invalid && (
        <span style={{ fontSize: 11, color: 'var(--status-error)', marginTop: 3, display: 'block' }}>
          JSON inválido
        </span>
      )}
    </div>
  )
}
