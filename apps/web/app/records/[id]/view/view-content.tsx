'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { JsonTree } from '@/app/test/components/json-tree'
import { tryPrettyXml } from '@/lib/utils'
import { Copy, Check, Terminal, Download } from 'lucide-react'

const CodeBlock = dynamic(() => import('@/components/ui/code-block').then(m => ({ default: m.CodeBlock })), { ssr: false })

export type BlockResponse = {
  statusCode?: number
  responseBody?: unknown
  durationMs?: number
  contentCategory?: string
  isBinary?: boolean
  mimeType?: string
  fileName?: string | null
  method?: string
  url?: string
  requestHeaders?: Record<string, string>
  requestBody?: string | null
}

type ViewBlock = {
  id: number
  order: number
  note: string
  executedAt: Date | null
  response: BlockResponse | null
  endpoint: { id: number; name: string; method: string; pathTemplate: string } | null
  client: { id: number; name: string } | null
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--status-success)', POST: 'var(--method-post)', PUT: 'var(--status-warning)', PATCH: 'var(--method-patch)', DELETE: 'var(--status-error)',
}

function fallbackCopy(text: string, cb: () => void) {
  const ta = document.createElement('textarea')
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'
  document.body.appendChild(ta); ta.select()
  try { document.execCommand('copy') } catch {}
  document.body.removeChild(ta); cb()
}

function copyText(text: string, cb: () => void) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(cb).catch(() => fallbackCopy(text, cb))
  else fallbackCopy(text, cb)
}

function buildCurl(resp: BlockResponse): string | null {
  if (!resp.method || !resp.url) return null
  const parts = [`curl -X ${resp.method} '${resp.url}'`]
  for (const [k, v] of Object.entries(resp.requestHeaders ?? {})) parts.push(`  -H '${k}: ${v}'`)
  if (resp.requestBody) parts.push(`  -d '${resp.requestBody}'`)
  return parts.join(' \\\n')
}

