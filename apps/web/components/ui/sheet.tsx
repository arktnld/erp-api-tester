'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: number
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  width = 480,
}: SheetProps) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!mounted) return null

  // Centered floating window, like the delete dialogs (no side panel).
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, padding: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease',
      }}
    >
      <div
        className="g-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width, maxWidth: '100%', maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,.35)',
          transform: visible ? 'scale(1)' : 'scale(0.97)', transition: 'transform 0.2s ease',
        }}
      >
        <div className="g-box-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)', margin: 0 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4 }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
