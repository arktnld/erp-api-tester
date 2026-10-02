'use server'

import { prisma } from '@erp/db'
import { revalidatePath } from 'next/cache'
import { EndpointSchema } from './schemas'
import { requireAdmin } from '@/lib/require-role'
import { parseOpenApi } from '@/lib/openapi-import'

export async function createEndpoint(data: {
  erpId: number
  name: string
  method: string
  pathTemplate: string
  bodyTemplate: string
  headers: string
  group: string
  requiresClient: boolean
  isModification: boolean
  notes: string
  authMode: string
}) {
  await requireAdmin()
  const parsed = EndpointSchema.parse(data)
  const ep = await prisma.endpoint.create({ data: parsed })
  revalidatePath(`/erps/${parsed.erpId}`)
  return { id: ep.id }
}

export async function updateEndpoint(
  id: number,
  erpId: number,
  data: {
    name: string
    method: string
    pathTemplate: string
    bodyTemplate: string
    headers: string
    group: string
    requiresClient: boolean
    isModification: boolean
    notes: string
    authMode: string
  }
) {
  await requireAdmin()
  const parsed = EndpointSchema.omit({ erpId: true }).parse(data)
  await prisma.endpoint.update({ where: { id }, data: parsed })
  revalidatePath(`/erps/${erpId}`)
}

export async function deleteEndpoint(id: number, erpId: number) {
  await requireAdmin()
  await prisma.endpoint.delete({ where: { id } })
  revalidatePath(`/erps/${erpId}`)
}

export async function duplicateEndpoint(id: number, erpId: number) {
  await requireAdmin()
  const original = await prisma.endpoint.findUniqueOrThrow({ where: { id } })
  // Shift all endpoints after the original down by 1
  await prisma.endpoint.updateMany({
    where: { erpId, sortOrder: { gt: original.sortOrder } },
    data: { sortOrder: { increment: 1 } },
  })
  await prisma.endpoint.create({
    data: {
      erpId: original.erpId,
      name: `${original.name} (cópia)`,
      method: original.method,
      pathTemplate: original.pathTemplate,
      bodyTemplate: original.bodyTemplate,
      headers: original.headers,
      group: original.group,
      requiresClient: original.requiresClient,
      isModification: original.isModification,
      notes: original.notes,
      authMode: original.authMode,
      sortOrder: original.sortOrder + 1,
    },
  })
  revalidatePath(`/erps/${erpId}`)
}

export async function reorderEndpoints(erpId: number, orderedIds: number[]) {
  await requireAdmin()
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.endpoint.update({ where: { id }, data: { sortOrder: index } })
    )
  )
  revalidatePath(`/erps/${erpId}`)
}

/** Saves endpoint drafts after the last one; a draft whose key already exists is skipped. */
async function insertDrafts(erpId: number, drafts: unknown[], keyOf: (e: { method: string; pathTemplate: string; name: string }) => string) {
  const existing = await prisma.endpoint.findMany({ where: { erpId }, select: { method: true, pathTemplate: true, name: true, sortOrder: true } })
  const seen = new Set(existing.map(keyOf))
  let nextOrder = existing.reduce((max, e) => Math.max(max, e.sortOrder), -1) + 1
  const data = []
  for (const draft of drafts) {
    const ep = EndpointSchema.parse({ ...(draft as object), erpId, authMode: '' })
    if (seen.has(keyOf(ep))) continue
    seen.add(keyOf(ep))
    data.push({ ...ep, sortOrder: nextOrder++ })
  }
  if (data.length) await prisma.endpoint.createMany({ data })
  revalidatePath(`/erps/${erpId}`)
  return { created: data.length, skipped: drafts.length - data.length }
}

/** Creates endpoints from an OpenAPI/Swagger JSON spec; operations already present (method + path) are skipped. */
export async function importOpenApi(erpId: number, specText: string) {
  await requireAdmin()
  let doc: unknown
  try {
    doc = JSON.parse(specText)
  } catch {
    throw new Error('O arquivo não é JSON válido. Use a versão JSON do Swagger/OpenAPI.')
  }
  const { endpoints, warnings } = parseOpenApi(doc)
  const r = await insertDrafts(erpId, endpoints, (e) => `${e.method} ${e.pathTemplate}`)
  return { ...r, warnings: warnings.slice(0, 20) }
}

/**
 * Saves the SOAP operations read from a WSDL in the browser (lib/wsdl-import). Every operation shares
 * the service path, so the operation name is part of the duplicate check.
 */
export async function importWsdlOperations(erpId: number, drafts: unknown[]) {
  await requireAdmin()
  if (!Array.isArray(drafts) || drafts.length > 500) throw new Error('Lista de operações inválida.')
  return insertDrafts(erpId, drafts, (e) => `${e.method} ${e.pathTemplate} ${e.name}`)
}
