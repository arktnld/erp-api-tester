import { notFound } from 'next/navigation'
import { getRecordForEdit } from '@/app/actions/records'
import { RecordDetailClient } from './record-detail-client'

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getRecordForEdit(Number(id))
  if (!record) notFound()
  return <RecordDetailClient record={record} />
}
