import { hashWritingSample } from '@flowlary/shared'
import type { EditableElement } from '../dom/types.ts'
import type { DecisionAction, TextOrigin } from '../engine/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import type { Operation } from './types.ts'
import {
  createWriteAuthorization,
  evaluateWriteAuthorization,
  type WriteAuthorization,
  type WriteAuthorizationInvalidReason,
} from './writeAuthorization.ts'

export type BoxState =
  | 'hidden'
  | 'pending'
  | 'ready'
  | 'applying'
  | 'stale'
  | 'dismissed'
  | 'error'

export type BoxSuggestion = {
  operationId: string
  revision: number
  fieldId: string
  snapshotFullText: string
  snapshotHash: string
  range: { start: number; end: number }
  rangeText: string
  replacement: string
  action: DecisionAction
  state: BoxState
  textOrigin: TextOrigin
}

export type BoxApplyInvalidReason =
  | 'not_ready'
  | 'disconnected'
  | 'field_mismatch'
  | 'missing_operation'
  | 'failed'
  | 'superseded'
  | 'aborted'
  | 'stale_revision'
  | 'snapshot_mismatch'
  | 'range_mismatch'
  | 'range_text_mismatch'
  | 'action_mismatch'
  | 'replacement_mismatch'
  | 'operation_mismatch'

export type BoxApplyValidity =
  | { ok: true }
  | { ok: false; reason: BoxApplyInvalidReason }

export function createBoxSuggestion(input: {
  operation: Operation
  range: { start: number; end: number }
  replacement: string
  action: DecisionAction
  textOrigin: TextOrigin
  state?: BoxState
}): BoxSuggestion {
  const snapshotFullText = input.operation.snapshotFullText
  return {
    operationId: input.operation.operationId,
    revision: input.operation.revision,
    fieldId: input.operation.fieldId,
    snapshotFullText,
    snapshotHash: input.operation.snapshotHash || hashWritingSample(snapshotFullText),
    range: { start: input.range.start, end: input.range.end },
    rangeText: snapshotFullText.slice(input.range.start, input.range.end),
    replacement: input.replacement,
    action: input.action,
    state: input.state ?? 'ready',
    textOrigin: input.textOrigin,
  }
}

function toBoxReason(reason: WriteAuthorizationInvalidReason): BoxApplyInvalidReason {
  if (reason === 'missing') return 'missing_operation'
  return reason
}

export function writeAuthorizationFromBox(input: {
  suggestion: BoxSuggestion
  operation: Operation | null | undefined
}): { ok: true; authorization: WriteAuthorization } | { ok: false; reason: BoxApplyInvalidReason } {
  const { suggestion, operation } = input
  if (suggestion.state !== 'ready' && suggestion.state !== 'applying') {
    return { ok: false, reason: 'not_ready' }
  }
  if (!operation) return { ok: false, reason: 'missing_operation' }
  if (operation.operationId !== suggestion.operationId) {
    return { ok: false, reason: 'operation_mismatch' }
  }
  const authorization = createWriteAuthorization({
    operation,
    action: suggestion.action,
    range: suggestion.range,
    replacement: suggestion.replacement,
  })
  if (authorization.revision !== suggestion.revision) return { ok: false, reason: 'stale_revision' }
  if (authorization.fieldId !== suggestion.fieldId) return { ok: false, reason: 'field_mismatch' }
  if (authorization.snapshotFullText !== suggestion.snapshotFullText) {
    return { ok: false, reason: 'snapshot_mismatch' }
  }
  if (
    authorization.range.start !== suggestion.range.start
    || authorization.range.end !== suggestion.range.end
  ) {
    return { ok: false, reason: 'range_mismatch' }
  }
  if (authorization.rangeText !== suggestion.rangeText) {
    return { ok: false, reason: 'range_text_mismatch' }
  }
  if (authorization.action !== suggestion.action) return { ok: false, reason: 'action_mismatch' }
  if (authorization.replacement !== suggestion.replacement) {
    return { ok: false, reason: 'replacement_mismatch' }
  }
  return { ok: true, authorization }
}

export function evaluateBoxApplyAuthorization(input: {
  suggestion: BoxSuggestion
  session: FieldSession
  element: EditableElement
  operation: Operation | null | undefined
}): BoxApplyValidity {
  const ticket = writeAuthorizationFromBox(input)
  if (!ticket.ok) return ticket
  const check = evaluateWriteAuthorization({
    authorization: ticket.authorization,
    session: input.session,
    element: input.element,
    operation: input.operation,
    start: input.suggestion.range.start,
    end: input.suggestion.range.end,
    replacement: input.suggestion.replacement,
    action: input.suggestion.action,
  })
  if (!check.ok) return { ok: false, reason: toBoxReason(check.reason) }
  return { ok: true }
}
