import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { attemptLogin, safeNext } from '@/lib/login'
import { SESSION_COOKIE, createSession, sessionCookieOptions } from '@/lib/session'

// Login is a route handler, not a server action: the proxy refuses every server action
// without a session, so no action can be reached through a public page.
const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
  remember: z.boolean().default(true),
})
const INVALID = 'E-mail ou senha inválidos.'

export async function POST(req: NextRequest) {
  // Login CSRF: only accept logins posted from this site. Compared with the Host header,
  // not req.nextUrl (that is the server's own bind address, e.g. localhost).
  const origin = req.headers.get('origin')
  let sameSite = true
  if (origin) { try { sameSite = new URL(origin).host === req.headers.get('host') } catch { sameSite = false } }
  if (!sameSite) return NextResponse.json({ error: 'Origem inválida' }, { status: 403 })

  const parsed = LoginSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: INVALID }, { status: 400 })

  const userId = await attemptLogin(parsed.data.email, parsed.data.password)
  if (!userId) return NextResponse.json({ error: INVALID }, { status: 401 })

  const res = NextResponse.json({ redirect: safeNext(parsed.data.next) })
  const secure = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https'
  res.cookies.set(SESSION_COOKIE, await createSession(userId), sessionCookieOptions(secure, parsed.data.remember))
  return res
}
