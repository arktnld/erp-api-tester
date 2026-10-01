'use server'

import { prisma } from '@erp/db'
import { revalidatePath } from 'next/cache'
import { FieldSchemaSchema } from './schemas'
import { requireAdmin } from '@/lib/require-role'

export async function createFieldSchema(data: {
  erpId: number
  fieldName: string
  label: string
  fieldType: string
  required: boolean
  sourceEndpointId?: number | null
  endpointParam?: string
  responsePath?: string
  defaultValue?: string
}) {
  await requireAdmin()
  const parsed = FieldSchemaSchema.parse(data)
  await prisma.eRPFieldSchema.create({ data: parsed })
  revalidatePath(`/erps/${parsed.erpId}`)
}

export async function updateFieldSchema(
  id: number,
  erpId: number,
  data: {
    fieldName: string
    label: string
    fieldType: string
    required: boolean
    sourceEndpointId?: number | null
    endpointParam?: string
    responsePath?: string
    defaultValue?: string
  }
) {
  await requireAdmin()
  const parsed = FieldSchemaSchema.omit({ erpId: true }).parse(data)
  await prisma.eRPFieldSchema.update({ where: { id }, data: parsed })
  revalidatePath(`/erps/${erpId}`)
}

export async function duplicateFieldSchema(id: number, erpId: number) {
  await requireAdmin()
  const original = await prisma.eRPFieldSchema.findUniqueOrThrow({ where: { id } })
  await prisma.eRPFieldSchema.create({
    data: {
      erpId: original.erpId,
      fieldName: `${original.fieldName}_copia`,
      label: `${original.label} (cópia)`,
      fieldType: original.fieldType,
      required: original.required,
      sortOrder: original.sortOrder + 1,
      sourceEndpointId: original.sourceEndpointId,
      endpointParam: original.endpointParam,
      responsePath: original.responsePath,
      defaultValue: original.defaultValue,
    },
  })
  revalidatePath(`/erps/${erpId}`)
}

export async function deleteFieldSchema(id: number, erpId: number) {
  await requireAdmin()
  await prisma.eRPFieldSchema.delete({ where: { id } })
  revalidatePath(`/erps/${erpId}`)
}

export async function reorderFieldSchemas(erpId: number, orderedIds: number[]) {
  await requireAdmin()
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.eRPFieldSchema.update({ where: { id }, data: { sortOrder: index } })
    )
  )
  revalidatePath(`/erps/${erpId}`)
}
