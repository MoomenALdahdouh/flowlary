/**
 * One active writing suggestion per field. Apply always goes through the Write Gate.
 * Authorization is Box identity (operation + revision + snapshot + range), never substring search.
 */
import { evaluateFieldSafety } from '../safety/index.ts'
import { readFieldText } from '../dom/read.ts'
import { InlineSuggestionCard } from '../../features/shared/InlineSuggestionCard.ts'
import { recordWritingAnalytics } from '../observability/writingAnalytics.ts'
import { recordWritingFeedback } from '../engine/writingFeedback.ts'
import { stateManager } from '../state/StateManager.ts'
import type { DecisionAction, TextOrigin, TextRange } from '../engine/types.ts'
import type { EditableElement } from '../dom/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import type { Operation } from '../runtime/types.ts'
import { isOperationCurrent } from '../runtime/validity.ts'
import { markOperationFailed } from '../runtime/Operation.ts'
import {
  createBoxSuggestion,
  evaluateBoxApplyAuthorization,
  writeAuthorizationFromBox,
  type BoxState,
  type BoxSuggestion,
} from '../runtime/suggestion.ts'
import { onFieldRevisionBump, requestSameRevisionReanalyze } from '../runtime/revisionBump.ts'
import { evaluateAutomaticArbitration, featureFromAction, noteBoxOccupant } from '../runtime/arbitration.ts'
import { shouldWholeFieldOwnEnglishCorrection } from '../../features/correction/liveAssist.ts'
import { commitWriteTransaction, writerForAction } from './writeGate.ts'

export type PipelineSuggestionRecord = {
  fieldId: string
  element: EditableElement
  session: FieldSession
  generation: number
  range: TextRange
  sourceText: string
  suggestion: string
  action: DecisionAction
  textOrigin: TextOrigin
  operation?: Operation
  identity?: BoxSuggestion
}

const active = new Map<string, PipelineSuggestionRecord>()
const cards = new Map<string, InlineSuggestionCard>()
let sameRevisionReanalysisCount = 0

onFieldRevisionBump((fieldId) => {
  const current = active.get(fieldId)
  if (!current) return
  if (current.identity) current.identity.state = 'stale'
  hideCard(fieldId)
})

function hideCard(fieldId: string): void {
  const current = active.get(fieldId)
  if (current?.identity && current.identity.state === 'ready') {
    current.identity.state = 'hidden'
  }
  if (current) noteBoxOccupant(current.session, null)
  cards.get(fieldId)?.hide()
  active.delete(fieldId)
}

export function resetPipelineSuggestionsForTests(): void {
  for (const fieldId of [...cards.keys()]) hideCard(fieldId)
  cards.clear()
  active.clear()
  sameRevisionReanalysisCount = 0
}

export function getSameRevisionReanalysisCountForTests(): number {
  return sameRevisionReanalysisCount
}

export function getActivePipelineSuggestion(fieldId: string): PipelineSuggestionRecord | null {
  return active.get(fieldId) ?? null
}

export function getPipelineSuggestionState(fieldId: string): BoxState {
  return active.get(fieldId)?.identity?.state ?? 'hidden'
}

export function hidePipelineSuggestion(fieldId: string): void {
  hideCard(fieldId)
}

export function hideEnglishPipelineSuggestion(fieldId: string): void {
  const current = active.get(fieldId)
  if (current?.action !== 'english_correction') return
  hideCard(fieldId)
}

function cardLabel(action: DecisionAction): string {
  if (action === 'layout_fix') return 'Typing'
  if (action === 'translation') return 'Translation'
  return 'English'
}

function resolveIdentity(input: PipelineSuggestionRecord): BoxSuggestion | null {
  const operation = input.operation ?? input.session.operations.begin({
    fieldId: input.session.field.id,
    revision: input.session.getRevision(),
    feature:
      input.action === 'translation'
        ? 'translate'
        : input.action === 'layout_fix'
          ? 'layout'
          : 'english',
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: readFieldText(input.element),
  })
  input.operation = operation
  if (!isOperationCurrent(operation, input.session.getRevision())) return null
  return createBoxSuggestion({
    operation,
    range: input.range,
    replacement: input.suggestion,
    action: input.action,
    textOrigin: input.textOrigin,
    state: 'ready',
  })
}

