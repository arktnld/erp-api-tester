import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Fluxo' }

import { prisma } from '@erp/db'
import { notFound } from 'next/navigation'
import { getPlaybook, getLastPlaybookRun } from '@/lib/actions/playbooks'
import { PlaybookDetailClient } from './playbook-detail-client'

export const dynamic = 'force-dynamic'

export default async function PlaybookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let playbook
  try { playbook = await getPlaybook(Number(id)) } catch { notFound() }

  const [companies, lastRun] = await Promise.all([
    prisma.company.findMany({
      where: { erpId: playbook.erpId },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true,
        testClients: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
      },
    }),
    getLastPlaybookRun(playbook.id),
  ])

  return <PlaybookDetailClient playbook={playbook} companies={companies} lastRun={lastRun} />
}
