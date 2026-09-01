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

/** User preference: pause or resume a hostname. Not a developer allowlist. */
export function withHostExclusion(
  excluded: string[],
  hostname: string,
  exclude: boolean,
): string[] {
  const host = hostname.trim().toLowerCase().replace(/^\.+/, '')
  const base = normalizeExcludedDomains(excluded)
  if (!host) return base
  if (exclude) return normalizeExcludedDomains([...base, host])
  return base.filter((entry) => host !== entry && !host.endsWith(`.${entry}`))
}