/**
 * Hide when identity is no longer valid. Never retargets by substring
 * and never restamps revision onto an old suggestion.
 */
export function invalidateStalePipelineSuggestion(
  session: FieldSession,
  text: string,
): void {
  const current = active.get(session.field.id)
  if (!current?.identity) {
    if (current && current.generation !== session.getRevision()) hideCard(session.field.id)
    return
  }
  const identity = current.identity
  if (identity.revision !== session.getRevision()) {
    identity.state = 'stale'
    hideCard(session.field.id)
    return
  }
    if (text !== identity.snapshotFullText) {
      identity.state = 'stale'
      if (current.operation) markOperationFailed(current.operation)
      hideCard(session.field.id)
      if (session.trySameRevisionReanalysis()) {
        sameRevisionReanalysisCount += 1
        requestSameRevisionReanalyze(session.field.id)
      }
      return
    }
  if (text.slice(identity.range.start, identity.range.end) !== identity.rangeText) {
    identity.state = 'stale'
    hideCard(session.field.id)
  }
}

export function presentPipelineSuggestion(input: PipelineSuggestionRecord): void {
  const { fieldId, element, suggestion, action, session, operation } = input
  if (!readFieldText(element).trim()) {
    hidePipelineSuggestion(fieldId)
    return
  }
  if (operation && !isOperationCurrent(operation, session.getRevision())) {
    return
  }
  if (action === 'english_correction' && shouldWholeFieldOwnEnglishCorrection()) {
    hideCard(fieldId)
    return
  }

  const occupant = active.get(fieldId)
  const decision = evaluateAutomaticArbitration({
    session,
    operation: operation ?? session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: featureFromAction(action),
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: readFieldText(element),
    }),
    feature: featureFromAction(action),
    action,
    effect: 'box',
    range: input.range,
    replacement: suggestion,
    boxOccupant: occupant ? featureFromAction(occupant.action) : null,
    resume: () => {
      presentPipelineSuggestion(input)
    },
  })
  if (decision.verdict === 'DEFER') return
  if (decision.verdict !== 'ALLOW') return

  const identity = resolveIdentity(input)
  if (!identity) return
  if (identity.revision !== session.getRevision()) return

  const existing = active.get(fieldId)
  let card = cards.get(fieldId)
  if (!card || existing?.action !== action) {
    hideCard(fieldId)
    card = new InlineSuggestionCard({
      label: cardLabel(action),
      onApply: () => {
        applyPipelineSuggestion(fieldId)
      },
      onDismiss: () => {
        dismissPipelineSuggestion(fieldId)
      },
    })
    cards.set(fieldId, card)
  }
  card.setLabel(cardLabel(action))

  const record: PipelineSuggestionRecord = { ...input, identity, generation: identity.revision }
  const sameVisibleOffer =
    existing?.identity?.operationId === identity.operationId
    && existing?.suggestion === suggestion
    && existing?.sourceText === input.sourceText
    && card.isVisible()

  active.set(fieldId, record)
  noteBoxOccupant(session, featureFromAction(action))
  if (sameVisibleOffer) {
    card.refresh()
    return
  }
  card.show(
    {
      element,
      start: input.range.start,
      end: input.range.end,
      suggestion,
    },
    'ltr',
    undefined,
    action === 'layout_fix' ? ['layout'] : action === 'english_correction' ? ['spelling'] : [],
  )

  recordWritingAnalytics({
    name: 'writing.suggestion',
    action,
    trigger: 'auto',
    outcome: 'suggestion',
    textOrigin: input.textOrigin,
    reasonCodes: ['help_style_requires_suggestion'],
    shadowOnly: false,
  })
}

export function dismissPipelineSuggestion(fieldId: string): 'dismissed' | 'missing' {
  const current = active.get(fieldId)
  if (!current) {
    hideCard(fieldId)
    return 'missing'
  }
  if (current.identity) current.identity.state = 'dismissed'
  current.session.noteUserOverride(current.range.start, current.range.end)
  recordWritingFeedback({
    tokenHash: 'suggestion',
    action: current.action,
    outcome: 'dismiss',
  })
  recordWritingAnalytics({
    name: 'writing.suggestion',
    action: current.action,
    trigger: 'suggestion_dismiss',
    outcome: 'dismissed',
    textOrigin: current.textOrigin,
    reasonCodes: ['help_style_requires_suggestion', 'user_override'],
    shadowOnly: false,
  })
  hideCard(fieldId)
  return 'dismissed'
}

