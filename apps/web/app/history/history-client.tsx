'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { PageHeader } from '@/components/ui/page-header'
import { Sheet } from '@/components/ui/sheet'
import { MethodBadge, StatusBadge } from '@/components/ui/badge'
import dynamic from 'next/dynamic'

const CodeBlock = dynamic(() => import('@/components/ui/code-block').then(m => ({ default: m.CodeBlock })), { ssr: false })
import { ExportButton } from '@/app/test/components/export-button'
import type { ExportData } from '@/app/test/lib/types'
import { tryPrettyJson } from '@/lib/utils'

type HistoryItem = {
  id: number
  erpName: string
  companyName: string
  endpointName: string
  clientName: string
  method: string
  url: string
  requestBody: string
  requestHeaders: string
  statusCode: number
  responseBody: string
  responseHeaders: string
  durationMs: number
  createdAt: Date
  userEmail?: string | null
}

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: active ? 500 : 400,
  color: active ? 'var(--text)' : 'var(--text-muted)',
  borderTop: 'none',
  borderLeft: 'none',
  borderRight: 'none',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  background: 'none',
  cursor: 'pointer',
})

const filterSelectStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 8px',
  fontSize: 13,
  color: 'var(--text)',
  backgroundColor: 'var(--surface-2)',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 6,
  cursor: 'pointer',
  outline: 'none',
  maxWidth: 180,
})

interface Filters {
  company: string
  endpoint: string
  client: string
  status: string
  from: string
  to: string
  user: string
}

interface Props {
  history: HistoryItem[]
  total: number
  page: number
  pageSize: number
  companies: string[]
  endpoints: string[]
  clients: string[]
  users: string[]
  currentFilters: Filters
}

