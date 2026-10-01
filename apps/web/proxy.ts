import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, validateSessionToken } from '@/lib/session'

// Everything needs a valid session except the login page/endpoint and shared record links.
const isPublic = (path: string) =>
  path === '/sign-in' || path === '/api/login' || /^\/records\/[^/]+\/view$/.test(path)

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  // Server actions are POSTs that run by id on whatever path they're sent to, public pages
  // included, so an action call never counts as public (login is a route handler for this).
  const isAction = request.headers.has('next-action')
  if (isPublic(pathname) && !isAction) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const session = await validateSessionToken(token)
  if (!session) {
    if (pathname.startsWith('/api/') || isAction) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const login = new URL('/sign-in', request.url)
    if (pathname !== '/') login.searchParams.set('next', pathname + search)
    const res = NextResponse.redirect(login)
    if (token) res.cookies.delete(SESSION_COOKIE)
    return res
  }

  // The cookie itself is left alone: it lasts what the user chose at login ("Lembrar-me").
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Only Next's own build assets and the app icons skip the proxy. (A file-extension
    // pattern would also let `/companies/x.png` or `/a.csv/b` through.)
    '/((?!_next/static/|_next/image|favicon\\.ico$|icon\\.png$|apple-icon\\.png$).*)',
  ],
}
