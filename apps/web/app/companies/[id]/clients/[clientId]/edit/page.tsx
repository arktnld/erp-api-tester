import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Editar Cliente' }

import { getCompany } from '@/lib/actions/companies'
import { getTestClient } from '@/lib/actions/test-clients'
import { ClientBuilder } from '../../client-builder'

export const dynamic = 'force-dynamic'

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string; clientId: string }>
}) {
  const { id, clientId } = await params
  const [company, client] = await Promise.all([
    getCompany(Number(id)),
    getTestClient(Number(clientId)),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ClientBuilder company={company as any} client={client as any} />
}