export function HistoryClient({
  history,
  total,
  page,
  pageSize,
  companies,
  endpoints,
  clients,
  users,
  currentFilters,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<HistoryItem | null>(null)
  const [tab, setTab] = useState<'response' | 'request' | 'req-headers' | 'res-headers'>('response')

  const totalPages = Math.ceil(total / pageSize)
  const hasActiveFilters = ['company', 'endpoint', 'client', 'status', 'from', 'to', 'user']
    .some((k) => searchParams.get(k))

  function navigate(updates: Partial<Filters> & { page?: number }) {
    const params = new URLSearchParams()
    const base: Record<string, string> = { ...currentFilters }
    const overrides = Object.fromEntries(
      Object.entries(updates).map(([k, v]) => [k, String(v ?? '')])
    )
    const merged = { ...base, ...overrides }
    // Reset to page 1 when a filter changes (not when page is explicitly set)
    const newPage = 'page' in updates ? String(updates.page) : '1'
    Object.entries(merged).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    if (newPage !== '1') params.set('page', newPage)
    router.push(`/history?${params.toString()}`)
  }

  const columns: ColumnDef<HistoryItem, unknown>[] = [
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge code={row.original.statusCode} />,
    },
    {
      id: 'method',
      header: 'Método',
      cell: ({ row }) => <MethodBadge method={row.original.method} />,
    },
    { accessorKey: 'erpName', header: 'ERP' },
    { accessorKey: 'endpointName', header: 'Endpoint' },
    { accessorKey: 'companyName', header: 'Empresa' },
    {
      accessorKey: 'clientName',
      header: 'Cliente',
      cell: ({ getValue }) => (
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'userEmail',
      header: 'Usuário',
      cell: ({ getValue }) => (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {(getValue() as string | null | undefined) ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'durationMs',
      header: 'Tempo',
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
          {getValue() as number}ms
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Data',
      cell: ({ getValue }) => (
        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          {new Date(getValue() as Date).toLocaleString('pt-BR')}
        </span>
      ),
    },
    {
      id: 'view',
      header: '',
      cell: ({ row }) => (
        <button
          onClick={() => { setSelected(row.original); setTab('response') }}
          style={{
            fontSize: 12,
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 8px',
            borderRadius: 4,
          }}
        >
          Ver
        </button>
      ),
    },
  ]

  return (
    <div style={{ padding: '32px 40px' }}>
      <PageHeader
        title="Histórico"
        description={`${total} ${total !== 1 ? 'requisições' : 'requisição'} no total`}
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select
          value={currentFilters.company}
          onChange={(e) => navigate({ company: e.target.value, endpoint: '', client: '' })}
          style={filterSelectStyle(!!currentFilters.company)}
        >
          <option value="">Todas as empresas</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={currentFilters.endpoint}
          onChange={(e) => navigate({ endpoint: e.target.value, client: '' })}
          style={filterSelectStyle(!!currentFilters.endpoint)}
        >
          <option value="">Todos os endpoints</option>
          {endpoints.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        <select
          value={currentFilters.client}
          onChange={(e) => navigate({ client: e.target.value })}
          style={filterSelectStyle(!!currentFilters.client)}
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={currentFilters.status}
          onChange={(e) => navigate({ status: e.target.value })}
          style={filterSelectStyle(!!currentFilters.status)}
        >
          <option value="">Todos os status</option>
          <option value="2xx">2xx — Sucesso</option>
          <option value="3xx">3xx — Redirect</option>
          <option value="4xx">4xx — Erro cliente</option>
          <option value="5xx">5xx — Erro servidor</option>
        </select>

        <input
          type="date"
          value={currentFilters.from}
          onChange={(e) => navigate({ from: e.target.value })}
          style={filterSelectStyle(!!currentFilters.from)}
          title="Data início"
        />

        <input
          type="date"
          value={currentFilters.to}
          onChange={(e) => navigate({ to: e.target.value })}
          style={filterSelectStyle(!!currentFilters.to)}
          title="Data fim"
        />

        <select
          value={currentFilters.user}
          onChange={(e) => navigate({ user: e.target.value })}
          style={filterSelectStyle(!!currentFilters.user)}
        >
          <option value="">Todos os usuários</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => router.push('/history')}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              color: 'var(--text-muted)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <DataTable
          data={history}
          columns={columns}
          searchPlaceholder="Buscar nesta página..."
        />

        {/* Pagination controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}>
          <button
            onClick={() => navigate({ page: page - 1 })}
            disabled={page <= 1}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              color: page <= 1 ? 'var(--text-subtle)' : 'var(--text)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.4 : 1,
            }}
          >
            ← Anterior
          </button>

          <span>
            Página {page} de {totalPages || 1}
            {hasActiveFilters && ` · ${total} resultado${total !== 1 ? 's' : ''}`}
          </span>

          <button
            onClick={() => navigate({ page: page + 1 })}
            disabled={page >= totalPages}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              color: page >= totalPages ? 'var(--text-subtle)' : 'var(--text)',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.4 : 1,
            }}
          >
            Próxima →
          </button>
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Detalhes da Requisição" width={600}>
        {selected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MethodBadge method={selected.method} />
              <StatusBadge code={selected.statusCode} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {selected.durationMs}ms
              </span>
              <div style={{ marginLeft: 'auto' }}>
                <ExportButton data={{
                  method: selected.method,
                  url: selected.url,
                  erpName: selected.erpName,
                  companyName: selected.companyName,
                  status: selected.statusCode,
                  duration: selected.durationMs,
                  timestamp: new Date(selected.createdAt),
                  requestBody: selected.requestBody || null,
                  responseBody: selected.responseBody || null,
                } satisfies ExportData} />
              </div>
            </div>

            <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, wordBreak: 'break-all', lineHeight: 1.5 }}>
              {selected.url}
            </p>

            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-subtle)', marginBottom: 16 }}>
              <span>{selected.erpName}</span>
              <span>·</span>
              <span>{selected.companyName}</span>
              <span>·</span>
              <span>{selected.clientName}</span>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              <button style={tabBtnStyle(tab === 'response')} onClick={() => setTab('response')}>Resposta</button>
              <button style={tabBtnStyle(tab === 'request')} onClick={() => setTab('request')}>Request Body</button>
              <button style={tabBtnStyle(tab === 'req-headers')} onClick={() => setTab('req-headers')}>Req Headers</button>
              <button style={tabBtnStyle(tab === 'res-headers')} onClick={() => setTab('res-headers')}>Res Headers</button>
            </div>

            {tab === 'response' && (
              <CodeBlock language="json" customStyle={{ borderRadius: 8, fontSize: 12, maxHeight: 420, backgroundColor: 'var(--surface-2)' }}>
                {tryPrettyJson(selected.responseBody) || '—'}
              </CodeBlock>
            )}
            {tab === 'request' && (
              <CodeBlock language="json" customStyle={{ borderRadius: 8, fontSize: 12, maxHeight: 420, backgroundColor: 'var(--surface-2)' }}>
                {tryPrettyJson(selected.requestBody || '{}')}
              </CodeBlock>
            )}
            {(tab === 'req-headers' || tab === 'res-headers') && (
              <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: 8, padding: '12px 16px', maxHeight: 420, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(JSON.parse(tab === 'req-headers' ? selected.requestHeaders : selected.responseHeaders) as Record<string, string>).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 0', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', width: '40%', paddingRight: 12, verticalAlign: 'top' }}>{k}</td>
                        <td style={{ padding: '6px 0', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
