export type OperationFeature = 'layout' | 'translate' | 'english' | 'pipeline' | 'shortcut'

export type OperationTrigger =
  | 'auto'
  | 'shortcut'
  | 'suggestion_accept'
  | 'manual_box'
  | 'focus_out'

export type OperationPurpose = 'auto-analysis' | 'shortcut' | 'focus-out' | 'manual_box'

export type OperationState =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'aborted'
  | 'superseded'

/**
 * Unit of writing work. `revision` is a copy of FieldRevision at creation and
 * must never be rewritten. `operationId` is identity only, not freshness.
 */
export type Operation = {
  readonly operationId: string
  readonly fieldId: string
  readonly revision: number
  readonly feature: OperationFeature
  readonly purpose: OperationPurpose
  readonly trigger: OperationTrigger
  readonly snapshotFullText: string
  readonly snapshotHash: string
  readonly abort: AbortController
  state: OperationState
}

export type CreateOperationInput = {
  fieldId: string
  revision: number
  feature: OperationFeature
  purpose: OperationPurpose
  trigger: OperationTrigger
  snapshotFullText: string
}

export function operationCoalesceKey(
  fieldId: string,
  revision: number,
  feature: OperationFeature,
  purpose: OperationPurpose,
): string {
  return `${fieldId}\0${revision}\0${feature}\0${purpose}`
}

export function isOperationLive(operation: Operation): boolean {
  return operation.state === 'pending' || operation.state === 'running'
}

/** Freshness: captured revision must equal the session clock and the op must not be dead. */
export function isOperationFresh(operation: Operation, sessionRevision: number): boolean {
  if (operation.revision !== sessionRevision) return false
  if (
    operation.state === 'superseded'
    || operation.state === 'failed'
    || operation.state === 'aborted'
  ) {
    return false
  }
  return true
}

export function isOperationPermanentlyStale(operation: Operation, sessionRevision: number): boolean {
  return operation.revision < sessionRevision || operation.state === 'superseded'
}
