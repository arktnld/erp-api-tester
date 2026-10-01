import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Empresas' }

import { prisma } from '@erp/db'
import { getCompanies } from '@/lib/actions/companies'
import { CompaniesClient } from './companies-client'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const [companies, erps] = await Promise.all([
    getCompanies(),
    prisma.eRP.findMany({
      select: {
        id: true, name: true, authTemplate: true,
        endpoints: { select: { id: true, name: true, pathTemplate: true, bodyTemplate: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { name: 'asc' },
    }),
  ])
  return <CompaniesClient companies={companies} erps={erps} />
}
