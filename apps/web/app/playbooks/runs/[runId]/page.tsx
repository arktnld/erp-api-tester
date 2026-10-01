import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Execução' }

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { prisma } from '@erp/db'
import { getPlaybookRun } from '@/lib/actions/playbooks'
import { RunResultClient } from './run-result-client'
import type { StepResult } from './run-result-client'

export const dynamic = 'force-dynamic'

export default async function RunResultPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const run = await getPlaybookRun(Number(runId))
  const steps = run.steps as StepResult[]

  let clientFields: Record<string, string> | undefined
  let clientName: string | undefined
  if (run.clientId && steps.length > 0) {
    const [client, firstStep] = await Promise.all([
      prisma.testClient.findUnique({ where: { id: run.clientId }, select: { name: true, fieldsData: true } }),
      prisma.playbookStep.findUnique({ where: { id: steps[0].stepId }, select: { bodyOverride: true, endpointId: true } }),
    ])
    if (client) {
      clientName = client.name
      const allClientFields = client.fieldsData as Record<string, string>

      // Find which field names are referenced in the Step 1 template
      let usedKeys: Set<string> | null = null
      if (firstStep) {
        const endpoint = await prisma.endpoint.findUnique({
          where: { id: firstStep.endpointId },
          select: { bodyTemplate: true, pathTemplate: true },
        })
        const template = (firstStep.bodyOverride ?? '') + (endpoint?.bodyTemplate ?? '') + (endpoint?.pathTemplate ?? '')
        const refs = [...template.matchAll(/\{(\w+)\}/g)].map(m => m[1].toLowerCase())
        if (refs.length > 0) usedKeys = new Set(refs)
      }

      clientFields = usedKeys
        ? Object.fromEntries(Object.entries(allClientFields).filter(([k]) => usedKeys!.has(k.toLowerCase())))
        : allClientFields
    }
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <Link href="/playbooks" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ChevronLeft size={14} /> Fluxos
      </Link>
      <RunResultClient run={{ ...run, steps }} clientFields={clientFields} clientName={clientName} />
    </div>
  )
}
