/**
 * Central Write Gate. All field mutations should go through commitWriteTransaction.
 * Lives outside core/engine so the shadow tree never imports writers.
 */
import type { WriteOrigin, WriterTag } from '@flowlary/shared'
import { writeReplacement, type WriteReplacementOptions, type WriteResult } from '../dom/editor.ts'
import type { EditableElement } from '../dom/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import { isShadowEngineEnabled } from '../engine/flag.ts'
import {
  fieldKindFromElement,
  recordWriteTelemetry,
  type WriteTelemetryCapability,
} from '../observability/writeTelemetry.ts'
import { recordWritingAnalytics } from '../observability/writingAnalytics.ts'
import type { DecisionAction, TextOrigin } from '../engine/types.ts'
import { showCorrectionFlash } from './correctionFlash.ts'
import {
  evaluateWriteAuthorization,
  type WriteAuthorization,
  type WriteAuthorizationInvalidReason,
} from '../runtime/writeAuthorization.ts'
import { markOperationSucceeded } from '../runtime/Operation.ts'

export const WRITE_COOLDOWN_MS = 450

export type WriteTransactionOptions = WriteReplacementOptions & {
  session: FieldSession
  capability: WriteTelemetryCapability
  trigger?: 'auto' | 'shortcut' | 'suggestion_accept' | 'manual_box'
  engineOriginated?: boolean
  tagTranslated?: boolean
  textOrigin?: TextOrigin
  action?: DecisionAction
  cycleGeneration?: number
  authorization?: WriteAuthorization
}

function authorizationFailure(reason: WriteAuthorizationInvalidReason): WriteResult {
  if (
    reason === 'stale_revision'
    || reason === 'superseded'
    || reason === 'aborted'
    || reason === 'failed'
    || reason === 'missing'
    || reason === 'snapshot_mismatch'
    || reason === 'range_mismatch'
    || reason === 'range_text_mismatch'
  ) {
    return { verdict: 'stale', reason }
  }
  return { verdict: 'rejected', reason }
}

export function commitWriteTransaction(
  element: EditableElement,
  start: number,
  end: number,
  replacement: string,
  options: WriteTransactionOptions,
): WriteResult {
  const {
    session,
    capability,
    trigger = 'auto',
    engineOriginated = false,
    tagTranslated = false,
    textOrigin,
    action,
    cycleGeneration,
    authorization,
    auto = false,
    ...writeOptions
  } = options

  const intendedAction = action ?? capabilityToAction(capability)

  if (!authorization) {
    recordWriteTelemetry({
      capability,
      trigger,
      outcome: 'blocked',
      reasonCodes: ['policy_blocked'],
      fieldKind: fieldKindFromElement(element),
    })
    return { verdict: 'rejected', reason: 'unauthorized' }
  }

  const operation = session.operations.get(authorization.operationId)
  const authorized = evaluateWriteAuthorization({
    authorization,
    session,
    element,
    operation,
    start,
    end,
    replacement,
    action: intendedAction,
  })
  if (!authorized.ok) {
    const failure = authorizationFailure(authorized.reason)
    recordWriteTelemetry({
      capability,
      trigger,
      outcome: failure.verdict === 'stale' ? 'stale' : 'blocked',
      reasonCodes: [
        authorized.reason === 'stale_revision' || authorized.reason === 'superseded'
          ? 'stale_generation'
          : authorized.reason === 'aborted'
            ? 'aborted'
            : 'policy_blocked',
      ],
      fieldKind: fieldKindFromElement(element),
    })
    return failure
  }

  if (isShadowEngineEnabled() && engineOriginated) {
    recordWriteTelemetry({
      capability,
      trigger,
      outcome: 'blocked',
      reasonCodes: ['policy_blocked'],
      fieldKind: fieldKindFromElement(element),
      shadowOnly: true,
    })
    return { verdict: 'rejected', reason: 'shadow_only' }
  }

  if (auto && session.isInCooldown()) {
    recordWriteTelemetry({
      capability,
      trigger,
      outcome: 'noop',
      reasonCodes: ['policy_blocked'],
      fieldKind: fieldKindFromElement(element),
    })
    return { verdict: 'rejected', reason: 'cooldown' }
  }

  if (cycleGeneration !== undefined && session.getGeneration() !== cycleGeneration) {
    recordWriteTelemetry({
      capability,
      trigger,
      outcome: 'stale',
      reasonCodes: ['stale_generation'],
      fieldKind: fieldKindFromElement(element),
    })
    return { verdict: 'stale', reason: 'stale-generation' }
  }

  const result = writeReplacement(element, start, end, replacement, {
    ...writeOptions,
    session,
    auto,
    placeCaretAfter: writeOptions.placeCaretAfter,
  })

  if (result.verdict === 'written') {
    const op = session.operations.get(authorization.operationId)
    if (op) markOperationSucceeded(op)
    showCorrectionFlash(element, intendedAction)
    session.enterCooldown(WRITE_COOLDOWN_MS)
    session.noteEngineSpan(start, start + replacement.length, replacement)
    if (tagTranslated) {
      session.tagTranslatedOutput(start, start + replacement.length, replacement)
    }
    if (capability === 'correction') {
      session.tagCorrectedOutput(start, start + replacement.length, replacement)
    }
    recordWritingAnalytics({
      name: 'writing.write',
      action: intendedAction,
      trigger: trigger === 'manual_box' || trigger === 'suggestion_accept' ? 'shortcut' : trigger,
      outcome: 'applied',
      textOrigin: textOrigin ?? 'unknown',
      shadowOnly: false,
    })
  }

  recordWriteTelemetry({
    capability,
    trigger,
    outcome:
      result.verdict === 'written' ? 'applied' : result.verdict === 'stale' ? 'stale' : 'blocked',
    reasonCodes: [result.verdict === 'written' ? 'written' : 'text_mismatch'],
    fieldKind: fieldKindFromElement(element),
    rangeLength: Math.max(0, end - start),
  })

  return result
}

function capabilityToAction(capability: WriteTelemetryCapability): DecisionAction {
  if (capability === 'layout') return 'layout_fix'
  if (capability === 'translation') return 'translation'
  if (capability === 'correction') return 'english_correction'
  return 'noop'
}

export function writerForAction(action: DecisionAction): Extract<WriteOrigin, WriterTag> {
  if (action === 'layout_fix') return 'FIX_LAYOUT'
  if (action === 'translation') return 'TRANSLATE'
  return 'CORRECT'
}
