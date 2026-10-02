import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/require-role'
import { Journey } from './journey'

export const metadata: Metadata = { title: 'Primeira configuração' }

export default async function SetupPage() {
  await requireAdmin()
  return <Journey />
}
