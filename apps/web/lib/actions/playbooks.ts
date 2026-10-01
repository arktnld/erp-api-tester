'use server'

import { prisma } from '@erp/db'
import { revalidatePath } from 'next/cache'
import { extractFields, runAssertions, type AssertionResult } from '@/lib/playbook-utils'
import { canSeeSecrets, requireAdmin, requireEdit, requireUser } from '@/lib/require-role'
import { redactExecution } from '@/lib/redact'

export { extractFields }

// --- Types ---

export type PlaybookWithSteps = {
  id: number
  erpId: number
  name: string
  description: string
  steps: Array<{
    id: number
    order: number
    endpointId: number
    stepName: string
    bodyOverride: string
    responseCapture: string
    assertions?: string
  }>
}

// --- Playbook CRUD ---

export async function getPlaybooks() {
  await requireUser()
  return prisma.playbook.findMany({
    orderBy: { name: 'asc' },
    include: {
      erp: { select: { id: true, name: true } },
      _count: { select: { steps: true, runs: true } },
    },
  })
}

export async function getPlaybook(id: number) {
  await requireUser()
  return prisma.playbook.findUniqueOrThrow({
    where: { id },
    include: {
      erp: { select: { id: true, name: true } },
      steps: {
        orderBy: { order: 'asc' },
        include: { endpoint: { select: { id: true, name: true, method: true } } },
      },
    },
  })
}

export async function createPlaybook(data: { name: string; erpId: number; description: string }) {
  await requireAdmin()
  const pb = await prisma.playbook.create({ data })
  revalidatePath('/playbooks')
  return { id: pb.id }
}

export async function updatePlaybook(id: number, data: { name: string; erpId: number; description: string }) {
  await requireAdmin()
  await prisma.playbook.update({ where: { id }, data })
  revalidatePath('/playbooks')
  revalidatePath(`/playbooks/${id}/edit`)
}

export async function deletePlaybook(id: number) {
  await requireAdmin()
  await prisma.playbook.delete({ where: { id } })
  revalidatePath('/playbooks')
}

// --- Step CRUD ---

export async function upsertPlaybookSteps(
  playbookId: number,
  steps: Array<{
    id?: number
    order: number
    endpointId: number
    stepName: string
    bodyOverride: string
    responseCapture: string
    assertions?: string
  }>
) {
  await requireAdmin()
  const incoming = steps.filter((s) => s.id)
  const incomingIds = incoming.map((s) => s.id!)
  const existing = await prisma.playbookStep.findMany({ where: { playbookId }, select: { id: true } })
  const deletedIds = existing.map((s) => s.id).filter((id) => !incomingIds.includes(id))

  await prisma.$transaction([
    prisma.playbookStep.deleteMany({ where: { id: { in: deletedIds } } }),
    ...steps.map((s, i) =>
      s.id
        ? prisma.playbookStep.update({
            where: { id: s.id },
            data: { order: i, endpointId: s.endpointId, stepName: s.stepName, bodyOverride: s.bodyOverride, responseCapture: s.responseCapture, assertions: s.assertions ?? '' },
          })
        : prisma.playbookStep.create({
            data: { playbookId, order: i, endpointId: s.endpointId, stepName: s.stepName, bodyOverride: s.bodyOverride, responseCapture: s.responseCapture, assertions: s.assertions ?? '' },
          })
    ),
  ])
  revalidatePath(`/playbooks/${playbookId}/edit`)
}

// --- Execution ---

type StepResult = {
  stepId: number
  stepName: string
  endpointName: string
  status: 'ok' | 'error'
  statusCode: number
  method: string
  url: string
  responseBody: string
  capturedFields: Record<string, string>
  injectedFields: Record<string, string>
  requestBody: string | null
  requestHeaders: Record<string, string>
  durationMs: number
  assertions?: AssertionResult[]
}

