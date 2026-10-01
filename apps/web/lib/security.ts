import { BlockList, isIP, type LookupFunction } from 'node:net'
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'

// Non-public ranges. BlockList also matches IPv4-mapped IPv6 (::ffff:127.0.0.1).
const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
] as const) blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96],
] as const) blocked.addSubnet(net, prefix, 'ipv6')

export function isPrivateIp(ip: string): boolean {
  const family = isIP(ip)
  if (family === 0) return false
  return blocked.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

/** URL.hostname keeps IPv6 brackets ("[::1]"); sockets and isIP() need them stripped. */
export function bareHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
}

/**
 * Rejects non-HTTP schemes, localhost and literal private IPs. Hostnames are checked
 * again after DNS resolution by `publicOnlyLookup`, so rebinding tricks don't pass.
 */
export function validatePublicUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`URL inválida: ${url}`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Protocolo não permitido: ${parsed.protocol}`)
  }
  const host = bareHostname(parsed)
  if (host === 'localhost' || host.endsWith('.localhost') || isPrivateIp(host)) {
    throw new Error(`URL bloqueada (SSRF): ${host}`)
  }
}

/** `lookup` for http(s).request that refuses hostnames resolving to non-public addresses. */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, '', 0)
    const bad = addresses.find((a) => isPrivateIp(a.address))
    if (bad) return callback(new Error(`URL bloqueada (SSRF): ${hostname} -> ${bad.address}`), '', 0)
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
}
