const KEEP = ['next', 'intent', 'student', 'token'] as const

export function accountAuthHref(
  mode: 'login' | 'register',
  search: Pick<URLSearchParams, 'get'>,
): string {
  const next = new URLSearchParams()
  for (const key of KEEP) {
    const value = search.get(key)
    if (value) next.set(key, value)
  }
  if (mode === 'register') next.set('mode', 'register')
  const query = next.toString()
  return query ? `/account?${query}` : '/account'
}
