'use server'

import { prisma } from '@erp/db'
import { revalidatePath } from 'next/cache'
import { CompanySchema } from './schemas'
import { canSeeSecrets, requireEdit, requireUser } from '@/lib/require-role'
import { redactAuthConfig } from '@/lib/redact'
import { recordAudit } from '@/lib/audit'

export async function getCompanies() {
  await requireUser()
  const [companies, showSecrets] = await Promise.all([prisma.company.findMany({
    orderBy: [{ erp: { name: 'asc' } }, { name: 'asc' }],
    include: {
      erp: { select: { id: true, name: true } },
      _count: { select: { testClients: true } },
    },
  }), canSeeSecrets()])
  return showSecrets ? companies : companies.map((c) => ({ ...c, authConfig: redactAuthConfig(c.authConfig) }))
}

export async function getCompany(id: number) {
  await requireUser()
  const [company, showSecrets] = await Promise.all([prisma.company.findUniqueOrThrow({
    where: { id },
    include: {
      erp: {
        include: {
          fieldSchemas: { orderBy: { sortOrder: 'asc' } },
          endpoints: { orderBy: { sortOrder: 'asc' } },
        },
      },
      testClients: { orderBy: { name: 'asc' } },
    },
  }), canSeeSecrets()])
  return showSecrets ? company : { ...company, authConfig: redactAuthConfig(company.authConfig) }
}

export async function createCompany(data: {
  name: string
  erpId: number
  baseUrl: string
  environments: string
  authType: string
  authConfig: string
  notes: string
}) {
  await requireEdit()
  const parsed = CompanySchema.parse(data)
  const company = await prisma.company.create({
    data: { ...parsed, environments: JSON.parse(parsed.environments), authConfig: JSON.parse(parsed.authConfig) },
  })
  revalidatePath('/companies')
  await recordAudit('create', 'company', company.id, company.name)
  return { id: company.id }
}

export async function updateCompany(
  id: number,
  data: { name: string; erpId: number; baseUrl: string; environments: string; authType: string; authConfig: string; notes: string }
) {
  await requireEdit()
  const parsed = CompanySchema.parse(data)
  await prisma.company.update({
    where: { id },
    data: { ...parsed, environments: JSON.parse(parsed.environments), authConfig: JSON.parse(parsed.authConfig) },
  })
  revalidatePath('/companies')
  revalidatePath(`/companies/${id}`)
  await recordAudit('update', 'company', id, parsed.name)
}

/** What deleting a company takes with it, shown to the user before confirming. */
export async function getCompanyDeletionImpact(id: number) {
  await requireEdit()
  const [company, testClients, records, playbookRuns, history] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id }, select: { name: true } }),
    prisma.testClient.findMany({ where: { companyId: id }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.apiRecord.findMany({ where: { companyId: id }, select: { name: true, _count: { select: { blocks: true } } }, orderBy: { name: 'asc' } }),
    prisma.playbookRun.count({ where: { companyId: id } }),
    prisma.requestHistory.count({ where: { companyId: id } }),
  ])
  return {
    name: company.name,
    testClients: testClients.map((c) => c.name),
    records: records.map((r) => ({ name: r.name, blocks: r._count.blocks })),
    playbookRuns,
    history,
  }
}

/**
 * Deletes the company with its test clients, records (and their blocks) and playbook runs,
 * all or nothing. Request history keeps only the company id/name, so it stays.
 */
export async function deleteCompany(id: number) {
  await requireEdit()
  const company = await prisma.company.findUniqueOrThrow({ where: { id }, select: { name: true } })
  await prisma.$transaction([
    prisma.apiRecord.deleteMany({ where: { companyId: id } }), // blocks cascade
    prisma.playbookRun.deleteMany({ where: { companyId: id } }),
    prisma.company.delete({ where: { id } }), // test clients and cookie jar cascade
  ])
  revalidatePath('/companies')
  revalidatePath('/records')
  await recordAudit('delete', 'company', id, company.name)
}
