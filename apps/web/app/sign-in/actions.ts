'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, deleteSessionToken } from '@/lib/session'

// Login lives in app/api/login/route.ts (the proxy blocks server actions without a session).
export async function logout() {
  const jar = await cookies()
  await deleteSessionToken(jar.get(SESSION_COOKIE)?.value)
  jar.delete(SESSION_COOKIE)
  redirect('/sign-in')
}
