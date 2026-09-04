import type { Operation } from './types.ts'

export type OperationInvalidReason =
  | 'missing'
  | 'failed'
  | 'superseded'
  | 'aborted'
  | 'stale_revision'

export type OperationValidity =
  | { ok: true }
  | { ok: false; reason: OperationInvalidReason }

/**
 * Single freshness/liveness check for analysis, Box, and WriteGate.
 * Do not add per-feature variants.
 */
export function evaluateOperationValidity(
  operation: Operation | null | undefined,
  sessionRevision: number,
): OperationValidity {
  if (!operation) return { ok: false, reason: 'missing' }
  if (operation.state === 'superseded') return { ok: false, reason: 'superseded' }
  if (operation.state === 'aborted') return { ok: false, reason: 'aborted' }
  if (operation.state === 'failed') return { ok: false, reason: 'failed' }
  if (operation.revision !== sessionRevision) return { ok: false, reason: 'stale_revision' }
  return { ok: true }
}

export function isOperationCurrent(
  operation: Operation | null | undefined,
  sessionRevision: number,
): boolean {
  return evaluateOperationValidity(operation, sessionRevision).ok
}
