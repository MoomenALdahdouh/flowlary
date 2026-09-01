import { addException, normalizeExceptionToken } from './exceptions.ts'
import { hashWritingSample } from '@flowlary/shared'
import {
  ACCEPTED_VOCAB_THRESHOLD,
  MAX_EVENTS,
  REVERT_EXCEPTION_THRESHOLD,
  type CorrectionEvent,
  type CorrectionEventKind,
} from './types.ts'

export function normalizeEvents(raw: unknown): CorrectionEvent[] {
  if (!Array.isArray(raw)) return []
  const events: CorrectionEvent[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const value = item as Partial<CorrectionEvent>
    const token = normalizeExceptionToken(value.token)
    if (!token) continue
    if (
      value.kind !== 'accepted' &&
      value.kind !== 'ignored' &&
      value.kind !== 'reverted'
    ) {
      continue
    }
    const replacement =
      typeof value.replacement === 'string' && value.replacement.trim()
        ? value.replacement
        : undefined
    const ts =
      typeof value.ts === 'number' && Number.isFinite(value.ts) ? value.ts : Date.now()
    events.push({ kind: value.kind, token, replacement, ts })
  }
  return events.slice(-MAX_EVENTS)
}

export function recordEvent(
  events: readonly CorrectionEvent[],
  kind: CorrectionEventKind,
  token: string,
  replacement?: string,
): CorrectionEvent[] {
  const normalized = normalizeExceptionToken(token)
  if (!normalized) return [...events]
  return normalizeEvents([
    ...events,
    { kind, token: normalized, replacement, ts: Date.now() },
  ])
}

export function revertCount(events: readonly CorrectionEvent[], token: string): number {
  return events.filter((event) => event.kind === 'reverted' && event.token === token).length
}

export function applyCorrectionEvent(
  events: readonly CorrectionEvent[],
  exceptions: readonly string[],
  kind: CorrectionEventKind,
  token: string,
  replacement?: string,
): { events: CorrectionEvent[]; exceptions: string[]; addedException: boolean } {
  const nextEvents = recordEvent(events, kind, token, replacement)
  const normalized = normalizeExceptionToken(token)
  if (!normalized) {
    return { events: nextEvents, exceptions: [...exceptions], addedException: false }
  }

  if (kind === 'ignored') {
    const nextExceptions = addException(exceptions, normalized)
    return {
      events: nextEvents,
      exceptions: nextExceptions,
      addedException: nextExceptions.length !== exceptions.length,
    }
  }

  if (
    kind === 'reverted' &&
    revertCount(nextEvents, normalized) >= REVERT_EXCEPTION_THRESHOLD
  ) {
    const nextExceptions = addException(exceptions, normalized)
    return {
      events: nextEvents,
      exceptions: nextExceptions,
      addedException: nextExceptions.length !== exceptions.length,
    }
  }

  return {
    events: nextEvents,
    exceptions: [...exceptions],
    addedException: false,
  }
}

/** Tokens accepted at least N times become personal vocabulary hashes. */
export function vocabularyHashesFromEvents(
  events: readonly CorrectionEvent[],
  threshold = ACCEPTED_VOCAB_THRESHOLD,
): string[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (event.kind !== 'accepted') continue
    const key = event.token.toLocaleLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const hashes: string[] = []
  for (const [token, count] of counts) {
    if (count < threshold) continue
    hashes.push(hashWritingSample(token))
  }
  return hashes
}
