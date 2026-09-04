export type SafeNext = 'lab' | 'checkout' | 'feedback' | 'feedback-features' | 'feedback-support'

const PENDING_NEXT_KEY = 'flowlary.auth.next'
const SAFE_NEXT = new Set<SafeNext>(['lab', 'checkout', 'feedback', 'feedback-features', 'feedback-support'])

export function parseSafeNext(raw: string | null): SafeNext | null {
  if (raw && SAFE_NEXT.has(raw as SafeNext)) return raw as SafeNext
  return null
}

export function feedbackNextFromTab(tab: 'feedback' | 'features' | 'support'): SafeNext {
  if (tab === 'features') return 'feedback-features'
  if (tab === 'support') return 'feedback-support'
  return 'feedback'
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
  if (next === 'lab') return '/dashboard#lab'
  if (next === 'feedback') return '/feedback'
  if (next === 'feedback-features') return '/feedback?tab=features'
  if (next === 'feedback-support') return '/feedback?tab=support'
  return '/dashboard'
}
