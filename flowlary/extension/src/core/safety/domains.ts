export function normalizeExcludedDomains(domains: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of domains) {
    const host = raw.trim().toLowerCase().replace(/^\.+/, '')
    if (!host || seen.has(host)) continue
    seen.add(host)
    out.push(host)
  }
  return out
}

export function isExcludedHost(hostname: string, excluded: string[]): boolean {
  const host = hostname.toLowerCase()
  for (const entry of excluded) {
    if (host === entry || host.endsWith(`.${entry}`)) return true
  }
  return false
}
