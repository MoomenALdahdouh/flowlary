import type { CorrectionResponse } from '@flowlary/shared'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import { readFieldText } from '../../core/dom/read.ts'
import { writeReplacement } from '../../core/dom/editor.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { extractWritingContext } from './segment.ts'
import {
  canMergeCorrection,
  isResultStillRelevant,
  mergeCorrectionIntoField,
} from './mergeCorrection.ts'
import { isEligibleForCorrection } from './language.ts'
import { requestCorrectionRemote } from './client.ts'
import { recordHistory } from '../../storage/history/record.ts'
import type { CorrectionMetrics } from './metrics.ts'
import type { CorrectionCard } from './ui/CorrectionCard.ts'
import type { CorrectionSuggestionBinding } from './ui/types.ts'

export type FieldCorrectionState = {
  lastSentText: string
  lastCorrectedFor: string
  pendingRequestId: string | null
  card: CorrectionCard | null
  cardMounted: boolean
}

export type ApplyCorrectionOptions = {
  metrics: CorrectionMetrics
  fieldState: FieldCorrectionState
  currentDebouncerGeneration: () => number
  getCard: (element: EditableElement) => CorrectionCard
  /** When CommandOrchestrator already holds the CORRECT mutex. */
  orchestratorLock?: {
    requestId: number
    generation: number
    signal: AbortSignal
  }
}

export async function runCorrectionRequest(
  element: EditableElement,
  session: FieldSession,
  fullText: string,
  debouncerGeneration: number,
  options: ApplyCorrectionOptions,
): Promise<'committed' | 'stale' | 'blocked' | 'noop' | 'busy' | 'aborted' | 'error' | 'pending'> {
  if (!stateManager.isActive() || !stateManager.correction.enabled) return 'noop'
  if (!stateManager.correction.consentAccepted) return 'blocked'
  if (!stateManager.correction.groqApiKey.trim()) return 'blocked'

  if (debouncerGeneration !== options.currentDebouncerGeneration()) {
    options.metrics.correction_stale_results += 1
    invalidateCardSuggestion(options, 'stale')
    return 'stale'
  }

  if (session.isComposing()) return 'blocked'

  const hostname = typeof location !== 'undefined' ? location.hostname : undefined
  const safety = evaluateFieldSafety(element, {
    hostname,
    excludedDomains: stateManager.settings.excludedDomains,
    text: fullText,
  })
  if (!safety.allowed) {
    options.metrics.correction_blocked += 1
    options.getCard(element).hide()
    return 'blocked'
  }

  if (!isEligibleForCorrection(fullText)) return 'noop'

  const segment = extractWritingContext(fullText)
  if (!segment.trim()) return 'noop'

  if (segment === options.fieldState.lastCorrectedFor) return 'noop'
  if (segment === options.fieldState.lastSentText && options.fieldState.pendingRequestId) {
    return 'noop'
  }

  const active = session.getActiveRequest()
  const reuseOrchestratorLock =
    options.orchestratorLock &&
    active?.operation === 'CORRECT' &&
    active.requestId === options.orchestratorLock.requestId

  const acquired = reuseOrchestratorLock
    ? { ok: true as const, ...options.orchestratorLock! }
    : session.tryAcquireWrite('CORRECT')
  if (!acquired.ok) {
    options.metrics.correction_blocked += 1
    return 'busy'
  }

  const { requestId, signal } = acquired
  const releaseAfterRequest = !reuseOrchestratorLock
  const remoteRequestId = `${Date.now()}-${requestId}`
  options.fieldState.lastSentText = segment
  options.fieldState.pendingRequestId = remoteRequestId
  options.metrics.correction_requests += 1
  options.metrics.correction_ai_calls += 1

  const mode = stateManager.correction.mode
  const card = options.getCard(element)
  if (mode === 'box') card.setAnalyzing()

  let delivery:
    | {
        currentText: string
        data: CorrectionResponse
      }
    | null = null

  try {
    const previousText = fullText.slice(0, Math.max(0, fullText.length - segment.length)).slice(-200)
    const result = await requestCorrectionRemote(
      remoteRequestId,
      segment,
      session.field.kind,
      previousText,
      stateManager.correction.groqApiKey,
      signal,
    )

    if (signal.aborted) {
      options.metrics.correction_stale_results += 1
      invalidateCardSuggestion(options, 'stale')
      return 'aborted'
    }

    if (!element.isConnected) {
      options.metrics.correction_stale_results += 1
      invalidateCardSuggestion(options, 'stale')
      return 'stale'
    }

    const currentText = readFieldText(element)

    if (!result.ok) {
      options.metrics.correction_errors += 1
      if (mode === 'box' && result.error !== 'aborted') {
        card.setError(mapError(result.error))
      } else {
        card.hide()
      }
      return 'error'
    }

    if (debouncerGeneration !== options.currentDebouncerGeneration()) {
      options.metrics.correction_stale_results += 1
      invalidateCardSuggestion(options, 'stale')
      return 'stale'
    }

    if (
      !isResultStillRelevant(currentText, fullText, segment, mode) ||
      !canMergeCorrection(currentText, segment)
    ) {
      options.metrics.correction_stale_results += 1
      invalidateCardSuggestion(options, 'stale')
      return 'stale'
    }

    delivery = { currentText, data: result.data }
  } catch {
    options.metrics.correction_errors += 1
    return 'error'
  } finally {
    options.fieldState.pendingRequestId = null
    if (releaseAfterRequest) {
      session.releaseWrite('CORRECT', requestId)
    }
  }

  if (!delivery) return 'error'

  return deliverCorrectionResult(
    element,
    session,
    delivery.currentText,
    fullText,
    segment,
    remoteRequestId,
    debouncerGeneration,
    delivery.data,
    options,
  )
}

