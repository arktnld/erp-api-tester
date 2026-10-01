import { prisma } from '@erp/db'

export function getEndpoint(id: number) {
  return prisma.endpoint.findUniqueOrThrow({ where: { id } })
}
