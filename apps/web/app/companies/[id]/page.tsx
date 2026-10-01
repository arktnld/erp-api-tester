import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Empresa' }

import { getCompany } from '@/lib/actions/companies'
import { CompanyDetailClient } from './company-detail-client'

export const dynamic = 'force-dynamic'

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const company = await getCompany(Number(id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <CompanyDetailClient company={company as any} />
}
