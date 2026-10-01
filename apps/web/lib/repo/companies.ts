import { prisma } from '@erp/db'

const companyAuthSelect = {
  id: true,
  name: true,
  baseUrl: true,
  environments: true,
  authType: true,
  authConfig: true,
  erp: { select: { name: true, authTemplate: true, fieldSchemas: { select: { fieldName: true, defaultValue: true } } } },
} as const

export function getCompanyWithAuth(id: number) {
  return prisma.company.findUniqueOrThrow({ where: { id }, select: companyAuthSelect })
}

export function saveTokenCache(companyId: number, updatedConfig: Record<string, unknown>) {
  return prisma.company.update({ where: { id: companyId }, data: { authConfig: updatedConfig as Parameters<typeof prisma.company.update>[0]['data']['authConfig'] } })
}

export async function getCookieJar(companyId: number): Promise<unknown> {
  const row = await prisma.companyCookieJar.findUnique({ where: { companyId }, select: { cookies: true } })
  return row?.cookies ?? []
}

export function saveCookieJar(companyId: number, cookies: unknown[]) {
  const data = { cookies: cookies as Parameters<typeof prisma.companyCookieJar.create>[0]['data']['cookies'] }
  return prisma.companyCookieJar.upsert({ where: { companyId }, create: { companyId, ...data }, update: data })
}

export function getTestClientWithCompany(id: number) {
  return prisma.testClient.findUniqueOrThrow({
    where: { id },
    include: { company: { select: companyAuthSelect } },
  })
}
