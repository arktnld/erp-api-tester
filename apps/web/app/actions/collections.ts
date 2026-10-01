'use server'

import { requireEdit, requireUser } from '@/lib/require-role'
import { prisma } from '@erp/db'
import { parseCollectionStructure } from '@/app/collections/lib/parser'

export async function getAllCollections() {
  await requireUser()
  return prisma.postmanCollection.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, createdAt: true },
  })
}

export async function getCollectionStructure(id: number) {
  await requireUser()
  const collection = await prisma.postmanCollection.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      rawJson: true,
    },
  })

  if (!collection) return null

  const structure = parseCollectionStructure(collection.rawJson)

  return { id: collection.id, name: collection.name, structure }
}

export async function deleteCollection(id: number) {
  await requireEdit()
  await prisma.postmanCollection.delete({ where: { id } })
}

export async function getCollectionRawJson(id: number) {
  await requireUser()
  const col = await prisma.postmanCollection.findUnique({
    where: { id },
    select: { name: true, rawJson: true },
  })
  if (!col || !col.rawJson) return null
  return { name: col.name, rawJson: col.rawJson }
}

export async function importCollection(name: string, rawJson: unknown) {
  await requireEdit()
  const created = await prisma.postmanCollection.create({
    data: { name, rawJson: rawJson as never },
    select: { id: true, name: true, createdAt: true },
  })
  return created
}
