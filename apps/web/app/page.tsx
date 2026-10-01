import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Home' }

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@erp/db'
import { MethodBadge, StatusBadge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { RotateCcw, Building2, Server, Plug, ListChecks, FileText, History } from 'lucide-react'
import { GettingStarted } from '@/components/getting-started'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const count = await prisma.eRP.count()
  if (count === 0) redirect('/setup')

  const [recentHistory, companies, erpCount, endpointCount, playbookCount, historyCount, recordCount, companyCount, okCalls, userCount, clientCount] =
    await Promise.all([
      prisma.requestHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          method: true,
          statusCode: true,
          endpointName: true,
          companyName: true,
          clientName: true,
          durationMs: true,
          createdAt: true,
          companyId: true,
          endpointId: true,
          testClientId: true,
        },
      }),
      prisma.company.findMany({
        orderBy: { name: 'asc' },
        take: 8,
        select: { id: true, name: true, _count: { select: { testClients: true } } },
      }),
      prisma.eRP.count(),
      prisma.endpoint.count(),
      prisma.playbook.count(),
      prisma.requestHistory.count(),
      prisma.apiRecord.count(),
      prisma.company.count(),
      prisma.requestHistory.count({ where: { statusCode: { gte: 200, lt: 300 } } }),
      prisma.user.count(),
      prisma.testClient.count(),
    ])

  const startSteps = [
    { label: 'Cadastrar um ERP', done: erpCount > 0, href: '/setup', action: 'Começar' },
    { label: 'Cadastrar uma empresa com credenciais', done: companyCount > 0, href: '/companies', action: 'Nova empresa' },
    { label: 'Criar um cliente de teste', done: clientCount > 0, href: '/companies', action: 'Abrir empresas' },
    { label: 'Fazer a primeira chamada com sucesso', done: okCalls > 0, href: '/test', action: 'Testar API' },
    { label: 'Convidar o time', done: userCount > 1, href: '/settings', action: 'Criar usuário' },
    { label: 'Documentar um teste num registro', done: recordCount > 0, href: '/records', action: 'Novo registro' },
    { label: 'Criar um fluxo de passos encadeados', done: playbookCount > 0, href: '/playbooks', action: 'Novo fluxo' },
  ]

  const stats = [
    { label: 'ERPs', value: erpCount, href: '/erps', icon: Server },
    { label: 'Endpoints', value: endpointCount, href: '/erps', icon: Plug },
    { label: 'Empresas', value: companyCount, href: '/companies', icon: Building2 },
    { label: 'Fluxos', value: playbookCount, href: '/playbooks', icon: ListChecks },
    { label: 'Registros', value: recordCount, href: '/records', icon: FileText },
    { label: 'Requisições', value: historyCount, href: '/history', icon: History },
  ]

return (
    <div style={{ padding: '28px 40px' }}>
      <PageHeader title="Início" description="Visão geral do sistema" />
      <GettingStarted steps={startSteps} />

      {/* Stats — Gitea repository summary bar */}
      <div className="g-box" style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, marginBottom: 20 }}>
        {stats.map(({ label, value, href, icon: Icon }, i) => (
          <Link
            key={label}
            href={href}
            className="card-hover"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46,
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              color: 'var(--text)', textDecoration: 'none', fontSize: 14,
            }}
          >
            <Icon size={16} style={{ color: 'var(--text-muted)' }} />
            <strong style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{value}</strong>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20, alignItems: 'start' }}>
        {/* Recent requests */}
        <section className="g-box" aria-labelledby="recentes">
          <h2 id="recentes" className="g-box-header" style={{ justifyContent: 'space-between' }}>
            Últimas requisições
            {recentHistory.length > 0 && (
              <Link href="/history" style={{ fontSize: 13, fontWeight: 400, color: 'var(--link)', textDecoration: 'none' }}>Ver histórico</Link>
            )}
          </h2>
          {recentHistory.length === 0 ? (
            <p style={{ padding: '24px 20px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
              Nenhuma requisição ainda. Vá em{' '}
              <Link href="/test" style={{ color: 'var(--link)', textDecoration: 'none' }}>Testar API</Link>.
            </p>
          ) : (
            recentHistory.map((h) => {
              const repeatUrl =
                h.companyId && h.endpointId
                  ? h.testClientId
                    ? `/test?companyId=${h.companyId}&endpointId=${h.endpointId}&clientId=${h.testClientId}`
                    : `/test?companyId=${h.companyId}&endpointId=${h.endpointId}`
                  : null
              return (
                <div key={h.id} className="g-box-row">
                  <MethodBadge method={h.method} />
                  <StatusBadge code={h.statusCode} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.endpointName}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                      {[h.companyName, h.clientName, `${h.durationMs}ms`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {repeatUrl && (
                    <Link href={repeatUrl} className="btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', flexShrink: 0 }}>
                      <RotateCcw size={12} />
                      Repetir
                    </Link>
                  )}
                </div>
              )
            })
          )}
        </section>

        {/* Company shortcuts */}
        <section className="g-box" aria-labelledby="empresas">
          <h2 id="empresas" className="g-box-header">
            Empresas <span className="g-counter">{companyCount}</span>
          </h2>
          {companies.length === 0 ? (
            <p style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Nenhuma empresa</p>
          ) : (
            companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.id}`} className="g-box-row card-hover" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                <Building2 size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span className="g-counter" title={`${c._count.testClients} clientes de teste`}>{c._count.testClients}</span>
              </Link>
            ))
          )}
          {companyCount > companies.length && (
            <Link href="/companies" style={{ display: 'block', padding: '10px 14px', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: 13, color: 'var(--link)', textDecoration: 'none' }}>
              Ver todas as {companyCount} empresas
            </Link>
          )}
        </section>
      </div>
    </div>
  )
}
