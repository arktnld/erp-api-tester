import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Novo Fluxo' }

import { prisma } from '@erp/db'
import { PlaybookEditClient } from '../[id]/edit/playbook-edit-client'

export const dynamic = 'force-dynamic'

export default async function NewPlaybookPage() {
  const erps = await prisma.eRP.findMany({
    select: {
      id: true,
      name: true,
      endpoints: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, method: true } },
    },
    orderBy: { name: 'asc' },
  })
  return <PlaybookEditClient erps={erps} />
}
