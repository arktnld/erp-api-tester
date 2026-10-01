import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'ERP' }

import { getERP } from '@/lib/actions/erps'
import { ERPDetailClient } from './erp-detail-client'

export const dynamic = 'force-dynamic'

export default async function ERPDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const erp = await getERP(Number(id))
  return <ERPDetailClient erp={erp} />
}
