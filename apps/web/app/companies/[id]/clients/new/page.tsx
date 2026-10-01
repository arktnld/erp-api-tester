import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Novo Cliente' }

import { getCompany } from '@/lib/actions/companies'
import { ClientBuilder } from '../client-builder'

export const dynamic = 'force-dynamic'

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const company = await getCompany(Number(id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ClientBuilder company={company as any} />
}
