import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Editar Fluxo' }

import { prisma } from '@erp/db'
import { PlaybookEditClient } from './playbook-edit-client'
import { getPlaybook } from '@/lib/actions/playbooks'

export const dynamic = 'force-dynamic'

export default async function EditPlaybookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [playbook, erps] = await Promise.all([
    getPlaybook(Number(id)),
    prisma.eRP.findMany({
      select: {
        id: true,
        name: true,
        endpoints: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, method: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ])
  return <PlaybookEditClient erps={erps} playbook={playbook as Parameters<typeof PlaybookEditClient>[0]['playbook']} />
}
