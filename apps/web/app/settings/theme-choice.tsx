'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getTheme, setTheme, type Theme } from '@/lib/theme'

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'light', label: 'Claro', Icon: Sun },
]

export function ThemeChoice() {
  const [theme, setState] = useState<Theme>('dark')
  useEffect(() => setState(getTheme()), [])

  return (
    <div role="group" aria-label="Tema" style={{ display: 'flex', border: '1px solid var(--input-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {OPTIONS.map(({ value, label, Icon }, i) => {
        const active = theme === value
        return (
          <button
            key={value}
            aria-pressed={active}
            onClick={() => { setTheme(value); setState(value) }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px',
              fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', border: 'none',
              borderLeft: i ? '1px solid var(--input-border)' : 'none',
              background: active ? 'var(--surface-3)' : 'var(--input-bg)',
              color: active ? 'var(--text-strong)' : 'var(--text-muted)',
            }}
          >
            <Icon size={14} /> {label}
          </button>
        )
      })}
    </div>
  )
}
