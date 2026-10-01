'use client'

import { useState, useEffect, useRef, useCallback, useTransition, useMemo } from 'react'
import { getCollectionStructure, deleteCollection, importCollection, getCollectionRawJson } from '@/app/actions/collections'
import type { CollectionStructure, FolderNode, CollectionEndpoint, FlatEndpoint, CollectionParam } from './lib/parser'
import { useRole } from '@/lib/role-context'
import styles from './collections.module.css'

type CollectionMeta = { id: number; name: string; createdAt: Date }

// ── Utilities ─────────────────────────────────────────────────────────────

function buildFlat(node: FolderNode, path: string[] = []): FlatEndpoint[] {
  const eps: FlatEndpoint[] = node.eps.map((ep) => ({
    ...ep,
    folderPath: path,
    _paramNames: [...(ep.params ?? [])].map((p) => p.name).join(' '),
  }))
  return [...eps, ...node.children.flatMap((c) => buildFlat(c, [...path, c.name]))]
}

function getOpenFolderNodes(root: FolderNode, folderPath: string[]): FolderNode[] {
  const result: FolderNode[] = []
  let current = root
  for (const name of folderPath) {
    const next = current.children.find((c) => c.name === name)
    if (!next) break
    result.push(next)
    current = next
  }
  return result
}

function scoreField(query: string, text: string): { score: number; positions: number[] } | null {
  if (!query || !text) return null
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  const positions: number[] = []
  let j = 0
  for (let i = 0; i < q.length; i++) {
    while (j < t.length && t[j] !== q[i]) j++
    if (j >= t.length) return null
    positions.push(j++)
  }
  const MATCH = 16, BONUS_SOL = 16, BONUS_WORD = 8, BONUS_CAMEL = 7
  const BONUS_CONSEC = 4, PEN_GAP_START = 3, PEN_GAP_EXT = 1
  const charBonus = (p: number) => {
    if (p === 0) return BONUS_SOL
    const prev = t[p - 1]
    if (' \t/-_.,:;(['.includes(prev)) return BONUS_WORD
    if (t[p] >= 'A' && t[p] <= 'Z' && prev >= 'a' && prev <= 'z') return BONUS_CAMEL
    return 0
  }
  let score = 0
  for (let i = 0; i < positions.length; i++) {
    score += MATCH + charBonus(positions[i])
    if (i > 0) {
      const gap = positions[i] - positions[i - 1] - 1
      score += gap === 0 ? BONUS_CONSEC : -(PEN_GAP_START + (gap - 1) * PEN_GAP_EXT)
    }
  }
  score -= Math.floor(t.length * 0.05)
  return { score, positions }
}

function runFuzzySearch(query: string, flat: FlatEndpoint[]): Array<FlatEndpoint & { namePositions: Set<number> }> {
  if (!query.trim()) return []
  const q = query.trim()
  const results: Array<{ ep: FlatEndpoint; score: number; namePositions: Set<number> }> = []
  for (const ep of flat) {
    const nameR = scoreField(q, ep.name)
    const pathR = scoreField(q, ep.path ?? '')
    const descR = scoreField(q, ep.desc ?? '')
    const paramR = ep._paramNames ? scoreField(q, ep._paramNames) : null
    const methodBonus = ep.method.toLowerCase().startsWith(q.toLowerCase()) ? 60 : 0
    if (!nameR && !pathR && !descR && !paramR && !methodBonus) continue
    const score =
      (nameR ? nameR.score * 3.0 : 0) +
      (pathR ? pathR.score * 1.5 : 0) +
      (descR ? descR.score * 0.7 : 0) +
      (paramR ? paramR.score * 0.6 : 0) +
      methodBonus
    if (!nameR && !pathR && score < 30) continue
    if (score < 10) continue
    results.push({ ep, score, namePositions: nameR ? new Set(nameR.positions) : new Set() })
  }
  return results
    .sort((a, b) => b.score - a.score)
    .map(({ ep, namePositions }) => ({ ...ep, namePositions }))
}

