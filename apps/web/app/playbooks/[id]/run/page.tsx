import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Executar Fluxo' }

import { prisma } from '@erp/db'
import { getPlaybook } from '@/lib/actions/playbooks'
import { RunClient } from './run-client'

export const dynamic = 'force-dynamic'

export default async function RunPlaybookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const playbook = await getPlaybook(Number(id))
  const companies = await prisma.company.findMany({
    where: { erpId: playbook.erpId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      testClients: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
  })
  return <RunClient playbook={playbook} companies={companies} />
}
