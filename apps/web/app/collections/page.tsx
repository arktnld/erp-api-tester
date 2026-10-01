import { getAllCollections, getCollectionStructure } from '@/app/actions/collections'
import { CollectionsClient } from './collections-client'

export default async function CollectionsPage() {
  const collections = await getAllCollections()
  const initial = collections[0] ? await getCollectionStructure(collections[0].id) : null

  return <CollectionsClient collections={collections} initialData={initial} />
}
