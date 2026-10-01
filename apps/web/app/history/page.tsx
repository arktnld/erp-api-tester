import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Histórico' }

import { prisma, Prisma } from '@erp/db'
import { HistoryClient } from './history-client'
import { canSeeSecrets } from '@/lib/require-role'
import { redactExecution } from '@/lib/redact'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

function buildWhere(p: {
  company?: string
  endpoint?: string
  client?: string
  status?: string
  from?: string
  to?: string
  user?: string
}): Prisma.RequestHistoryWhereInput {
  const where: Prisma.RequestHistoryWhereInput = {}
  if (p.company) where.companyName = p.company
  if (p.endpoint) where.endpointName = p.endpoint
  if (p.client) where.clientName = p.client
  if (p.user) where.userEmail = p.user
  if (p.status) {
    const prefix = Number(p.status[0])
    where.statusCode = { gte: prefix * 100, lt: (prefix + 1) * 100 }
  }
  if (p.from || p.to) {
    where.createdAt = {}
    if (p.from) {
      const [y, m, d] = p.from.split('-').map(Number)
      where.createdAt.gte = new Date(y, m - 1, d)
    }
    if (p.to) {
      const [y, m, d] = p.to.split('-').map(Number)
      const to = new Date(y, m - 1, d)
      to.setHours(23, 59, 59, 999)
      where.createdAt.lte = to
    }
  }
  return where
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    company?: string
    endpoint?: string
    client?: string
    status?: string
    from?: string
    to?: string
    user?: string
  }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const where = buildWhere(params)

  const [rawHistory, total, companies, endpoints, clients, users, showSecrets] = await Promise.all([
    prisma.requestHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.requestHistory.count({ where }),
    prisma.requestHistory.findMany({
      distinct: ['companyName'],
      select: { companyName: true },
      orderBy: { companyName: 'asc' },
    }),
    prisma.requestHistory.findMany({
      distinct: ['endpointName'],
      select: { endpointName: true },
      orderBy: { endpointName: 'asc' },
    }),
    prisma.requestHistory.findMany({
      distinct: ['clientName'],
      select: { clientName: true },
      orderBy: { clientName: 'asc' },
    }),
    prisma.requestHistory.findMany({
      where: { userEmail: { not: null } },
      distinct: ['userEmail'],
      select: { userEmail: true },
      orderBy: { userEmail: 'asc' },
    }),
    canSeeSecrets(),
  ])
  // Rows recorded before headers were masked at write time still hold credentials.
  const history = showSecrets ? rawHistory : rawHistory.map(redactExecution)

  return (
    <HistoryClient
      history={history}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      companies={companies.map((r) => r.companyName).filter(Boolean) as string[]}
      endpoints={endpoints.map((r) => r.endpointName).filter(Boolean) as string[]}
      clients={clients.map((r) => r.clientName).filter(Boolean) as string[]}
      users={users.map((r) => r.userEmail).filter(Boolean) as string[]}
      currentFilters={{
        company: params.company ?? '',
        endpoint: params.endpoint ?? '',
        client: params.client ?? '',
        status: params.status ?? '',
        from: params.from ?? '',
        to: params.to ?? '',
        user: params.user ?? '',
      }}
    />
  )
}
