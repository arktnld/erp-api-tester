'use server'

import { z } from 'zod'
import { prisma } from '@erp/db'
import { requireAdmin } from '@/lib/require-role'
import { recordAudit } from '@/lib/audit'
import { templateBySlug } from '@/lib/erp-templates'
import { revalidatePath } from 'next/cache'

// First-run journey (/setup): install a ready ERP template and its first company.

const CompanyInput = z.object({
  name: z.string().trim().min(1, 'Dê um nome à empresa').max(200),
  baseUrl: z.string().trim().url('URL base inválida (ex.: https://api.provedor.com.br)').refine((u) => /^https?:\/\//.test(u), 'Use http:// ou https://'),
  /** Credentials per auth mode id. */
  credentials: z.record(z.record(z.string().max(2000))),
})
type CompanyInput = z.infer<typeof CompanyInput>
type Result = { error: string } | { erpId: number; companyId: number; endpointIds: Record<string, number> }

/** authConfig in the shape the company form writes: flat for one mode, keyed by mode id for several. */
function authConfigFor(modes: { id: string; type: string; tokenEndpointId?: number; tokenPath?: string }[], credentials: CompanyInput['credentials']) {
  const one = (m: (typeof modes)[number]) => m.type === 'token_endpoint'
    ? { tokenEndpointId: m.tokenEndpointId, tokenPath: m.tokenPath ?? 'token', params: credentials[m.id] ?? {} }
    : { ...(credentials[m.id] ?? {}) }
  return modes.length === 1 ? one(modes[0]) : Object.fromEntries(modes.map((m) => [m.id, one(m)]))
}

/**
 * Creates the ERP from a template (endpoints, auth modes, client fields with auto-fill) and its
 * first company, all at once. Returns endpoint ids by template key, for the connection test
 * and the first call.
 */
export async function installErpTemplate(slug: string, company: CompanyInput): Promise<Result> {
  await requireAdmin()
  const tpl = templateBySlug(slug)
  if (!tpl) return { error: 'Modelo desconhecido' }
  const parsed = CompanyInput.safeParse(company)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  if (await prisma.eRP.findUnique({ where: { name: tpl.name } })) {
    return { error: `Já existe um ERP "${tpl.name}". Cadastre a empresa em Empresas → Nova Empresa.` }
  }

  const out = await prisma.$transaction(async (tx) => {
    const erp = await tx.eRP.create({ data: { name: tpl.name } })
    const endpointIds: Record<string, number> = {}
    for (const [i, e] of tpl.endpoints.entries()) {
      const { key, ...data } = e
      endpointIds[key] = (await tx.endpoint.create({ data: { ...data, erpId: erp.id, sortOrder: i } })).id
    }
    const modes = tpl.authModes.map(({ tokenEndpoint, ...m }) => ({ ...m, ...(tokenEndpoint ? { tokenEndpointId: endpointIds[tokenEndpoint] } : {}) }))
    const authTemplate = modes.length === 1 && modes[0].id === 'default' ? (({ id: _id, ...rest }) => rest)(modes[0]) : modes
    await tx.eRP.update({ where: { id: erp.id }, data: { authTemplate } })
    await tx.eRPFieldSchema.createMany({
      data: tpl.fieldSchemas.map(({ source, ...f }, i) => ({ ...f, erpId: erp.id, sortOrder: i, sourceEndpointId: source ? endpointIds[source] : null })),
    })
    const co = await tx.company.create({
      data: {
        name: parsed.data.name, erpId: erp.id, baseUrl: parsed.data.baseUrl.replace(/\/+$/, ''), environments: [],
        authType: modes[0].type, authConfig: authConfigFor(modes, parsed.data.credentials), notes: '',
      },
    })
    return { erpId: erp.id, companyId: co.id, endpointIds }
  })
  await recordAudit('create', 'erp', out.erpId, tpl.name)
  revalidatePath('/', 'layout')
  return out
}

/** Fixes the company's name, URL or credentials after a failed connection test. */
export async function updateSetupCompany(companyId: number, company: CompanyInput): Promise<{ error: string } | { ok: true }> {
  await requireAdmin()
  const parsed = CompanyInput.safeParse(company)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }
  const co = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { erp: { select: { authTemplate: true } } } })
  const t = co.erp.authTemplate
  const modes = (Array.isArray(t) ? t : t && typeof t === 'object' && 'type' in t ? [{ id: 'default', ...t }] : []) as { id: string; type: string; tokenEndpointId?: number; tokenPath?: string }[]
  await prisma.company.update({
    where: { id: companyId },
    data: { name: parsed.data.name, baseUrl: parsed.data.baseUrl.replace(/\/+$/, ''), authConfig: authConfigFor(modes, parsed.data.credentials) },
  })
  revalidatePath('/', 'layout')
  return { ok: true }
}
