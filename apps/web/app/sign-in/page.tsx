import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { SignInClient } from './sign-in-client'

export const metadata: Metadata = { title: 'Login' }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getSessionUser()) redirect('/')
  const { next } = await searchParams
  return <SignInClient next={next ?? ''} />
}
