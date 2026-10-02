'use server'

import { z } from 'zod'
import { prisma } from '@erp/db'
import { requireAdmin } from '@/lib/require-role'
import { recordAudit } from '@/lib/audit'
import { AUTH_TYPES, SETUP_AUTH_TYPES } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// First-run journey (/setup): any HTTP API (REST, SOAP, GraphQL) from its URL, auth and one request.

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const SetupInput = z.object({
  name: z.string().trim().min(1, 'Dê um nome à API').max(100),
  baseUrl: z.string().trim().url('URL base inválida (ex.: https://api.exemplo.com)').refine((u) => /^https?:\/\//.test(u), 'Use http:// ou https://'),
  authType: z.enum(SETUP_AUTH_TYPES),
  credentials: z.record(z.string().max(2000)),
  method: z.enum(METHODS),
  path: z.string().trim().max(2000).refine((p) => p === '' || p.startsWith('/'), 'O caminho começa com /'),
  body: z.string().max(100_000),
  contentType: z.string().max(100),
})
export type SetupInput = z.infer<typeof SetupInput>
export type SetupIds = { erpId: number; companyId: number; endpointId: number }

function authFor(input: SetupInput) {
  if (input.authType === 'none') return { authTemplate: {}, authType: 'none', authConfig: {} }
  const fields = (AUTH_TYPES[input.authType].fixedKeys ?? []).map((f) => ({ key: f.key, label: f.label, placeholder: '', default: '', hidden: false }))
  return {
    authTemplate: { type: input.authType, label: AUTH_TYPES[input.authType].label, fields },
    authType: input.authType,
    authConfig: Object.fromEntries(fields.map((f) => [f.key, input.credentials[f.key] ?? ''])),
  }
}

function endpointFor(input: SetupInput) {
  const hasBody = input.body.trim() !== '' && input.method !== 'GET'
  return {
    name: 'Primeira chamada',
    requiresClient: false,
    method: input.method,
    pathTemplate: input.path || '/',
    bodyTemplate: hasBody ? input.body : '',
    headers: JSON.stringify(hasBody && input.contentType ? { 'Content-Type': input.contentType } : {}),
  }
}

/**
 * Creates (first call) or updates (later attempts) the API, its first company and the first
 * request, so the journey can test, fix and test again without duplicates.
 */
export async function saveFirstSetup(input: SetupInput, ids: SetupIds | null): Promise<{ error: string } | SetupIds> {
  await requireAdmin()
  const parsed = SetupInput.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  const data = parsed.data
  const auth = authFor(data)
  const baseUrl = data.baseUrl.replace(/\/+$/, '')

  if (ids) {
    await prisma.$transaction([
      prisma.eRP.update({ where: { id: ids.erpId }, data: { name: data.name, authTemplate: auth.authTemplate } }),
      prisma.company.update({ where: { id: ids.companyId }, data: { name: data.name, baseUrl, authType: auth.authType, authConfig: auth.authConfig } }),
      prisma.endpoint.update({ where: { id: ids.endpointId }, data: endpointFor(data) }),
    ])
    revalidatePath('/', 'layout')
    return ids
  }

  if (await prisma.eRP.findUnique({ where: { name: data.name } })) return { error: `Já existe uma API chamada "${data.name}".` }
  const out = await prisma.$transaction(async (tx) => {
    const erp = await tx.eRP.create({ data: { name: data.name, authTemplate: auth.authTemplate } })
    const endpoint = await tx.endpoint.create({ data: { ...endpointFor(data), erpId: erp.id, sortOrder: 0 } })
    const company = await tx.company.create({
      data: { name: data.name, erpId: erp.id, baseUrl, environments: [], authType: auth.authType, authConfig: auth.authConfig, notes: '' },
    })
    return { erpId: erp.id, companyId: company.id, endpointId: endpoint.id }
  })
  await recordAudit('create', 'erp', out.erpId, data.name)
  revalidatePath('/', 'layout')
  return out
}