async function deliverCorrectionResult(
  element: EditableElement,
  session: FieldSession,
  currentText: string,
  requestedFullText: string,
  segment: string,
  remoteRequestId: string,
  debouncerGeneration: number,
  data: CorrectionResponse,
  options: ApplyCorrectionOptions,
): Promise<'committed' | 'noop' | 'pending' | 'stale'> {
  const correctedSegment = data.correctedText
  if (!correctedSegment || correctedSegment === segment) {
    options.getCard(element).hide()
    return 'noop'
  }

  const mode = stateManager.correction.mode

  if (mode === 'box') {
    const binding: CorrectionSuggestionBinding = {
      remoteRequestId,
      debouncerGeneration,
      fieldGeneration: session.getGeneration(),
      segment,
      requestedFullText,
      response: { ...data, originalText: segment },
    }
    options.getCard(element).setReady(binding)
    options.metrics.correction_card_shown += 1
    return 'pending'
  }

  options.metrics.correction_direct_edit += 1
  return await commitMergedCorrection(element, session, segment, correctedSegment, options, {
    requestId: options.orchestratorLock?.requestId,
    generation: options.orchestratorLock?.generation,
  })
}

export async function acceptCorrectionSuggestion(
  element: EditableElement,
  session: FieldSession,
  binding: CorrectionSuggestionBinding,
  options: ApplyCorrectionOptions,
): Promise<'committed' | 'stale' | 'busy' | 'blocked'> {
  if (!element.isConnected) {
    options.metrics.correction_card_stale += 1
    options.getCard(element).hide()
    return 'stale'
  }

  const hostname = typeof location !== 'undefined' ? location.hostname : undefined
  const liveText = readFieldText(element)
  const safety = evaluateFieldSafety(element, {
    hostname,
    excludedDomains: stateManager.settings.excludedDomains,
    text: liveText,
  })
  if (!safety.allowed) {
    options.metrics.correction_blocked += 1
    options.getCard(element).hide()
    return 'blocked'
  }

  if (binding.debouncerGeneration !== options.currentDebouncerGeneration()) {
    options.metrics.correction_card_stale += 1
    options.getCard(element).hide()
    return 'stale'
  }

  if (session.getGeneration() !== binding.fieldGeneration) {
    options.metrics.correction_card_stale += 1
    options.getCard(element).hide()
    return 'stale'
  }

  const mode = stateManager.correction.mode
  if (
    !isResultStillRelevant(liveText, binding.requestedFullText, binding.segment, mode) ||
    !canMergeCorrection(liveText, binding.segment)
  ) {
    options.metrics.correction_card_stale += 1
    options.getCard(element).hide()
    return 'stale'
  }

  const result = await commitMergedCorrection(
    element,
    session,
    binding.segment,
    binding.response.correctedText,
    options,
  )
  if (result === 'committed') {
    options.metrics.correction_card_accepted += 1
  }
  return result
}

