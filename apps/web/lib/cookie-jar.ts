// Minimal RFC 6265 cookie jar for server-side ERP calls (session-cookie logins).
// One jar per company, persisted in CompanyCookieJar so every app instance sees it.
// ponytail: last write wins if two executions of the same company overlap.
// Swap for tough-cookie if an ERP needs SameSite/public-suffix handling.

type Cookie = { name: string; value: string; domain: string; hostOnly: boolean; path: string; secure: boolean; expiresAt: number | null }

const MAX_COOKIES = 200

function defaultPath(pathname: string): string {
  const i = pathname.lastIndexOf('/')
  return i <= 0 ? '/' : pathname.slice(0, i)
}

const isCookie = (c: unknown): c is Cookie => {
  const o = c as Cookie
  return !!o && typeof o.name === 'string' && typeof o.value === 'string' && typeof o.domain === 'string'
    && typeof o.path === 'string' && typeof o.hostOnly === 'boolean' && typeof o.secure === 'boolean'
    && (o.expiresAt === null || typeof o.expiresAt === 'number')
}

export class CookieJar {
  private cookies = new Map<string, Cookie>()
  /** True once store() or expiry changed the jar, so callers only persist when needed. */
  changed = false

  /** Rebuilds a jar from toJSON() output; anything malformed is dropped. */
  constructor(saved?: unknown) {
    if (!Array.isArray(saved)) return
    for (const c of saved.filter(isCookie).slice(0, MAX_COOKIES)) this.cookies.set(`${c.domain}|${c.path}|${c.name}`, c)
  }

  toJSON(): Cookie[] {
    return [...this.cookies.values()]
  }

  /** Stores the Set-Cookie headers of a response received from `url`. */
  store(setCookie: string | string[] | undefined, url: string, now = Date.now()) {
    if (!setCookie) return
    const { hostname, pathname } = new URL(url)
    const host = hostname.toLowerCase()
    for (const header of Array.isArray(setCookie) ? setCookie : [setCookie]) {
      const [pair, ...attrs] = header.split(';')
      const eq = pair.indexOf('=')
      if (eq <= 0) continue
      const cookie: Cookie = {
        name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(),
        domain: host, hostOnly: true, path: defaultPath(pathname), secure: false, expiresAt: null,
      }
      let maxAge: number | null = null
      for (const attr of attrs) {
        const [rawKey, ...rest] = attr.split('=')
        const key = rawKey.trim().toLowerCase()
        const val = rest.join('=').trim()
        if (key === 'domain' && val) {
          const d = val.replace(/^\./, '').toLowerCase()
          if (host !== d && !host.endsWith(`.${d}`)) { cookie.domain = ''; break } // foreign domain: reject
          cookie.domain = d
          cookie.hostOnly = false
        } else if (key === 'path' && val.startsWith('/')) cookie.path = val
        else if (key === 'secure') cookie.secure = true
        else if (key === 'max-age' && /^-?\d+$/.test(val)) maxAge = Number(val)
        else if (key === 'expires' && maxAge === null) {
          const t = Date.parse(val)
          if (!Number.isNaN(t)) cookie.expiresAt = t
        }
      }
      if (!cookie.domain) continue
      if (maxAge !== null) cookie.expiresAt = now + maxAge * 1000
      const id = `${cookie.domain}|${cookie.path}|${cookie.name}`
      if (cookie.expiresAt !== null && cookie.expiresAt <= now) this.changed = this.cookies.delete(id) || this.changed
      else if (this.cookies.has(id) || this.cookies.size < MAX_COOKIES) { this.cookies.set(id, cookie); this.changed = true }
    }
  }

  /** Value for the Cookie request header when calling `url`, or undefined. */
  header(url: string, now = Date.now()): string | undefined {
    const { hostname, pathname, protocol } = new URL(url)
    const host = hostname.toLowerCase()
    const matches: Cookie[] = []
    for (const [id, c] of this.cookies) {
      if (c.expiresAt !== null && c.expiresAt <= now) { this.cookies.delete(id); this.changed = true; continue }
      const domainOk = c.hostOnly ? host === c.domain : host === c.domain || host.endsWith(`.${c.domain}`)
      const pathOk = pathname === c.path || pathname.startsWith(c.path.endsWith('/') ? c.path : `${c.path}/`)
      if (domainOk && pathOk && (!c.secure || protocol === 'https:')) matches.push(c)
    }
    if (!matches.length) return undefined
    matches.sort((a, b) => b.path.length - a.path.length) // more specific paths first
    return matches.map((c) => `${c.name}=${c.value}`).join('; ')
  }
}