export async function runPlaybook(playbookId: number, companyId: number, clientId: number | null) {
  await requireUser()
  const { executeRequest } = await import('@/lib/services/execute')

  const playbook = await prisma.playbook.findUniqueOrThrow({
    where: { id: playbookId },
    include: {
      steps: {
        orderBy: { order: 'asc' },
        include: { endpoint: { select: { name: true, bodyTemplate: true, pathTemplate: true } } },
      },
    },
  })

  const run = await prisma.playbookRun.create({
    data: { playbookId, companyId, clientId, status: 'running', steps: [] },
  })

  let capturedFields: Record<string, string> = {}
  const results: StepResult[] = []

  for (const step of playbook.steps) {
    const allAvailableFields = { ...capturedFields }
    // Only show fields actually referenced as {field} in the body template or URL path
    const template = (step.bodyOverride || '') + (step.endpoint?.bodyTemplate || '') + (step.endpoint?.pathTemplate || '')
    const usedInjectedFields: Record<string, string> = {}
    for (const [field, value] of Object.entries(allAvailableFields)) {
      if (template.includes(`{${field}}`)) usedInjectedFields[field] = value
    }
    try {
      const result = await executeRequest({
        endpointId: step.endpointId,
        companyId: clientId ? undefined : companyId,
        clientId: clientId ?? undefined,
        rawBody: step.bodyOverride || null,
        inlineFields: allAvailableFields,
      })

      let parsedBody: unknown = result.responseBody
      try { parsedBody = JSON.parse(result.responseBody) } catch { /* keep string */ }

      const captured = extractFields(parsedBody, step.responseCapture || null)
      const assertions = runAssertions(step.assertions, { status: result.statusCode, body: parsedBody, headers: result.responseHeaders })
      // With assertions the step passes on them (a 200 carrying {"erro": ...} fails); otherwise on 2xx.
      const passed = assertions.length > 0 ? assertions.every((a) => a.ok) : result.statusCode >= 200 && result.statusCode < 300
      capturedFields = { ...capturedFields, ...captured }

      results.push({
        stepId: step.id,
        stepName: step.stepName,
        endpointName: step.endpoint.name,
        status: passed ? 'ok' : 'error',
        statusCode: result.statusCode,
        method: result.method,
        url: result.url,
        responseBody: result.responseBody,
        capturedFields: captured,
        injectedFields: usedInjectedFields,
        requestBody: result.requestBody,
        requestHeaders: result.requestHeaders,
        durationMs: result.durationMs,
        assertions,
      })
    } catch (err) {
      results.push({
        stepId: step.id,
        stepName: step.stepName,
        endpointName: step.endpoint.name,
        status: 'error',
        statusCode: 0,
        method: '',
        url: '',
        responseBody: String(err),
        capturedFields: {},
        injectedFields: usedInjectedFields,
        requestBody: null,
        requestHeaders: {},
        durationMs: 0,
      })
      break
    }
  }

  const allOk = results.every((r) => r.status === 'ok')
  await prisma.playbookRun.update({
    where: { id: run.id },
    data: { status: allOk ? 'completed' : 'failed', endedAt: new Date(), steps: results },
  })

  revalidatePath(`/playbooks/${playbookId}`)
  return { runId: run.id }
}

async function withoutStepSecrets<T extends { steps: unknown } | null>(run: T): Promise<T> {
  if (!run || !Array.isArray(run.steps) || (await canSeeSecrets())) return run
  return { ...run, steps: run.steps.map(redactExecution) }
}

export async function getPlaybookRun(id: number) {
  await requireUser()
  return withoutStepSecrets(await prisma.playbookRun.findUniqueOrThrow({
    where: { id },
    include: {
      playbook: { select: { id: true, name: true, erp: { select: { name: true } } } },
      company: { select: { name: true } },
    },
  }))
}

export async function getPlaybookRunByToken(token: string) {
  await requireUser()
  return withoutStepSecrets(await prisma.playbookRun.findUniqueOrThrow({
    where: { shareToken: token },
    include: {
      playbook: { select: { id: true, name: true, erp: { select: { name: true } } } },
      company: { select: { name: true } },
    },
  }))
}

export async function getLastPlaybookRun(playbookId: number) {
  await requireUser()
  return withoutStepSecrets(await prisma.playbookRun.findFirst({
    where: { playbookId },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true, status: true, startedAt: true, endedAt: true,
      companyId: true, clientId: true, steps: true,
      company: { select: { name: true } },
    },
  }))
}

export async function generateShareToken(runId: number): Promise<string> {
  'use server'
  await requireEdit()
  const existing = await prisma.playbookRun.findUnique({
    where: { id: runId },
    select: { shareToken: true },
  })
  if (existing?.shareToken) return existing.shareToken
  const token = crypto.randomUUID()
  await prisma.playbookRun.update({ where: { id: runId }, data: { shareToken: token } })
  return token
}
