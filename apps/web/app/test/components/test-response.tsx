'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Loader2, Download, MoreHorizontal, Copy, Check, Terminal, Image as ImageIcon } from 'lucide-react'
import { StatusBadge } from '@/components/ui/badge'
import { JsonTree } from './json-tree'
import { HeaderValue } from './header-value'
import { tryPrettyJson, tryPrettyXml } from '@/lib/utils'
import type { ExecuteResponse, ExportData } from '../lib/types'
import { ExportCard } from './export-card'
import { useExport } from './use-export'
import dynamic from 'next/dynamic'

const CodeBlock = dynamic(() => import('@/components/ui/code-block').then(m => ({ default: m.CodeBlock })), { ssr: false })

/** First response tab, named after what came back (JSON, XML…), not always "JSON". */
const BODY_TAB_LABEL: Record<string, string> = { json: 'JSON', xml: 'XML', html: 'HTML', csv: 'CSV', text: 'Texto', image: 'Imagem', document: 'Documento', binary: 'Arquivo' }

// Gitea "secondary pointing" menu: the active tab is underlined in the text color.
const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
  color: active ? 'var(--text-strong)' : 'var(--text-muted)',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: active ? '2px solid var(--text-strong)' : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
})

function downloadBase64(base64: string, mimeType: string, fileName: string) {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function BinaryContent({ response }: { response: ExecuteResponse }) {
  const name = response.fileName ?? `download.${response.mimeType.split('/')[1] ?? 'bin'}`
  const sizeKb = (Math.floor(response.responseBody.length * 3 / 4) / 1024).toFixed(1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', minHeight: 120 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        [{response.mimeType} · {sizeKb}KB · {name}]
      </p>
      <button
        onClick={() => downloadBase64(response.responseBody, response.mimeType, name)}
        className="btn-default btn-md" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <Download size={14} />
        Baixar {name}
      </button>
    </div>
  )
}

function ImageContent({ response }: { response: ExecuteResponse }) {
  const name = response.fileName ?? `imagem.${response.mimeType.split('/')[1] ?? 'jpg'}`
  const sizeBytes = Math.floor(response.responseBody.length * 3 / 4)
  const tooBig = sizeBytes > 5 * 1024 * 1024 // >5MB: não renderiza inline

  if (tooBig) {
    return <BinaryContent response={response} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <img
        src={`data:${response.mimeType};base64,${response.responseBody}`}
        alt={name}
        style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
      />
      <button
        onClick={() => downloadBase64(response.responseBody, response.mimeType, name)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <Download size={12} />
        {name}
      </button>
    </div>
  )
}

interface TestResponseProps {
  response: ExecuteResponse | null
  loading: boolean
  erpName?: string
  companyName?: string
  curlString?: string
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '7px 14px', fontSize: 12, color: 'var(--text)',
  background: 'none', border: 'none', cursor: 'pointer',
  textAlign: 'left', whiteSpace: 'nowrap',
}

function copyText(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text)
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;opacity:0'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  return Promise.resolve()
}

function ActionsMenu({ response, curlString, erpName, companyName }: {
  response: ExecuteResponse
  curlString?: string
  erpName: string
  companyName: string
}) {
  const [open, setOpen] = useState(false)
  const [outputCopied, setOutputCopied] = useState(false)
  const [curlCopied, setCurlCopied] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const { capturing, copyCapturing, downloadCapturing, imageCopied, copyImage, downloadPng } = useExport(cardRef)

  const exportData: ExportData = {
    method: response.method, url: response.url, erpName, companyName,
    status: response.statusCode, duration: response.durationMs, timestamp: new Date(),
    requestBody: response.requestBody,
    responseBody: response.isBinary ? null : response.responseBody,
    binaryMeta: response.isBinary ? {
      mimeType: response.mimeType,
      sizeKB: Math.floor(response.responseBody.length * 3 / 4) / 1024,
      fileName: response.fileName,
    } : undefined,
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <>
      <div style={{ position: 'fixed', left: -9999, top: 0, zIndex: -1, pointerEvents: 'none' }}>
        <ExportCard ref={cardRef} data={exportData} />
      </div>
      <div ref={wrapperRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(v => !v)}
          title="Ações"
          style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4 }}
        >
          <MoreHorizontal size={14} />
        </button>
        {open && (
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-box)', boxShadow: '0 6px 18px rgba(0,0,0,0.25)', zIndex: 200, minWidth: 170, overflow: 'hidden' }}>
            <button style={{ ...menuItemStyle, color: outputCopied ? 'var(--status-success)' : 'var(--text)' }} onClick={() => {
              copyText(tryPrettyJson(response.responseBody))
              setOutputCopied(true); setTimeout(() => { setOutputCopied(false); setOpen(false) }, 1200)
            }}>
              {outputCopied ? <Check size={13} /> : <Copy size={13} />}
              {outputCopied ? 'Copiado!' : 'Copiar output'}
            </button>
            {curlString && (
              <button style={{ ...menuItemStyle, color: curlCopied ? 'var(--status-success)' : 'var(--text)' }} onClick={() => {
                copyText(curlString)
                setCurlCopied(true); setTimeout(() => { setCurlCopied(false); setOpen(false) }, 1200)
              }}>
                {curlCopied ? <Check size={13} /> : <Terminal size={13} />}
                {curlCopied ? 'Copiado!' : 'Copiar curl'}
              </button>
            )}
            <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }} />
            <button
              style={{ ...menuItemStyle, color: imageCopied ? 'var(--status-success)' : 'var(--text)' }}
              disabled={capturing}
              onClick={async () => { await copyImage(); setTimeout(() => setOpen(false), 1200) }}
            >
              {copyCapturing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : imageCopied ? <Check size={13} /> : <ImageIcon size={13} />}
              {copyCapturing ? 'Processando...' : imageCopied ? 'Copiado!' : 'Copiar imagem'}
            </button>
            <button style={menuItemStyle} disabled={capturing} onClick={async () => { await downloadPng(); setOpen(false) }}>
              {downloadCapturing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
              {downloadCapturing ? 'Processando...' : 'Baixar PNG'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export function TestResponse({ response, loading, erpName = '', companyName = '', curlString }: TestResponseProps) {
  const [resTab, setResTab] = useState<'json' | 'raw' | 'headers' | 'timeline'>('json')

  if (!response) {
    return (
      <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
      <div style={{ flex: 1, display: 'flex', background: 'var(--surface)', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <>
            <Loader2 size={28} color="var(--text-subtle)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-subtle)', fontSize: 13 }}>Executando requisição...</p>
          </>
        ) : (
          <>
            <Play size={28} color="var(--text-subtle)" />
            <p style={{ color: 'var(--text-subtle)', fontSize: 13 }}>Execute uma requisição para ver a resposta</p>
          </>
        )}
      </div>
      </div>
    )
  }

  // JSON/XML ocupa o painel inteiro; as outras abas mantêm o respiro
  const fillsPane = resTab === 'json' && !response.isBinary && response.contentCategory !== 'image'

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: 'var(--surface)' }}>
      {/* Status bar */}
      <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <StatusBadge code={response.statusCode} />
        <span className="g-counter" style={{ borderRadius: 'var(--radius)', fontFamily: 'monospace' }}>{response.durationMs}ms</span>
        <span className="g-counter" style={{ borderRadius: 'var(--radius)', fontFamily: 'monospace' }}>
          {response.isBinary
            ? `${(Math.floor(response.responseBody.length * 3 / 4) / 1024).toFixed(1)}KB`
            : `${(response.responseBody.length / 1024).toFixed(1)}KB`}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {response.method} {response.url}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '0 12px', flexShrink: 0 }}>
        {([{ id: 'json', label: BODY_TAB_LABEL[response.contentCategory] ?? 'Corpo' }, { id: 'raw', label: 'Raw' }, { id: 'headers', label: 'Headers' }, { id: 'timeline', label: 'Timeline' }] as const).map(({ id, label }) => (
          <button key={id} style={tabBtnStyle(resTab === id)} onClick={() => setResTab(id)}>{label}</button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <ActionsMenu response={response} curlString={curlString} erpName={erpName} companyName={companyName} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: fillsPane ? 0 : 16, display: 'flex', flexDirection: 'column' }}>
        {resTab === 'json' && (() => {
          if (response.contentCategory === 'image') return <ImageContent response={response} />
          if (response.isBinary) return <BinaryContent response={response} />
          if (response.contentCategory === 'xml' || response.contentCategory === 'html') {
            return (
              <CodeBlock
                language="xml"
                customStyle={{ margin: 0, flex: 1, borderRadius: 0, fontSize: 12, backgroundColor: 'var(--surface-2)', lineHeight: 1.7 }}
                wrapLongLines
              >
                {tryPrettyXml(response.responseBody)}
              </CodeBlock>
            )
          }
          let parsed: unknown = null
          try { parsed = JSON.parse(response.responseBody) } catch {}
          return (
            <div style={{ flex: 1, backgroundColor: 'var(--surface-2)', padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, color: 'var(--json-punct)', overflow: 'auto' }}>
              {parsed !== null && parsed !== undefined
                ? <JsonTree value={parsed} />
                : <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text)' }}>{response.responseBody}</pre>
              }
            </div>
          )
        })()}

        {resTab === 'raw' && (
          response.contentCategory === 'image'
            ? <ImageContent response={response} />
            : response.isBinary
              ? <BinaryContent response={response} />
              : <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6 }}>
                  {response.responseBody}
                </pre>
        )}

        {resTab === 'headers' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(response.responseHeaders).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 0', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', width: '40%', paddingRight: 12, verticalAlign: 'top' }}>{k}</td>
                  <td style={{ padding: '6px 0', fontSize: 12 }}><HeaderValue value={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {resTab === 'timeline' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Total</span>
              <span style={{ fontFamily: 'monospace' }}>{response.durationMs}ms</span>
            </div>
            <div style={{ marginTop: 20 }}>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--accent)', width: '100%' }} />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Request + Response: {response.durationMs}ms
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
