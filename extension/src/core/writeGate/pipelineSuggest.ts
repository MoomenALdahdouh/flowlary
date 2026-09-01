/**
 * One active writing suggestion per field. Apply always goes through the Write Gate.
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
}

const active = new Map<string, PipelineSuggestionRecord>()
const cards = new Map<string, InlineSuggestionCard>()

function cardLabel(action: DecisionAction): string {
  if (action === 'layout_fix') return 'Typing'
  if (action === 'translation') return 'Translation'
  return 'English assist'
}

function hideCard(fieldId: string): void {
  cards.get(fieldId)?.hide()
  active.delete(fieldId)
}

export function resetPipelineSuggestionsForTests(): void {
  for (const fieldId of [...cards.keys()]) hideCard(fieldId)
  cards.clear()
  active.clear()
}

export function getActivePipelineSuggestion(fieldId: string): PipelineSuggestionRecord | null {
  return active.get(fieldId) ?? null
}

export function hidePipelineSuggestion(fieldId: string): void {
  hideCard(fieldId)
}

export function invalidateStalePipelineSuggestion(
  session: FieldSession,
  text: string,
): void {
  const current = active.get(session.field.id)
  if (!current) return
  const slice = text.slice(current.range.start, current.range.end)
  if (current.generation !== session.getGeneration() || slice !== current.sourceText) {
    hideCard(session.field.id)
  }
}

export function presentPipelineSuggestion(input: PipelineSuggestionRecord): void {
  const { fieldId, element, suggestion, action } = input
  hideCard(fieldId)

  let card = cards.get(fieldId)
  if (!card) {
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

  active.set(fieldId, input)
  card.show(
    {
      element,
      start: input.range.start,
      end: input.range.end,
      suggestion,
    },
    'ltr',
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
  if (!current) return 'missing'

  const { element, session, generation, range, sourceText, suggestion, action, textOrigin } =
    current
  const live = readFieldText(element)
  const slice = live.slice(range.start, range.end)
  if (session.getGeneration() !== generation || slice !== sourceText) {
    recordWritingAnalytics({
      name: 'writing.suggestion',
      action,
      trigger: 'suggestion_accept',
      outcome: 'stale',
      textOrigin,
      reasonCodes: ['stale_generation'],
      shadowOnly: false,
    })
    hideCard(fieldId)
    return 'stale'
  }

  const hostname = typeof location !== 'undefined' ? location.hostname : ''
  const safety = evaluateFieldSafety(element, {
    hostname,
    excludedDomains: stateManager.settings.excludedDomains,
    text: live,
  })
  if (!safety.allowed) {
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

  if (session.getGeneration() !== generation) {
    session.releaseWrite(writer, acquired.requestId)
    hideCard(fieldId)
    return 'stale'
  }

  const write = commitWriteTransaction(element, range.start, range.end, suggestion, {
    session,
    requestId: acquired.requestId,
    expectedGeneration: acquired.generation,
    cycleGeneration: generation,
    origin: writer,
    auto: false,
    engineOriginated: false,
    capability: action === 'layout_fix' ? 'layout' : action === 'translation' ? 'translation' : 'correction',
    trigger: 'suggestion_accept',
    textOrigin,
    action,
    tagTranslated: action === 'translation',
    allowActiveEdit: true,
  })
  session.releaseWrite(writer, acquired.requestId)
  hideCard(fieldId)

  if (write.verdict !== 'written') {
    recordWritingAnalytics({
      name: 'writing.suggestion',
      action,
      trigger: 'suggestion_accept',
      outcome: write.verdict === 'stale' ? 'stale' : 'failed',
      textOrigin,
      reasonCodes: ['stale_generation'],
      shadowOnly: false,
    })
    return write.verdict === 'stale' ? 'stale' : 'blocked'
  }
  return 'applied'
}
