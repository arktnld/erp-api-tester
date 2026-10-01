import type { Metadata } from 'next'
import { prisma } from '@erp/db'
import { requireAdmin } from '@/lib/require-role'
import { ERP_TEMPLATES } from '@/lib/erp-templates'
import { Journey } from './journey'

export const metadata: Metadata = { title: 'Primeira configuração' }

export default async function SetupPage() {
  await requireAdmin()
  const existing = (await prisma.eRP.findMany({ select: { name: true } })).map((e) => e.name)
  return <Journey templates={ERP_TEMPLATES} existing={existing} />
}
