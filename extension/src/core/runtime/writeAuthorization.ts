import { hashWritingSample } from '@flowlary/shared'
import { readFieldText } from '../dom/read.ts'
import type { EditableElement } from '../dom/types.ts'
import type { DecisionAction } from '../engine/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import { markOperationRunning } from './Operation.ts'
import type { Operation, OperationFeature, OperationPurpose, OperationTrigger } from './types.ts'
import { evaluateOperationValidity, type OperationInvalidReason } from './validity.ts'

export type WriteAuthorization = {
  readonly authorizationId: string
  readonly operationId: string
  readonly fieldId: string
  readonly revision: number
  readonly action: DecisionAction
  readonly snapshotFullText: string
  readonly snapshotHash: string
  readonly range: { readonly start: number; readonly end: number }
  readonly rangeText: string
  readonly replacement: string
}

export type WriteAuthorizationInvalidReason =
  | OperationInvalidReason
  | 'disconnected'
  | 'field_mismatch'
  | 'operation_mismatch'
  | 'action_mismatch'
  | 'replacement_mismatch'
  | 'snapshot_mismatch'
  | 'range_mismatch'
  | 'range_text_mismatch'

export type WriteAuthorizationValidity =
  | { ok: true }
  | { ok: false; reason: WriteAuthorizationInvalidReason }

let nextAuthorizationSeq = 0

export function resetWriteAuthorizationIdsForTests(): void {
  nextAuthorizationSeq = 0
}

function lockAuthorization(authorization: WriteAuthorization): void {
  Object.defineProperty(authorization, 'range', {
    value: Object.freeze({ start: authorization.range.start, end: authorization.range.end }),
    writable: false,
    configurable: false,
    enumerable: true,
  })
  for (const key of [
    'authorizationId',
    'operationId',
    'fieldId',
    'revision',
    'action',
    'snapshotFullText',
    'snapshotHash',
    'rangeText',
    'replacement',
  ] as const) {
    Object.defineProperty(authorization, key, {
      value: authorization[key],
      writable: false,
      configurable: false,
      enumerable: true,
    })
  }
  Object.preventExtensions(authorization)
}

export function createWriteAuthorization(input: {
  operation: Operation
  action: DecisionAction
  range: { start: number; end: number }
  replacement: string
}): WriteAuthorization {
  const snapshotFullText = input.operation.snapshotFullText
  const authorization = {
    authorizationId: `wa-${++nextAuthorizationSeq}`,
    operationId: input.operation.operationId,
    fieldId: input.operation.fieldId,
    revision: input.operation.revision,
    action: input.action,
    snapshotFullText,
    snapshotHash: input.operation.snapshotHash || hashWritingSample(snapshotFullText),
    range: { start: input.range.start, end: input.range.end },
    rangeText: snapshotFullText.slice(input.range.start, input.range.end),
    replacement: input.replacement,
  } as WriteAuthorization
  lockAuthorization(authorization)
  return authorization
}

function featureForAction(action: DecisionAction): OperationFeature {
  if (action === 'layout_fix') return 'layout'
  if (action === 'translation') return 'translate'
  return 'english'
}

export function authorizationForOperationWrite(input: {
  session: FieldSession
  operation?: Operation
  action: DecisionAction
  range: { start: number; end: number }
  replacement: string
  snapshotFullText: string
  purpose?: OperationPurpose
  trigger?: OperationTrigger
}): WriteAuthorization {
  const operation = input.operation ?? input.session.operations.begin({
    fieldId: input.session.field.id,
    revision: input.session.getRevision(),
    feature: featureForAction(input.action),
    purpose: input.purpose ?? 'auto-analysis',
    trigger: input.trigger ?? 'auto',
    snapshotFullText: input.snapshotFullText,
  })
  if (operation.state === 'pending') markOperationRunning(operation)
  return createWriteAuthorization({
    operation,
    action: input.action,
    range: input.range,
    replacement: input.replacement,
  })
}

/**
 * Shortcut / manual writes that did not come from an analysis Operation.
 * Analysis results must use createWriteAuthorization from that Operation.
 */
export function issueImmediateWriteAuthorization(input: {
  session: FieldSession
  action: DecisionAction
  range: { start: number; end: number }
  replacement: string
  snapshotFullText: string
  purpose?: OperationPurpose
  trigger?: OperationTrigger
}): WriteAuthorization {
  return authorizationForOperationWrite({
    ...input,
    purpose: input.purpose ?? 'shortcut',
    trigger: input.trigger ?? 'shortcut',
  })
}

export function evaluateWriteAuthorization(input: {
  authorization: WriteAuthorization
  session: FieldSession
  element: EditableElement
  operation: Operation | null | undefined
  start: number
  end: number
  replacement: string
  action: DecisionAction
}): WriteAuthorizationValidity {
  const { authorization, session, element, operation, start, end, replacement, action } = input
  if (!element.isConnected) return { ok: false, reason: 'disconnected' }
  if (session.field.id !== authorization.fieldId) return { ok: false, reason: 'field_mismatch' }

  const opValidity = evaluateOperationValidity(operation, session.getRevision())
  if (!opValidity.ok) return opValidity

  if (!operation || operation.operationId !== authorization.operationId) {
    return { ok: false, reason: 'operation_mismatch' }
  }
  if (operation.revision !== authorization.revision) return { ok: false, reason: 'stale_revision' }
  if (authorization.revision !== session.getRevision()) return { ok: false, reason: 'stale_revision' }
  if (authorization.action !== action) return { ok: false, reason: 'action_mismatch' }
  if (authorization.replacement !== replacement) return { ok: false, reason: 'replacement_mismatch' }
  if (authorization.range.start !== start || authorization.range.end !== end) {
    return { ok: false, reason: 'range_mismatch' }
  }

  const live = readFieldText(element)
  if (live !== authorization.snapshotFullText) return { ok: false, reason: 'snapshot_mismatch' }
  if (
    authorization.range.start < 0
    || authorization.range.end < authorization.range.start
    || authorization.range.end > live.length
  ) {
    return { ok: false, reason: 'range_mismatch' }
  }
  if (live.slice(authorization.range.start, authorization.range.end) !== authorization.rangeText) {
    return { ok: false, reason: 'range_text_mismatch' }
  }
  return { ok: true }
}
