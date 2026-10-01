'use client'

import { useRef, useState, useEffect } from 'react'
import { Loader2, Share2, Image, Download } from 'lucide-react'
import { ExportCard } from './export-card'
import { useExport } from './use-export'
import type { ExportData } from '../lib/types'

interface ExportButtonProps {
  data: ExportData
}

export function ExportButton({ data }: ExportButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const { capturing, copyImage, downloadPng } = useExport(cardRef)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 14px',
    fontSize: 12,
    color: 'var(--text)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }

  return (
    <>
      {/* Card oculto fora da tela para captura */}
      <div style={{ position: 'fixed', left: -9999, top: 0, zIndex: -1, pointerEvents: 'none' }}>
        <ExportCard ref={cardRef} data={data} />
      </div>

      {/* Botão + dropdown */}
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <button
          disabled={capturing}
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: capturing ? 'var(--text-subtle)' : 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: capturing ? 'not-allowed' : 'pointer',
            padding: '4px 6px',
            borderRadius: 4,
          }}
        >
          {capturing
            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            : <Share2 size={12} />
          }
          {capturing ? 'Exportando...' : 'Exportar'}
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 4px)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              zIndex: 200,
              minWidth: 160,
              overflow: 'hidden',
            }}
          >
            <button style={menuItemStyle} onClick={() => { copyImage(); setOpen(false) }}>
              <Image size={13} /> Copiar imagem
            </button>
            <button style={menuItemStyle} onClick={() => { downloadPng(); setOpen(false) }}>
              <Download size={13} /> Baixar PNG
            </button>
          </div>
        )}
      </div>
    </>
  )
}
