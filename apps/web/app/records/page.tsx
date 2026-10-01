import { getRecords, getErpsForRecord, getCategories } from '@/app/actions/records'
import { RecordsClient } from './records-client'

export default async function RecordsPage() {
  const [records, erps, categories] = await Promise.all([
    getRecords(),
    getErpsForRecord(),
    getCategories(),
  ])
  return <RecordsClient records={records} erps={erps} categories={categories} />
}