export function applyPipelineSuggestion(
  fieldId: string,
): 'applied' | 'stale' | 'blocked' | 'missing' {
  const current = active.get(fieldId)
  if (!current?.identity) return 'missing'

  const { element, session, suggestion, action, textOrigin, identity } = current
  const operation = current.operation ?? session.operations.get(identity.operationId)
  const authorized = evaluateBoxApplyAuthorization({
    suggestion: identity,
    session,
    element,
    operation,
  })
  if (!authorized.ok) {
    identity.state = authorized.reason === 'not_ready' ? identity.state : 'stale'
    recordWritingAnalytics({
      name: 'writing.suggestion',
      action,
      trigger: 'suggestion_accept',
      outcome: 'stale',
      textOrigin,
      reasonCodes: [authorized.reason],
      shadowOnly: false,
    })
    hideCard(fieldId)
    return 'stale'
  }

  identity.state = 'applying'

  const hostname = typeof location !== 'undefined' ? location.hostname : ''
  const live = readFieldText(element)
  const safety = evaluateFieldSafety(element, {
    hostname,
    excludedDomains: stateManager.settings.excludedDomains,
    text: live,
  })
  if (!safety.allowed) {
    identity.state = 'error'
    recordWritingAnalytics({
      name: 'writing.suggestion',
      action,
      trigger: 'suggestion_accept',
      outcome: 'failed',
      textOrigin,
      reasonCodes: ['protected_context'],
      shadowOnly: false,
    })
    hideCard(fieldId)
    return 'blocked'
  }

  const writer = writerForAction(action)
  const acquired = session.tryAcquireWrite(writer)
  if (!acquired.ok) {
    identity.state = 'ready'
    recordWritingAnalytics({
      name: 'writing.suggestion',
      action,
      trigger: 'suggestion_accept',
      outcome: 'failed',
      textOrigin,
      reasonCodes: ['mutex_held'],
      shadowOnly: false,
    })
    return 'blocked'
  }

  let writeVerdict: 'written' | 'stale' | 'rejected' | undefined
  try {
    const still = evaluateBoxApplyAuthorization({
      suggestion: { ...identity, state: 'ready' },
      session,
      element,
      operation,
    })
    if (!still.ok) {
      identity.state = 'stale'
      hideCard(fieldId)
      return 'stale'
    }

    const ticket = writeAuthorizationFromBox({
      suggestion: { ...identity, state: 'ready' },
      operation,
    })
    if (!ticket.ok) {
      identity.state = 'stale'
      hideCard(fieldId)
      return 'stale'
    }

    const write = commitWriteTransaction(element, identity.range.start, identity.range.end, suggestion, {
      session,
      requestId: acquired.requestId,
      expectedGeneration: identity.revision,
      cycleGeneration: identity.revision,
      origin: writer,
      auto: false,
      engineOriginated: false,
      capability: action === 'layout_fix' ? 'layout' : action === 'translation' ? 'translation' : 'correction',
      trigger: 'suggestion_accept',
      textOrigin,
      action,
      tagTranslated: action === 'translation',
      allowActiveEdit: true,
      authorization: ticket.authorization,
    })
    writeVerdict = write.verdict === 'written' ? 'written' : write.verdict === 'stale' ? 'stale' : 'rejected'
    if (write.verdict !== 'written') {
      identity.state = 'stale'
      recordWritingAnalytics({
        name: 'writing.suggestion',
        action,
        trigger: 'suggestion_accept',
        outcome: write.verdict === 'stale' ? 'stale' : 'failed',
        textOrigin,
        reasonCodes: [write.reason ?? 'unauthorized'],
        shadowOnly: false,
      })
      hideCard(fieldId)
      return write.verdict === 'stale' ? 'stale' : 'blocked'
    }
    identity.state = 'hidden'
    hideCard(fieldId)
    return 'applied'
  } finally {
    session.releaseWrite(writer, acquired.requestId)
    if (identity.state === 'applying' && writeVerdict !== 'written') {
      identity.state = 'stale'
      hideCard(fieldId)
    }
  }
}
