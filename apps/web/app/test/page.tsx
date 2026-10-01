import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Testar API' }

import { prisma } from '@erp/db'
import { TestPage } from './test-page'
import { canSeeSecrets } from '@/lib/require-role'
import { redactAuthConfig } from '@/lib/redact'

export const dynamic = 'force-dynamic'

export default async function TestRoute({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; endpointId?: string; clientId?: string }>
}) {
  const params = await searchParams
  const [rawErps, showSecrets] = await Promise.all([prisma.eRP.findMany({
    orderBy: { name: 'asc' },
    include: {
      endpoints: { orderBy: { sortOrder: 'asc' } },
      fieldSchemas: { select: { fieldName: true, defaultValue: true } },
      companies: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          baseUrl: true,
          environments: true,
          authType: true,
          authConfig: true,
          testClients: { orderBy: { name: 'asc' } },
        },
      },
    },
  }), canSeeSecrets()])
  const erps = showSecrets
    ? rawErps
    : rawErps.map((erp) => ({ ...erp, companies: erp.companies.map((c) => ({ ...c, authConfig: redactAuthConfig(c.authConfig) })) }))
  return (
    <TestPage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      erps={erps as any}
      initialCompanyId={params.companyId ? Number(params.companyId) : undefined}
      initialEndpointId={params.endpointId ? Number(params.endpointId) : undefined}
      initialClientId={params.clientId ? Number(params.clientId) : undefined}
    />
  )
}
