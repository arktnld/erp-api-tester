'use server'

import { prisma } from '@erp/db'
import { revalidatePath } from 'next/cache'
import { ERPSchema } from './schemas'
import { requireAdmin, requireUser } from '@/lib/require-role'
import { recordAudit } from '@/lib/audit'

export async function getERPs() {
  await requireUser()
  return prisma.eRP.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { endpoints: true, companies: true } },
    },
  })
}

export async function getERP(id: number) {
  await requireUser()
  return prisma.eRP.findUniqueOrThrow({
    where: { id },
    include: {
      endpoints: { orderBy: { sortOrder: 'asc' } },
      fieldSchemas: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

export async function createERP(data: { name: string }) {
  await requireAdmin()
  const parsed = ERPSchema.parse(data)
  const erp = await prisma.eRP.create({ data: parsed })
  revalidatePath('/erps')
  await recordAudit('create', 'erp', erp.id, erp.name)
  return { id: erp.id }
}

export async function updateERP(id: number, data: { name: string }) {
  await requireAdmin()
  const parsed = ERPSchema.parse(data)
  await prisma.eRP.update({ where: { id }, data: parsed })
  revalidatePath('/erps')
  revalidatePath(`/erps/${id}`)
  await recordAudit('update', 'erp', id, parsed.name)
}

export async function updateERPAuthTemplate(id: number, template: unknown) {
  await requireAdmin()
  await prisma.eRP.update({ where: { id }, data: { authTemplate: template as Parameters<typeof prisma.eRP.update>[0]['data']['authTemplate'] } })
  revalidatePath(`/erps/${id}`)
}

/** What deleting an ERP takes with it, shown to the user before confirming. */
export async function getERPDeletionImpact(id: number) {
  await requireAdmin()
  const [erp, companies, playbooks, runs] = await Promise.all([
    prisma.eRP.findUniqueOrThrow({ where: { id }, select: { name: true, _count: { select: { endpoints: true, fieldSchemas: true } } } }),
    prisma.company.findMany({
      where: { erpId: id }, orderBy: { name: 'asc' },
      select: { name: true, _count: { select: { testClients: true, apiRecords: true } } },
    }),
    prisma.playbook.findMany({ where: { erpId: id }, orderBy: { name: 'asc' }, select: { name: true } }),
    // Each run counted once, whether it hangs off one of the companies or one of the playbooks.
    prisma.playbookRun.count({ where: { OR: [{ company: { erpId: id } }, { playbook: { erpId: id } }] } }),
  ])
  return {
    name: erp.name,
    endpoints: erp._count.endpoints,
    fieldSchemas: erp._count.fieldSchemas,
    companies: companies.map((c) => ({ name: c.name, testClients: c._count.testClients, records: c._count.apiRecords })),
    playbooks: playbooks.map((p) => p.name),
    playbookRuns: runs,
  }
}

/**
 * Deletes the ERP with its endpoints, client fields, playbooks (steps and runs) and companies
 * (test clients, records, runs), all or nothing. Request history keeps only names, so it stays.
 * Order matters: runs, records, playbooks and companies point at things the ERP cascade removes.
 */
export async function deleteERP(id: number) {
  await requireAdmin()
  const erp = await prisma.eRP.findUniqueOrThrow({ where: { id }, select: { name: true } })
  await prisma.$transaction([
    prisma.apiRecord.deleteMany({ where: { company: { erpId: id } } }), // blocks cascade
    prisma.playbookRun.deleteMany({ where: { OR: [{ company: { erpId: id } }, { playbook: { erpId: id } }] } }),
    prisma.playbook.deleteMany({ where: { erpId: id } }), // steps cascade
    prisma.company.deleteMany({ where: { erpId: id } }), // test clients and cookie jars cascade
    prisma.eRP.delete({ where: { id } }), // endpoints and client fields cascade
  ])
  revalidatePath('/erps')
  revalidatePath('/companies')
  revalidatePath('/records')
  revalidatePath('/playbooks')
  await recordAudit('delete', 'erp', id, erp.name)
}
