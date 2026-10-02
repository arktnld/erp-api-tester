'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import dynamic from 'next/dynamic'
import { tryPrettyJson } from '../lib/utils'
import { HeaderValue } from './header-value'
import type { EditorLanguage } from '@/components/ui/code-editor'

const CodeBlock = dynamic(() => import('@/components/ui/code-block').then(m => ({ default: m.CodeBlock })), { ssr: false })
const CodeEditor = dynamic(() => import('@/components/ui/code-editor').then(m => ({ default: m.CodeEditor })), { ssr: false })
import type { ExecuteResponse } from '../lib/types'
import { parseGraphqlBody } from '@/lib/graphql-body'

const GraphqlEditor = dynamic(() => import('@/components/ui/graphql-editor').then((m) => m.GraphqlEditor), { ssr: false })

interface TestRequestProps {
  response: ExecuteResponse | null
  resolvedBody: string
  bodyMode: 'form' | 'raw'
  rawBody: string
  editorLanguage: EditorLanguage
  sensitiveValues: Set<string>
  sensitiveHeaderKeys: Set<string>
  onBodyModeChange: (mode: 'form' | 'raw') => void
  onRawBodyChange: (value: string) => void
}

function isValidJson(text: string): boolean {
  if (!text.trim()) return true
  try { JSON.parse(text); return true } catch { return false }
}

export function TestRequest({ response, resolvedBody, bodyMode, rawBody, editorLanguage, sensitiveValues, sensitiveHeaderKeys, onBodyModeChange, onRawBodyChange }: TestRequestProps) {
  const [showSensitive, setShowSensitive] = useState(false)
  const [jsonTouched, setJsonTouched] = useState(false)
  // GraphQL bodies ({"query": …}) open as Query + Variables; "JSON" shows the raw body
  const [showGraphqlJson, setShowGraphqlJson] = useState(false)
  const isGraphql = editorLanguage === 'json' && parseGraphqlBody(rawBody) !== null
  const graphqlView = isGraphql && !showGraphqlJson
  const hasSensitive = sensitiveHeaderKeys.size > 0 || sensitiveValues.size > 0
  const jsonInvalid = jsonTouched && editorLanguage === 'json' && !isValidJson(rawBody)

  function handleEditorBlur() {
    setJsonTouched(true)
    if (editorLanguage === 'json' && rawBody.trim() && isValidJson(rawBody)) {
      onRawBodyChange(tryPrettyJson(rawBody))
    }
  }

  useEffect(() => {
    setShowSensitive(false)
  }, [sensitiveHeaderKeys.size, sensitiveValues.size])

  function maskHeaderValue(key: string, value: string): string {
    if (showSensitive) return value
    return sensitiveHeaderKeys.has(key) ? '••••••••' : value
  }

  function maskBodyValue(text: string): string {
    if (showSensitive || sensitiveValues.size === 0) return text
    let result = text
    for (const secret of sensitiveValues) {
      result = result.replaceAll(secret, '••••••••')
    }
    return result
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Headers */}
        <section className="g-box" aria-label="Headers">
          <div className="g-box-header" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Headers
              {response && <span className="g-counter">{Object.keys(response?.requestHeaders ?? {}).length}</span>}
            </span>
            {hasSensitive && (
              <button
                onClick={() => setShowSensitive(s => !s)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 400,
                  padding: '2px 4px',
                }}
              >
                {showSensitive ? <Eye size={12} /> : <EyeOff size={12} />}
                {showSensitive ? 'Ocultar' : 'Revelar'}
              </button>
            )}
          </div>
          {response ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {Object.entries(response.requestHeaders ?? {}).map(([k, v], i, all) => (
                  <tr key={k} style={{ borderBottom: i < all.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', width: '40%', verticalAlign: 'top' }}>{k}</td>
                    <td style={{ padding: '8px 14px', fontSize: 12 }}><HeaderValue value={maskHeaderValue(k, v)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-subtle)', padding: '18px 14px', textAlign: 'center' }}>Execute para ver os headers enviados.</p>
          )}
        </section>

        {/* Body */}
        <section className="g-box" aria-label="Body" style={{ flex: 1, minHeight: 240, display: 'flex', flexDirection: 'column' }}>
          <div className="g-box-header" style={{ justifyContent: 'space-between', padding: '6px 6px 6px 14px' }}>
            <span>Body</span>
            <div role="group" aria-label="Modo do body" style={{ display: 'flex', gap: 0, border: '1px solid var(--input-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {(['form', 'raw'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    if (mode === 'raw' && bodyMode === 'form') {
                      onRawBodyChange(resolvedBody ? tryPrettyJson(resolvedBody) : '')
                    }
                    onBodyModeChange(mode)
                  }}
                  aria-pressed={bodyMode === mode}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: bodyMode === mode ? 600 : 400,
                    color: bodyMode === mode ? 'var(--text-strong)' : 'var(--text)',
                    background: bodyMode === mode ? 'var(--surface-3)' : 'var(--input-bg)',
                    border: 'none',
                    borderLeft: mode === 'raw' ? '1px solid var(--input-border)' : 'none',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {bodyMode === 'form' ? (
            resolvedBody ? (
              <CodeBlock
                language="json"
                wrapLongLines
                customStyle={{ margin: 0, flex: 1, overflow: 'auto', borderRadius: 0, fontSize: 12, backgroundColor: 'var(--surface-2)' }}
              >
                {maskBodyValue(tryPrettyJson(resolvedBody))}
              </CodeBlock>
            ) : (
              <p style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--text-subtle)', padding: '18px 14px' }}>Nenhum body para este endpoint.</p>
            )
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                outline: jsonInvalid ? '1px solid var(--status-error)' : 'none',
                outlineOffset: -1,
                overflow: 'hidden',
              }}>
                {graphqlView
                  ? <GraphqlEditor value={rawBody} onChange={onRawBodyChange} />
                  : <CodeEditor
                      value={rawBody}
                      onChange={onRawBodyChange}
                      onBlur={handleEditorBlur}
                      language={editorLanguage}
                      fill
                    />}
              </div>
              {isGraphql && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 10px', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setShowGraphqlJson((v) => !v)}
                    style={{ padding: '3px 10px', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer' }}
                  >
                    {graphqlView ? 'Ver JSON' : 'Ver GraphQL'}
                  </button>
                </div>
              )}
              {editorLanguage === 'json' && !graphqlView && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderTop: '1px solid var(--border)' }}>
                  {jsonInvalid
                    ? <span style={{ fontSize: 11, color: 'var(--status-error)' }}>JSON inválido</span>
                    : <span />
                  }
                  <button
                    onClick={() => onRawBodyChange(tryPrettyJson(rawBody))}
                    style={{
                      padding: '3px 10px',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 5,
                      cursor: 'pointer',
                    }}
                  >
                    Formatar
                  </button>
                </div>
              )}
            </div>
          )}
          </div>
        </section>
      </div>
    </div>
  )
}
