import type { OperationType } from '@flowlary/shared'

/** Normalized command outcomes — never leak feature-specific shapes to InputEngine. */
export type DispatchStatus =
  | 'success'
  | 'blocked'
  | 'no_target'
  | 'feature_not_ported'
  | 'busy'
  | 'stale'
  | 'aborted'
  | 'error'
  | 'speed_box'

export type DispatchResult = {
  status: DispatchStatus
  operation?: OperationType | 'SPEED_BOX'
  fieldId?: string
  reason?: string
  handlerExecuted: boolean
}

export function mapHandlerResult(
  operation: OperationType,
  fieldId: string | undefined,
  result: { ok: boolean; error?: string; stale?: boolean; aborted?: boolean },
): DispatchResult {
  if (result.stale) {
    return { status: 'stale', operation, fieldId, handlerExecuted: true }
  }
  if (result.aborted) {
    return { status: 'aborted', operation, fieldId, handlerExecuted: true }
  }
  if (result.error === 'feature_not_ported') {
    return { status: 'feature_not_ported', operation, fieldId, handlerExecuted: true }
  }
  if (result.ok) {
    return { status: 'success', operation, fieldId, handlerExecuted: true }
  }
  return {
    status: 'error',
    operation,
    fieldId,
    reason: result.error ?? 'error',
    handlerExecuted: true,
  }
}