function buildCurl(ep: CollectionEndpoint): string {
  const parts: string[] = []
  let url = ep.path ?? ''
  const queryParams = ep.queryParams ?? []
  const inlineQuery = queryParams.length > 0 && ['GET', 'HEAD', 'DELETE', 'OPTIONS'].includes(ep.method)
  if (inlineQuery) {
    const qs = queryParams
      .map((p) => encodeURIComponent(p.name) + '=' + encodeURIComponent(p.example ?? '{{' + p.name + '}}'))
      .join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  parts.push(`curl -X ${ep.method} '${url}'`)
  if (ep.auth) {
    const type = ep.auth.type
    const dets = ep.auth.details ?? []
    const get = (key: string) => dets.find((d) => d.key === key)?.value ?? '{{' + key + '}}'
    if (type === 'bearer') parts.push(`  -H 'Authorization: Bearer ${get('token')}'`)
    else if (type === 'basic') parts.push(`  -u '${get('username')}:${get('password')}'`)
    else if (type === 'apikey') parts.push(`  -H '${get('key')}: ${get('value')}'`)
    else if (type === 'oauth2') parts.push(`  -H 'Authorization: Bearer {{access_token}}'`)
  }
  ;(ep.headers ?? [])
    .filter((h) => h.key && h.key.toLowerCase() !== 'content-type')
    .forEach((h) => parts.push(`  -H '${h.key}: ${h.value}'`))
  if (ep.body != null) {
    const bodyIsEmpty = Array.isArray(ep.body) ? ep.body.length === 0 : !String(ep.body).trim()
    if (!bodyIsEmpty) {
      if (ep.bodyMode === 'raw') {
        parts.push(`  -H 'Content-Type: ${ep.bodyContentType ?? 'application/json'}'`)
        parts.push(`  -d '${String(ep.body).replace(/'/g, "'\\''")}'`)
      } else if (ep.bodyMode === 'urlencoded') {
        String(ep.body).split('&').forEach((f) => parts.push(`  --data-urlencode '${f}'`))
      }
    }
  }
  return parts.join(' \\\n')
}

// ── Markdown ────────────────────────────────────────────────────────────────

type InlineNode = { type: 'text'; text: string } | { type: 'strong'; children: InlineNode[] } | { type: 'em'; children: InlineNode[] } | { type: 'code'; text: string }

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end !== -1) { nodes.push({ type: 'strong', children: parseInline(text.slice(i + 2, end)) }); i = end + 2; continue }
    }
    if (text[i] === '*') {
      const end = text.indexOf('*', i + 1)
      if (end !== -1) { nodes.push({ type: 'em', children: parseInline(text.slice(i + 1, end)) }); i = end + 1; continue }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) { nodes.push({ type: 'code', text: text.slice(i + 1, end) }); i = end + 1; continue }
    }
    const next = text.slice(i).search(/\*\*|\*|`/)
    if (next === -1) { nodes.push({ type: 'text', text: text.slice(i) }); break }
    nodes.push({ type: 'text', text: text.slice(i, i + next) }); i += next
  }
  return nodes
}

function RenderInline({ nodes }: { nodes: InlineNode[] }): React.ReactElement {
  return (
    <>
      {nodes.map((n, i) =>
        n.type === 'text' ? <span key={i}>{n.text}</span>
        : n.type === 'strong' ? <strong key={i}><RenderInline nodes={n.children} /></strong>
        : n.type === 'em' ? <em key={i}><RenderInline nodes={n.children} /></em>
        : <code key={i} className={styles.mdCode}>{n.text}</code>
      )}
    </>
  )
}

function MarkdownView({ text }: { text: string }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Table
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const rows: string[][] = []
      let isSep = false
      let j = i
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        const row = lines[j].trim()
        if (/^\|[\s\-:|]+\|$/.test(row)) { isSep = true; j++; continue }
        rows.push(row.slice(1, -1).split('|').map((c) => c.trim()))
        j++
      }
      const [head, ...body] = rows
      elements.push(
        <table key={key++} className={styles.mdTable}>
          {head && <thead><tr>{head.map((c, ci) => <th key={ci}>{c}</th>)}</tr></thead>}
          {body.length > 0 && <tbody>{body.map((row, ri) => <tr key={ri}>{row.map((c, ci) => <td key={ci}>{c}</td>)}</tr>)}</tbody>}
        </table>
      )
      i = j; continue
    }

    // Blank
    if (!trimmed) { i++; continue }

    // HR
    if (/^[-*_]{3,}$/.test(trimmed)) { elements.push(<hr key={key++} className={styles.mdHr} />); i++; continue }

    // Heading
    const hm = trimmed.match(/^(#{1,6})\s+(.+)/)
    if (hm) {
      const level = hm[1].length
      const Tag = (level <= 2 ? 'h3' : 'h4') as 'h3' | 'h4'
      elements.push(<Tag key={key++} className={level <= 2 ? styles.mdH3 : styles.mdH4}>{hm[2]}</Tag>)
      i++; continue
    }

    // List
    const ulm = trimmed.match(/^[-*+]\s+(.+)/)
    const olm = trimmed.match(/^\d+\.\s+(.+)/)
    if (ulm || olm) {
      const isOl = !!olm
      const items: string[] = []
      while (i < lines.length && (lines[i].trim().match(/^[-*+]\s+/) || lines[i].trim().match(/^\d+\.\s+/))) {
        const m = lines[i].trim().match(/^(?:[-*+]|\d+\.)\s+(.+)/)
        if (m) items.push(m[1])
        i++
      }
      const ListTag = isOl ? 'ol' : 'ul'
      elements.push(
        <ListTag key={key++} className={isOl ? styles.mdOl : styles.mdUl}>
          {items.map((item, li) => <li key={li} className={styles.mdLi}><RenderInline nodes={parseInline(item)} /></li>)}
        </ListTag>
      )
      continue
    }

    // Paragraph
    elements.push(<p key={key++} className={styles.mdP}><RenderInline nodes={parseInline(trimmed)} /></p>)
    i++
  }

  return <div className={styles.mdWrap}>{elements}</div>
}

// ── Highlighted name ────────────────────────────────────────────────────────

function HighlightedName({ text, positions }: { text: string; positions: Set<number> }) {
  if (!positions.size) return <span className={styles.epName}>{text}</span>
  return (
    <span className={styles.epName}>
      {Array.from(text).map((ch, i) =>
        positions.has(i) ? <mark key={i} style={{ background: 'none', color: 'var(--accent)', fontWeight: 700 }}>{ch}</mark> : ch
      )}
    </span>
  )
}

// ── Method Badge ────────────────────────────────────────────────────────────

function MethodBadge({ method, large }: { method: string; large?: boolean }) {
  return (
    <span className={`${styles.methodBadge} ${styles[method] ?? ''} ${large ? styles.detailMethodBadge : ''}`}>
      {method}
    </span>
  )
}

// ── Code Block (with JSON highlighting) ────────────────────────────────────

type JsonToken = { t: 'key' | 'str' | 'num' | 'lit' | 'plain'; v: string }

function tokenizeJson(code: string): JsonToken[] {
  const tokens: JsonToken[] = []
  const re = /"([^"\n]+)"(\s*:)|: "([^"\n]*)"|: (-?\d+\.?\d*)\b|: (true|false|null)\b/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) tokens.push({ t: 'plain', v: code.slice(last, m.index) })
    if (m[1] !== undefined) { tokens.push({ t: 'plain', v: '"' }); tokens.push({ t: 'key', v: m[1] }); tokens.push({ t: 'plain', v: '"' + m[2] }) }
    else if (m[3] !== undefined) { tokens.push({ t: 'plain', v: ': "' }); tokens.push({ t: 'str', v: m[3] }); tokens.push({ t: 'plain', v: '"' }) }
    else if (m[4] !== undefined) { tokens.push({ t: 'plain', v: ': ' }); tokens.push({ t: 'num', v: m[4] }) }
    else if (m[5] !== undefined) { tokens.push({ t: 'plain', v: ': ' }); tokens.push({ t: 'lit', v: m[5] }) }
    last = m.index + m[0].length
  }
  if (last < code.length) tokens.push({ t: 'plain', v: code.slice(last) })
  return tokens
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const isJson = code.trim().startsWith('{') || code.trim().startsWith('[')
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  let content: React.ReactNode = code
  if (isJson) {
    try {
      const tokens = tokenizeJson(code)
      const clsMap: Record<string, string> = { key: styles.hlKey, str: styles.hlStr, num: styles.hlNum, lit: styles.hlLit }
      content = tokens.map((tok, i) =>
        tok.t === 'plain' ? tok.v : <span key={i} className={clsMap[tok.t]}>{tok.v}</span>
      )
    } catch { content = code }
  }
  return (
    <div className={styles.codeWrap}>
      <pre className={styles.codeBlock}>{content}</pre>
      <button className={styles.copyBtn} onClick={copy}>{copied ? '✓' : 'Copiar'}</button>
    </div>
  )
}

// ── Collapsible Section ─────────────────────────────────────────────────────

function Section({ title, count, startOpen = false, children }: { title: string; count?: number; startOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className={styles.sect}>
      <button className={styles.sectHd} onClick={() => setOpen((v) => !v)}>
        <span className={`${styles.sectArrow} ${open ? styles.sectArrowOpen : ''}`}>›</span>
        <span className={styles.sectTitle}>{title}</span>
        {count != null && <span className={styles.sectCnt}>{count}</span>}
      </button>
      <div className={`${styles.sectBody} ${open ? styles.sectBodyOpen : ''}`}>{children}</div>
    </div>
  )
}

// ── Param Table ─────────────────────────────────────────────────────────────

function ParamTable({ params }: { params: CollectionParam[] }) {
  const pinClass: Record<string, string> = {
    path: styles.pinPath,
    query: styles.pinQuery,
    header: styles.pinHeader,
    cookie: styles.pinCookie,
  }
  return (
    <table className={styles.paramTable}>
      <thead>
        <tr>
          <th>Nome</th><th>Tipo</th><th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p, i) => (
          <tr key={i}>
            <td>
              <span className={styles.pname}>{p.name}</span>
              {p.required && <span className={styles.preq}>req</span>}
              {p.in && <span className={`${styles.pin} ${pinClass[p.in] ?? ''}`}>{p.in}</span>}
            </td>
            <td>
              <span className={styles.ptype}>
                {p.type}{p.format ? ` (${p.format})` : ''}{p.enum ? ` [${p.enum.join('|')}]` : ''}
              </span>
            </td>
            <td className={styles.pdesc}>
              {p.desc && <div>{p.desc}</div>}
              {p.example !== undefined && <span className={styles.pex}>{String(p.example)}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Response Tabs ───────────────────────────────────────────────────────────

function ResponseTabs({ responses }: { responses: NonNullable<CollectionEndpoint['responses']> }) {
  const [active, setActive] = useState(responses[0]?.status ?? '')
  const cur = responses.find((r) => r.status === active)
  const tabCls = (r: { status: string }) => {
    const isActive = r.status === active
    const s = r.status
    if (isActive) {
      if (s.startsWith('2')) return `${styles.respTab} ${styles.respTabActiveS2xx}`
      if (s.startsWith('4')) return `${styles.respTab} ${styles.respTabActiveS4xx}`
      if (s.startsWith('5')) return `${styles.respTab} ${styles.respTabActiveS5xx}`
      return `${styles.respTab} ${styles.respTabActive}`
    }
    return styles.respTab
  }
  return (
    <>
      <div className={styles.respTabs}>
        {responses.map((r) => (
          <button key={r.status} className={tabCls(r)} onClick={() => setActive(r.status)}>
            {r.status}{r.statusText ? ` ${r.statusText}` : ''}
          </button>
        ))}
      </div>
      {cur?.desc && <p className={styles.respDesc}>{cur.desc}</p>}
      {cur?.example && <CodeBlock code={cur.example} />}
    </>
  )
}

// ── Endpoint Detail ─────────────────────────────────────────────────────────

function ResponsesSection({ ep }: { ep: CollectionEndpoint }) {
  const examples = ep.examples ?? []
  const responses = ep.responses ?? []
  const hasExamples = examples.length > 0
  const hasResponses = !hasExamples && responses.length > 0
  const count = hasExamples ? examples.length : hasResponses ? responses.length : null
  const [activeTab, setActiveTab] = useState(0)

  const tabCls = (idx: number, status: string) => {
    const isActive = idx === activeTab
    if (!isActive) return styles.respTab
    if (status.startsWith('2')) return `${styles.respTab} ${styles.respTabActiveS2xx}`
    if (status.startsWith('4')) return `${styles.respTab} ${styles.respTabActiveS4xx}`
    if (status.startsWith('5')) return `${styles.respTab} ${styles.respTabActiveS5xx}`
    return `${styles.respTab} ${styles.respTabActive}`
  }

  return (
    <Section title="Respostas" count={count ?? undefined} startOpen>
      {hasExamples ? (
        <>
          <div className={styles.respTabs}>
            {examples.map((ex, i) => {
              const label = ex.status + (ex.statusText ? ' ' + ex.statusText : '') + (examples.length > 1 ? ' · ' + ex.name : '')
              return <button key={i} className={tabCls(i, ex.status)} onClick={() => setActiveTab(i)}>{label}</button>
            })}
          </div>
          {examples[activeTab] && (() => {
            const ex = examples[activeTab]
            return (
              <>
                {ex.requestBody && (
                  <div className={styles.exampleSection}>
                    <div className={styles.exampleSectionTitle}>Request Body</div>
                    <CodeBlock code={ex.requestBody} />
                  </div>
                )}
                {ex.body && ex.body.trim() && (
                  <div className={styles.exampleSection}>
                    <div className={styles.exampleSectionTitle}>Response Body</div>
                    <CodeBlock code={ex.body} />
                  </div>
                )}
                {ex.headers && Object.keys(ex.headers).length > 0 && (
                  <div className={styles.exampleSection}>
                    <div className={styles.exampleSectionTitle}>Response Headers</div>
                    <table className={styles.hdrsTable}>
                      <tbody>
                        {Object.entries(ex.headers).map(([k, v], i) => (
                          <tr key={i}><td>{k}</td><td>{v}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          })()}
        </>
      ) : hasResponses ? (
        <>
          <div className={styles.respTabs}>
            {responses.map((r, i) => (
              <button key={i} className={tabCls(i, r.status)} onClick={() => setActiveTab(i)}>
                {r.status}{r.statusText ? ' ' + r.statusText : ''}
              </button>
            ))}
          </div>
          {responses[activeTab] && (
            <>
              {responses[activeTab].desc && <p className={styles.respDesc}>{responses[activeTab].desc}</p>}
              {responses[activeTab].example && responses[activeTab].example!.trim() && (
                <CodeBlock code={responses[activeTab].example!} />
              )}
            </>
          )}
        </>
      ) : (
        <div className={styles.respEmpty}>
          Esta coleção Postman não possui exemplos de resposta salvos para este endpoint.
          <span className={styles.respEmptySub}>Para adicionar: execute no Postman → selecione a resposta → "Save as Example".</span>
        </div>
      )}
    </Section>
  )
}

function EndpointDetail({ ep }: { ep: FlatEndpoint }) {
  const [curlCopied, setCurlCopied] = useState(false)
  const allParams = ep.params ?? []
  const curlStr = buildCurl(ep)

  const copyCurl = () => {
    navigator.clipboard.writeText(curlStr).then(() => {
      setCurlCopied(true)
      setTimeout(() => setCurlCopied(false), 1500)
    })
  }

  const hasAuth = ep.auth || (ep.security && ep.security.length > 0)

  const pinClass: Record<string, string> = {
    path: styles.pinPath, query: styles.pinQuery, header: styles.pinHeader, cookie: styles.pinCookie,
  }
  const paramGroups = [
    { label: 'Path',   cls: 'path',   list: allParams.filter((p) => p.in === 'path') },
    { label: 'Query',  cls: 'query',  list: allParams.filter((p) => p.in === 'query') },
    { label: 'Header', cls: 'header', list: allParams.filter((p) => p.in === 'header') },
    { label: 'Cookie', cls: 'cookie', list: allParams.filter((p) => p.in === 'cookie') },
    { label: 'Outros', cls: 'query',  list: allParams.filter((p) => !p.in) },
  ].filter((g) => g.list.length > 0)

  const reqHeaders = (ep.headers ?? []).filter((h) => h.key && !h.key.match(/^(content-type|authorization)$/i))

  return (
    <div className={styles.detail}>
      {/* Breadcrumb */}
      {ep.folderPath.length > 0 && (
        <div className={styles.breadcrumb}>
          {ep.folderPath.map((seg, i) => (
            <span key={i}>
              {i > 0 && <span className={styles.breadcrumbSep}>›</span>}
              <span className={styles.breadcrumbItem}>{seg}</span>
            </span>
          ))}
        </div>
      )}

      {/* Deprecated */}
      {ep.deprecated && (
        <div className={styles.deprecatedBanner}>⚠ Este endpoint está depreciado e pode ser removido em versões futuras.</div>
      )}

      {/* Method + path + cURL */}
      <div className={styles.detailMethodPath}>
        <MethodBadge method={ep.method} large />
        <span className={styles.detailPath}>{ep.path}</span>
        <button className={styles.curlCopyBtn} onClick={copyCurl}>
          {curlCopied ? 'Copiado ✓' : 'Copiar cURL'}
        </button>
      </div>

      <div className={styles.detailName}>{ep.name}</div>
      {ep.operationId && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>{ep.operationId}</div>
      )}

      {ep.desc && <MarkdownView text={ep.desc} />}

      {/* Auth / Security */}
      {hasAuth && (
        <Section title="Autenticação" startOpen>
          <div className={styles.authBlock}>
            <span className={styles.authIcon}>🔒</span>
            <div>
              {ep.auth && (
                <>
                  <div className={styles.authType}>
                    {ep.auth.type.charAt(0).toUpperCase() + ep.auth.type.slice(1)}
                  </div>
                  {ep.auth.details && ep.auth.details.filter((d) => d.value && d.key !== 'token').length > 0 && (
                    <div className={styles.authDetail}>
                      {ep.auth.details.filter((d) => d.value && d.key !== 'token').map((d) => `${d.key}: ${d.value}`).join(' · ')}
                    </div>
                  )}
                </>
              )}
              {ep.security && ep.security.map((sec, i) =>
                Object.entries(sec).map(([scheme, scopes]) => (
                  <div key={i + scheme}>
                    <div className={styles.authType}>{scheme}</div>
                    {scopes.length > 0 && <div className={styles.authDetail}>Escopos: {scopes.join(', ')}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Parameters — grouped */}
      {allParams.length > 0 && (
        <Section title="Parâmetros" count={allParams.length} startOpen>
          {paramGroups.map((g) => (
            <div key={g.label} className={styles.paramGroup}>
              <div className={styles.paramGroupLbl}>
                <span className={`${styles.pin} ${pinClass[g.cls] ?? ''}`}>{g.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{g.list.length} parâmetro{g.list.length > 1 ? 's' : ''}</span>
              </div>
              <ParamTable params={g.list} />
            </div>
          ))}
        </Section>
      )}

      {/* Request Headers */}
      {reqHeaders.length > 0 && (
        <Section title="Headers da Requisição" count={reqHeaders.length}>
          <table className={styles.hdrsTable}>
            <tbody>
              {reqHeaders.map((h, i) => (
                <tr key={i}>
                  <td>{h.key}</td>
                  <td>
                    {h.value}
                    {h.desc && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{h.desc}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Body */}
      {ep.body != null && (() => {
        const bodyIsEmpty = Array.isArray(ep.body) ? ep.body.length === 0 : !String(ep.body).trim()
        if (bodyIsEmpty) return null
        return (
          <Section title="Request Body" startOpen>
            {ep.bodyContentType && <span className={styles.bodyContentType}>{ep.bodyContentType}</span>}
            <CodeBlock code={typeof ep.body === 'string' ? ep.body : JSON.stringify(ep.body, null, 2)} />
          </Section>
        )
      })()}

      {/* Responses (unified) */}
      <ResponsesSection ep={ep} />

      {/* cURL */}
      <Section title="cURL" startOpen>
        <CodeBlock code={curlStr} />
      </Section>
    </div>
  )
}

// ── Folder Node ─────────────────────────────────────────────────────────────

function FolderNodeView({
  node,
  depth,
  activeEpId,
  onSelect,
  openFolderIds,
  onToggleFolder,
}: {
  node: FolderNode
  depth: number
  activeEpId: string | null
  onSelect: (ep: CollectionEndpoint) => void
  openFolderIds: Set<string>
  onToggleFolder: (id: string) => void
}) {
  const open = openFolderIds.has(node.id)
  const INDENT = 18
  const BASE = 6
  const rowPad = BASE + depth * INDENT
  const epPad = BASE + (depth + 1) * INDENT + 2
  const labelCls = depth === 0 ? styles.flD0 : depth === 1 ? styles.flD1 : styles.flD2

  return (
    <div>
      <button
        className={styles.folderRow}
        style={{ paddingLeft: rowPad }}
        onClick={() => onToggleFolder(node.id)}
      >
        <span className={`${styles.folderArrow} ${open ? styles.folderArrowOpen : ''}`}>›</span>
        <span className={labelCls}>{node.name}</span>
        <span className={styles.folderCount}>{node.eps.length + node.children.reduce((s, c) => s + c.eps.length, 0)}</span>
      </button>

      <div className={`${styles.folderChildren} ${open ? styles.folderChildrenOpen : ''}`} style={{ position: 'relative' }}>
        <div className={styles.folderGuide} style={{ left: rowPad + 7 }} />

        {node.children.map((child) => (
          <FolderNodeView
            key={child.id}
            node={child}
            depth={depth + 1}
            activeEpId={activeEpId}
            onSelect={onSelect}
            openFolderIds={openFolderIds}
            onToggleFolder={onToggleFolder}
          />
        ))}

        {node.eps.map((ep) => (
          <button
            key={ep.id}
            id={`ep-${ep.id}`}
            className={`${styles.epItem} ${ep.id === activeEpId ? styles.epItemActive : ''}`}
            style={{ paddingLeft: epPad }}
            onClick={() => onSelect(ep)}
          >
            <MethodBadge method={ep.method} />
            <span className={styles.epName}>{ep.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: (id: number, name: string) => void }) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [text, setText] = useState('')
  const [collName, setCollName] = useState('')
  const [error, setError] = useState('')
  const [dragover, setDragover] = useState(false)
  const [isPending, startTransition] = useTransition()

  const readFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string ?? ''
      setText(content)
      if (!collName) {
        // Try to extract name from JSON
        try {
          const json = JSON.parse(content)
          const name = json.info?.name || json.info?.title || f.name.replace(/\.(json|yaml|yml)$/i, '')
          setCollName(name)
        } catch {
          setCollName(f.name.replace(/\.(json|yaml|yml)$/i, ''))
        }
      }
    }
    reader.readAsText(f)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) readFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragover(false)
    const f = e.dataTransfer.files[0]
    if (f) { readFile(f); setTab('paste') }
  }

  const doImport = () => {
    setError('')
    const sizeMb = new Blob([text]).size / (1024 * 1024)
    if (sizeMb > 19) {
      setError(`Arquivo muito grande (${sizeMb.toFixed(1)} MB). Limite: 20 MB.`)
      return
    }
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { setError('JSON inválido'); return }
    startTransition(async () => {
      try {
        const created = await importCollection(collName.trim() || 'Collection', parsed)
        onImported(created.id, created.name)
      } catch (e) {
        const msg = String(e)
        if (msg.includes('Body exceeded') || msg.includes('too large'))
          setError(`Arquivo muito grande (${sizeMb.toFixed(1)} MB). Limite do servidor excedido.`)
        else
          setError('Erro ao importar: ' + msg)
      }
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>Importar collection</div>
        <div className={styles.modalSub}>Postman v2.0 / v2.1 · OpenAPI / Swagger 2.0 / 3.0</div>
        <input
          value={collName}
          onChange={(e) => setCollName(e.target.value)}
          placeholder="Nome da collection"
          style={{ width: '100%', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <div className={styles.modalTabs}>
          <button className={`${styles.modalTab} ${tab === 'file' ? styles.modalTabActive : ''}`} onClick={() => setTab('file')}>Arquivo</button>
          <button className={`${styles.modalTab} ${tab === 'paste' ? styles.modalTabActive : ''}`} onClick={() => setTab('paste')}>Colar JSON</button>
        </div>

        {tab === 'file' ? (
          <div
            className={`${styles.dropArea} ${dragover ? styles.dropAreaDragover : ''}`}
            onClick={() => document.getElementById('col-file-input')?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragover(true) }}
            onDragLeave={() => setDragover(false)}
            onDrop={handleDrop}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <strong>Clique ou arraste o arquivo aqui</strong><br />.json · .yaml · .yml
          </div>
        ) : (
          <textarea
            className={styles.pasteInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole o JSON aqui…"
            rows={7}
          />
        )}

        <input type="file" id="col-file-input" accept=".json,.yaml,.yml" style={{ display: 'none' }} onChange={handleFile} />

        {error && <div className={styles.errorMsg}>{error}</div>}
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>Cancelar</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={doImport} disabled={!text.trim() || isPending}>
            {isPending ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Collection Switcher ──────────────────────────────────────────────────────

function CollectionSwitcher({
  collections,
  activeId,
  onSelect,
  onDelete,
  onImportClick,
  canEdit,
}: {
  collections: CollectionMeta[]
  activeId: number | null
  onSelect: (id: number) => void
  onDelete: (id: number) => void
  onImportClick: () => void
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const active = collections.find((c) => c.id === activeId)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setDeletingId(id)
    await deleteCollection(id)
    onDelete(id)
    setDeletingId(null)
  }

  const handleDownload = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setDownloadingId(id)
    try {
      const data = await getCollectionRawJson(id)
      if (!data?.rawJson) return
      const blob = new Blob([JSON.stringify(data.rawJson, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div ref={ref} className={`${styles.colSwitcher} ${open ? styles.colSwitcherOpen : ''}`}>
      <button className={styles.colSwitcherBtn} onClick={() => setOpen((v) => !v)}>
        <span className={styles.colSwitcherIcon}>⊞</span>
        <span className={`${styles.colSwitcherName} ${!active ? styles.colSwitcherPlaceholder : ''}`}>
          {active?.name ?? 'Selecione uma coleção'}
        </span>
        <span className={`${styles.colSwitcherArrow} ${open ? styles.colSwitcherArrowOpen : ''}`}>▾</span>
      </button>

      {open && (
        <div className={styles.colDropdown}>
          {collections.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma collection</div>
          )}
          {collections.map((c) => (
            <button
              key={c.id}
              className={`${styles.colDdItem} ${c.id === activeId ? styles.colDdItemActive : ''}`}
              onClick={() => { onSelect(c.id); setOpen(false) }}
            >
              <span className={styles.colDdCheck}>{c.id === activeId ? '✓' : ''}</span>
              <span className={styles.colDdName}>{c.name}</span>
              <span
                className={styles.colDdDel}
                onClick={(e) => handleDownload(e as unknown as React.MouseEvent, c.id)}
                title="Baixar JSON"
                style={{ opacity: downloadingId === c.id ? 0.4 : undefined, marginRight: canEdit ? 2 : 0 }}
              >
                ↓
              </span>
              {canEdit && (
                <span
                  className={styles.colDdDel}
                  onClick={(e) => handleDelete(e as unknown as React.MouseEvent, c.id)}
                  title="Deletar"
                  style={{ opacity: deletingId === c.id ? 0.4 : undefined }}
                >
                  ✕
                </span>
              )}
            </button>
          ))}
          {canEdit && (
            <>
              <div className={styles.colDdSep} />
              <button className={styles.colDdNew} onClick={() => { setOpen(false); onImportClick() }}>
                <span style={{ fontSize: 14 }}>＋</span> Importar collection
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const STORAGE_COL = 'col_sel_id'
const STORAGE_EP  = 'col_sel_ep'

// ── CollectionsClient ────────────────────────────────────────────────────────

export function CollectionsClient({
  collections: initialCollections,
  initialData,
}: {
  collections: CollectionMeta[]
  initialData: { id: number; name: string; structure: CollectionStructure } | null
}) {
  const { canEdit } = useRole()
  const [collections, setCollections] = useState(initialCollections)
  const [activeId, setActiveId] = useState<number | null>(initialData?.id ?? null)
  const [structure, setStructure] = useState<CollectionStructure | null>(initialData?.structure ?? null)
  const [activeEpId, setActiveEpId] = useState<string | null>(null)
  const [activeEp, setActiveEp] = useState<FlatEndpoint | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [loading, setLoading] = useState(false)
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set())

  const flatRef = useRef<FlatEndpoint[]>([])
  const isFirstStructureLoad = useRef(true)
  const isMountedRef = useRef(false)

  useEffect(() => {
    flatRef.current = structure ? buildFlat(structure.tree) : []
    setSearchQuery('')
    setActiveEp(null)
    setActiveEpId(null)
    setOpenFolderIds(new Set())

    // Restore saved endpoint on first collection load
    if (isFirstStructureLoad.current && structure && flatRef.current.length > 0) {
      isFirstStructureLoad.current = false
      const savedEpId = localStorage.getItem(STORAGE_EP)
      if (savedEpId) {
        const ep = flatRef.current.find((f) => f.id === savedEpId)
        if (ep) {
          setActiveEp(ep)
          setActiveEpId(ep.id)
          if (ep.folderPath.length > 0) {
            const nodes = getOpenFolderNodes(structure.tree, ep.folderPath)
            if (nodes.length > 0) setOpenFolderIds(new Set(nodes.map((n) => n.id)))
          }
          setTimeout(() => {
            document.getElementById(`ep-${ep.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }, 50)
        }
      }
    }
  }, [structure])

  // Persist active collection (skip first render — mount effect handles restoration)
  useEffect(() => {
    if (!isMountedRef.current) return
    if (activeId != null) localStorage.setItem(STORAGE_COL, String(activeId))
  }, [activeId])

  // Persist active endpoint
  useEffect(() => {
    if (activeEpId != null) localStorage.setItem(STORAGE_EP, activeEpId)
  }, [activeEpId])


  const loadCollection = useCallback(async (id: number) => {
    setLoading(true)
    const data = await getCollectionStructure(id)
    setStructure(data?.structure ?? null)
    setLoading(false)
  }, [])

  const handleSelect = (id: number) => {
    isFirstStructureLoad.current = true
    setActiveId(id)
    loadCollection(id)
  }

  // Restore saved collection on mount (may differ from server-rendered first collection)
  useEffect(() => {
    isMountedRef.current = true
    const savedId = localStorage.getItem(STORAGE_COL)
    if (!savedId) return
    const id = parseInt(savedId, 10)
    if (isNaN(id) || id === initialData?.id) return
    const exists = initialCollections.find((c) => c.id === id)
    if (exists) handleSelect(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = (id: number) => {
    const next = collections.filter((c) => c.id !== id)
    setCollections(next)
    if (activeId === id) {
      const first = next[0]
      if (first) { setActiveId(first.id); loadCollection(first.id) }
      else { setActiveId(null); setStructure(null) }
    }
  }

  const handleImported = async (id: number, name: string) => {
    setShowImport(false)
    setCollections((prev) => [{ id, name, createdAt: new Date() }, ...prev])
    setActiveId(id)
    await loadCollection(id)
  }

  const handleToggleFolder = useCallback((id: string) => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleEpSelect = (ep: CollectionEndpoint) => {
    const flat = flatRef.current.find((f) => f.id === ep.id)
    const resolved = flat ?? { ...ep, folderPath: [], _paramNames: '' }
    setActiveEp(resolved)
    setActiveEpId(ep.id)
    setSearchQuery('')
    if (structure && resolved.folderPath.length > 0) {
      const nodes = getOpenFolderNodes(structure.tree, resolved.folderPath)
      if (nodes.length > 0) {
        setOpenFolderIds((prev) => {
          const next = new Set(prev)
          nodes.forEach((n) => next.add(n.id))
          return next
        })
      }
    }
    setTimeout(() => {
      document.getElementById(`ep-${ep.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  }

  const isSearching = searchQuery.trim().length > 0
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return runFuzzySearch(searchQuery, flatRef.current)
  }, [searchQuery])

  if (collections.length === 0 && !showImport) {
    return (
      <div className={styles.emptyState} style={{ height: '100%' }}>
        <div className={styles.emptyIcon}>⊞</div>
        <div className={styles.emptyTitle}>Nenhuma collection importada</div>
        <p className={styles.emptyDesc}>Importe uma collection Postman ou OpenAPI para começar a explorar endpoints.</p>
        {canEdit && <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowImport(true)}>＋ Importar collection</button>}
      </div>
    )
  }

  return (
    <>
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={handleImported} />}

      <div className={styles.layout}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <CollectionSwitcher
              collections={collections}
              activeId={activeId}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onImportClick={() => setShowImport(true)}
              canEdit={canEdit}
            />
            <div className={styles.searchWrap}>
              <span className={styles.searchIcon}>⌕</span>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Fuzzy search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <span className={styles.searchCount}>{searchResults.length}</span>
              )}
              {isSearching && (
                <button className={styles.searchClear} onClick={() => setSearchQuery('')} title="Limpar">⌫</button>
              )}
            </div>
          </div>

          <div className={styles.sidebarTree}>
            {loading ? (
              <div className={styles.noResults}>Carregando…</div>
            ) : isSearching ? (
              searchResults.length === 0 ? (
                <div className={styles.noResults}>Nenhum resultado.</div>
              ) : (
                searchResults.map((ep) => (
                  <button
                    key={ep.id}
                    className={`${styles.epItem} ${styles.epItemSearchResult} ${ep.id === activeEpId ? styles.epItemActive : ''}`}
                    onClick={() => handleEpSelect(ep)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <MethodBadge method={ep.method} />
                      <HighlightedName text={ep.name} positions={ep.namePositions} />
                    </div>
                    {ep.folderPath.length > 0 && (
                      <div className={styles.searchCrumb}>
                        {ep.folderPath.join(' › ')}
                      </div>
                    )}
                  </button>
                ))
              )
            ) : structure ? (
              <>
                {structure.tree.eps.map((ep) => (
                  <button
                    key={ep.id}
                    className={`${styles.epItem} ${ep.id === activeEpId ? styles.epItemActive : ''}`}
                    style={{ paddingLeft: 8 }}
                    onClick={() => handleEpSelect(ep)}
                  >
                    <MethodBadge method={ep.method} />
                    <span className={styles.epName}>{ep.name}</span>
                  </button>
                ))}
                {structure.tree.children.map((child) => (
                  <FolderNodeView
                    key={child.id}
                    node={child}
                    depth={0}
                    activeEpId={activeEpId}
                    onSelect={handleEpSelect}
                    openFolderIds={openFolderIds}
                    onToggleFolder={handleToggleFolder}
                  />
                ))}
              </>
            ) : (
              <div className={styles.noResults}>Selecione uma collection.</div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className={styles.main}>
          {activeEp ? (
            <EndpointDetail ep={activeEp} />
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>←</div>
              <div className={styles.emptyTitle}>Selecione um endpoint</div>
              <p className={styles.emptyDesc}>Escolha um endpoint na barra lateral para ver seus detalhes.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