export function dismissCorrectionSuggestion(
  element: EditableElement,
  options: ApplyCorrectionOptions,
): void {
  options.metrics.correction_card_dismissed += 1
  options.getCard(element).hide()
}

export async function commitMergedCorrection(
  element: EditableElement,
  session: FieldSession,
  segment: string,
  correctedSegment: string,
  options: ApplyCorrectionOptions,
  existingLock?: { requestId: number; generation: number },
): Promise<'committed' | 'stale' | 'busy'> {
  const liveText = readFieldText(element)
  const merged = mergeCorrectionIntoField(liveText, segment, correctedSegment)
  if (!merged) {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }

  let requestId = existingLock?.requestId
  let generation = existingLock?.generation
  let releaseAfter = false

  if (requestId === undefined || generation === undefined) {
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) return 'busy'
    requestId = acquired.requestId
    generation = acquired.generation
    releaseAfter = true
  }

  const write = writeReplacement(element, 0, liveText.length, merged, {
    origin: 'CORRECT',
    session,
    requestId: requestId!,
    expectedGeneration: generation!,
    placeCaretAfter: false,
    allowActiveEdit: true,
  })

  if (releaseAfter) {
    session.releaseWrite('CORRECT', requestId!)
  }

  if (write.verdict !== 'written') {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }

  options.fieldState.lastCorrectedFor = extractWritingContext(merged)
  options.fieldState.lastSentText = options.fieldState.lastCorrectedFor
  options.getCard(element).hide()
  options.metrics.correction_commits += 1
  void recordHistory({
    operation: 'CORRECT',
    element,
    sourceText: segment,
    resultText: correctedSegment,
    mode: 'automatic',
  })
  return 'committed'
}

export function invalidateCardIfStale(
  element: EditableElement,
  session: FieldSession,
  fullText: string,
  options: ApplyCorrectionOptions,
): void {
  const card = options.fieldState.card
  if (!card?.hasReadyCorrection()) return
  const binding = card.getBinding()
  if (!binding) return

  const mode = stateManager.correction.mode
  if (
    binding.debouncerGeneration !== options.currentDebouncerGeneration() ||
    fullText !== binding.requestedFullText ||
    !isResultStillRelevant(fullText, binding.requestedFullText, binding.segment, mode) ||
    !canMergeCorrection(fullText, binding.segment)
  ) {
    invalidateCardSuggestion(options, 'stale')
  } else if (mode === 'box' && extractWritingContext(fullText) && shouldSyncPlainRow(fullText, binding)) {
    card.ensureVisible(fullText)
  }
}

function shouldSyncPlainRow(fullText: string, binding: CorrectionSuggestionBinding): boolean {
  return !binding.response.correctedText || fullText.trim() !== binding.response.correctedText.trim()
}

function invalidateCardSuggestion(
  options: ApplyCorrectionOptions,
  reason: 'stale' | 'hidden',
): void {
  if (reason === 'stale') {
    options.metrics.correction_card_stale += 1
  }
  options.fieldState.card?.hide()
}

function mapError(code: string): string {
  switch (code) {
    case 'missing_api_key':
      return 'Add your Groq API key in the Flowlary popup.'
    case 'invalid_api_key':
      return 'Groq API key looks invalid.'
    case 'rate_limited':
      return 'Groq rate limit — try again shortly.'
    default:
      return 'Could not reach Groq.'
  }
}

export function syncCardVisibility(
  element: EditableElement,
  text: string,
  options: ApplyCorrectionOptions,
): void {
  const mode = stateManager.correction.mode
  const card = options.getCard(element)

  if (mode !== 'box') {
    card.hide()
    return
  }

  if (!text.trim()) {
    card.hide()
    options.fieldState.lastSentText = ''
    options.fieldState.lastCorrectedFor = ''
  }
}