function ResponseBody({ resp }: { resp: BlockResponse }) {
  const body = typeof resp.responseBody === 'string' ? resp.responseBody : JSON.stringify(resp.responseBody ?? '')
  const cat = resp.contentCategory

  if (cat === 'image' && resp.isBinary) {
    const name = resp.fileName ?? `imagem.${resp.mimeType?.split('/')[1] ?? 'jpg'}`
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
        <img src={`data:${resp.mimeType};base64,${body}`} alt={name}
          style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }} />
        <a href={`data:${resp.mimeType};base64,${body}`} download={name}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <Download size={12} />{name}
        </a>
      </div>
    )
  }

  if (resp.isBinary) {
    const name = resp.fileName ?? `download.${resp.mimeType?.split('/')[1] ?? 'bin'}`
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{resp.mimeType}</span>
        <a href={`data:${resp.mimeType};base64,${body}`} download={name}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', fontSize: 13, fontWeight: 500, backgroundColor: 'var(--accent)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
          <Download size={13} />Baixar {name}
        </a>
      </div>
    )
  }

  if (cat === 'xml' || cat === 'html') {
    return (
      <CodeBlock language="xml" customStyle={{ borderRadius: 8, fontSize: 11, backgroundColor: 'var(--surface-2)', lineHeight: 1.7, border: '1px solid var(--border)', maxHeight: 400, overflowY: 'auto' }} wrapLongLines>
        {tryPrettyXml(body)}
      </CodeBlock>
    )
  }

  let parsed: unknown = null
  try { parsed = JSON.parse(body) } catch {}

  if (parsed !== null) {
    return (
      <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: 8, padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, color: 'var(--text)', border: '1px solid var(--border)', maxHeight: 400, overflowY: 'auto' }}>
        <JsonTree value={parsed} />
      </div>
    )
  }

  return (
    <pre style={{ margin: 0, fontSize: 11, backgroundColor: 'var(--surface-2)', borderRadius: 8, padding: '12px 14px', overflowX: 'auto', maxHeight: 400, overflowY: 'auto', fontFamily: 'monospace', lineHeight: 1.6, color: 'var(--text)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {body}
    </pre>
  )
}

function BlockCard({ block, index }: { block: ViewBlock; index: number }) {
  const [curlCopied, setCurlCopied] = useState(false)
  const [showCurl, setShowCurl] = useState(false)
  const [showBody, setShowBody] = useState(false)
  const resp = block.response
  const ep = block.endpoint
  const methodColor = ep ? (METHOD_COLORS[ep.method] ?? 'var(--text-muted)') : 'var(--text-muted)'
  const statusCode = resp?.statusCode
  const statusColor = !statusCode ? 'var(--text-subtle)' : statusCode < 300 ? 'var(--status-success)' : 'var(--status-error)'
  const curlCmd = resp ? buildCurl(resp) : null

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {/* Number outside the card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, flexShrink: 0, width: 32 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: statusColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          #{index + 1}
        </span>
      </div>

    <div style={{ flex: 1, minWidth: 0, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'flex' }}>
      {/* Left stripe */}
      <div style={{ width: 3, backgroundColor: methodColor, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Note — top, amber */}
        {block.note && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 16px', backgroundColor: 'color-mix(in srgb, var(--status-warning) 8%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--status-warning) 20%, transparent)' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-warning)', flexShrink: 0, marginTop: 1 }}>✎</span>
            <span style={{ fontSize: 13, color: 'var(--status-warning)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{block.note}</span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: resp?.statusCode ? '1px solid var(--border)' : 'none' }}>
          {ep ? (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: methodColor, backgroundColor: `color-mix(in srgb, ${methodColor} 14%, transparent)`, padding: '2px 6px', borderRadius: 3 }}>
                  {ep.method}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{ep.name}</span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-subtle)' }}>{ep.pathTemplate}</span>
            </div>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--text-subtle)', flex: 1 }}>Endpoint não encontrado</span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {block.client && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', backgroundColor: 'var(--surface-3)', padding: '2px 8px', borderRadius: 4 }}>{block.client.name}</span>
            )}
            {resp?.requestBody && (
              <button onClick={() => setShowBody(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--border)', backgroundColor: showBody ? 'var(--surface-3)' : 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Body
              </button>
            )}
            {curlCmd && (
              <button onClick={() => setShowCurl(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--border)', backgroundColor: showCurl ? 'var(--surface-3)' : 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <Terminal size={11} /> cURL
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {resp?.requestBody && showBody && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 6, fontWeight: 600 }}>Request Body</div>
            <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6, border: '1px solid var(--border)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {(() => { try { return JSON.stringify(JSON.parse(resp.requestBody!), null, 2) } catch { return resp.requestBody } })()}
            </pre>
          </div>
        )}

        {/* cURL */}
        {curlCmd && showCurl && (
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
            <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', backgroundColor: 'var(--surface-2)', borderRadius: 6, padding: '10px 12px', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.6, border: '1px solid var(--border)' }}>
              {curlCmd}
            </pre>
            <button
              onClick={() => copyText(curlCmd, () => { setCurlCopied(true); setTimeout(() => setCurlCopied(false), 1500) })}
              style={{ position: 'absolute', top: 18, right: 24, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: curlCopied ? 'var(--status-success)' : 'var(--text-muted)', cursor: 'pointer' }}>
              {curlCopied ? <Check size={10} /> : <Copy size={10} />}
              {curlCopied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        )}

        {/* Response */}
        {resp?.statusCode && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: statusColor, backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`, padding: '2px 8px', borderRadius: 4 }}>
                {resp.statusCode}
              </span>
              {resp.durationMs && <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{resp.durationMs}ms</span>}
              {block.executedAt && (
                <span style={{ fontSize: 11, color: 'var(--text-subtle)', marginLeft: 'auto' }}>
                  {new Date(block.executedAt).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
            <ResponseBody resp={resp} />
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

export function ViewContent({
  recordName,
  companyName,
  categoryName,
  createdAt,
  notes,
  blocks,
}: {
  recordName: string
  companyName: string
  categoryName: string | null
  createdAt: Date
  notes: string
  blocks: ViewBlock[]
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--background)', color: 'var(--text)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', zIndex: 9999, overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '20px 28px', backgroundColor: 'var(--surface)' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>{companyName}</h1>
              {categoryName && (
                <span style={{ fontSize: 12, color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '2px 10px', borderRadius: 10, fontWeight: 500 }}>
                  {categoryName}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-subtle)', display: 'flex', gap: 10 }}>
              <span>{blocks.length} bloco{blocks.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{new Date(createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', backgroundColor: 'var(--surface-2)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
            somente leitura
          </span>
        </div>
      </div>

      {/* Blocks */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px' }}>
        {notes && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 32, flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8, backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
              <span style={{ fontSize: 12, color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>✎</span>
              <span style={{ fontSize: 13, color: 'var(--accent)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{notes}</span>
            </div>
          </div>
        )}
        {blocks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-subtle)', fontSize: 14 }}>
            Este registro ainda não possui blocos.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {blocks.map((block, i) => <BlockCard key={block.id} block={block} index={i} />)}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '32px', fontSize: 11, color: 'var(--border-2)' }}>
        ERP Tester · gerado em {new Date().toLocaleDateString('pt-BR')}
      </div>
    </div>
  )
}
