import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'ERPs' }

import { getERPs } from '@/lib/actions/erps'
import { ERPsClient } from './erps-client'

export const dynamic = 'force-dynamic'

export default async function ERPsPage() {
  const erps = await getERPs()
  return <ERPsClient erps={erps} />
}
