'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Zap } from 'lucide-react'

type SidebarEndpoint = { id: number; name: string; method: string; pathTemplate: string }
type SidebarCompany = { id: number; name: string }
type SidebarERP = { id: number; name: string; companies: SidebarCompany[]; endpoints: SidebarEndpoint[] }

type NavResult = { type: 'erp' | 'company' | 'endpoint'; id: number; label: string; sublabel: string; href: string }
type TestResult = { type: 'test'; endpointId: number; companyId: number; label: string; sublabel: string; href: string }
type Result = NavResult | TestResult

function matchAll(haystack: string, terms: string[]): boolean {
  return terms.every((t) => haystack.includes(t))
}

function buildResults(erps: SidebarERP[], query: string): Result[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const testResults: TestResult[] = []
  const navResults: NavResult[] = []

  for (const erp of erps) {
    if (matchAll(erp.name.toLowerCase(), terms)) {
      navResults.push({ type: 'erp', id: erp.id, label: erp.name, sublabel: 'ERP', href: `/erps/${erp.id}` })
    }

    for (const company of erp.companies) {
      const companyText = company.name.toLowerCase()
      if (matchAll(companyText, terms)) {
        navResults.push({ type: 'company', id: company.id, label: company.name, sublabel: erp.name, href: `/companies/${company.id}` })
      }
    }

    for (const endpoint of erp.endpoints) {
      const epText = `${endpoint.name} ${endpoint.pathTemplate}`.toLowerCase()
      const epMatchesSome = terms.some((t) => epText.includes(t))

      if (matchAll(epText, terms)) {
        navResults.push({
          type: 'endpoint',
          id: endpoint.id,
          label: `${endpoint.method} ${endpoint.name}`,
          sublabel: endpoint.pathTemplate,
          href: `/test?erpId=${erp.id}&endpointId=${endpoint.id}`,
        })
      }

      // Cross-match: só aparece quando query bate em partes dos dois (endpoint + empresa)
      if (epMatchesSome) {
        for (const company of erp.companies) {
          const companyText = company.name.toLowerCase()
          const companyMatchesSome = terms.some((t) => companyText.includes(t))
          if (companyMatchesSome && matchAll(`${epText} ${companyText}`, terms)) {
            testResults.push({
              type: 'test',
              endpointId: endpoint.id,
              companyId: company.id,
              label: `${endpoint.method} ${endpoint.name}`,
              sublabel: company.name,
              href: `/test?endpointId=${endpoint.id}&companyId=${company.id}`,
            })
          }
        }
      }
    }
  }

  // Resultados "testar direto" primeiro
  return [...testResults, ...navResults].slice(0, 12)
}

const METHOD_COLOR: Record<string, string> = {
  GET: 'var(--status-success)', POST: 'var(--accent)', PUT: 'var(--status-warning)', PATCH: 'var(--status-warning)', DELETE: 'var(--status-error)',
}

export function CommandPalette({ erps }: { erps: SidebarERP[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
        setSelected(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const results = query.length >= 1 ? buildResults(erps, query) : []

  const navigate = (href: string) => {
    router.push(href)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected].href)
  }

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 580, backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: results.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKeyDown}
            placeholder="endpoint, empresa, ERP... (ex: autorizar empresa x)"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14 }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((r, i) => {
              const key = r.type === 'test' ? `test-${r.endpointId}-${r.companyId}` : `${r.type}-${r.id}`
              const isTest = r.type === 'test'
              const method = r.label.split(' ')[0]
              const methodColor = METHOD_COLOR[method] ?? 'var(--text-muted)'

              return (
                <div
                  key={key}
                  onClick={() => navigate(r.href)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 16px', cursor: 'pointer',
                    backgroundColor: i === selected ? 'var(--surface-2)' : 'transparent',
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                    borderLeft: isTest ? '2px solid var(--accent)' : '2px solid transparent',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {(r.type === 'endpoint' || r.type === 'test') ? (
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: methodColor, marginRight: 6 }}>
                          {method}
                        </span>
                        {r.label.slice(method.length + 1)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{r.label}</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--text-subtle)', marginLeft: 8, fontFamily: r.type === 'endpoint' ? 'monospace' : 'inherit' }}>
                      {r.sublabel}
                    </span>
                  </div>
                  {isTest ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', padding: '2px 8px', backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)', borderRadius: 4, flexShrink: 0 }}>
                      <Zap size={10} />
                      testar
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)', padding: '2px 6px', backgroundColor: 'var(--surface-2)', borderRadius: 4, flexShrink: 0 }}>{r.type}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {query.length >= 1 && results.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
            Nenhum resultado para &quot;{query}&quot;
          </div>
        )}

        {query.length === 0 && (
          <div style={{ padding: '12px 16px', color: 'var(--text-subtle)', fontSize: 12 }}>
            Dica: combine endpoint + empresa para ir direto ao teste
          </div>
        )}
      </div>
    </div>
  )
}
