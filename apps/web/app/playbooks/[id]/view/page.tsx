import { notFound } from 'next/navigation'
import { getPlaybook, getLastPlaybookRun } from '@/lib/actions/playbooks'
import { PlaybookViewContent } from './view-content'

export const dynamic = 'force-dynamic'

export default async function PlaybookViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let playbook
  try { playbook = await getPlaybook(Number(id)) } catch { notFound() }

  const lastRun = await getLastPlaybookRun(playbook.id)

  return <PlaybookViewContent playbook={playbook} lastRun={lastRun} />
}
