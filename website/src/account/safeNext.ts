export type SafeNext = 'lab' | 'checkout'

const PENDING_NEXT_KEY = 'flowlary.auth.next'

export function parseSafeNext(raw: string | null): SafeNext | null {
  if (raw === 'lab' || raw === 'checkout') return raw
  return null
}

export function storePendingNext(next: SafeNext): void {
  try {
    sessionStorage.setItem(PENDING_NEXT_KEY, next)
  } catch {
    /* ignore */
  }
}

export function readPendingNext(): SafeNext | null {
  try {
    return parseSafeNext(sessionStorage.getItem(PENDING_NEXT_KEY))
  } catch {
    return null
  }
}

export function clearPendingNext(): void {
  try {
    sessionStorage.removeItem(PENDING_NEXT_KEY)
  } catch {
    /* ignore */
  }
}

export function resolvePostAuthDestination(next: SafeNext | null): string {
  if (next === 'lab') return '/#writing-lab'
  return '/account'
}
