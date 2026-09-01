import type { CorrectionResponse } from '@flowlary/shared'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import { readFieldText } from '../../core/dom/read.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
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
import { isCorrectionAiReady } from './readiness.ts'
import { allowAutomaticNetworkAssist } from '../../core/policy/writingPolicy.ts'
import { allowsAutomaticFieldWrite } from '../../core/safety/autoWrite.ts'
import {
  fieldKindFromElement,
  recordWriteTelemetry,
} from '../../core/observability/writeTelemetry.ts'
import { recordHistory } from '../../storage/history/record.ts'
import {
  recordCorrectionAccepted,
  recordCorrectionDetected,
  recordCorrectionRejected,
} from '../learning/recordCorrectionLearning.ts'
import type { CorrectionMetrics } from './metrics.ts'
import type { CorrectionCard } from './ui/CorrectionCard.ts'
import type { CorrectionSuggestionBinding } from './ui/types.ts'
import type { IntelligentDebouncer } from './debounce.ts'

export type FieldCorrectionState = {
  lastSentText: string
  lastCorrectedFor: string
  pendingRequestId: string | null
  card: CorrectionCard | null
  cardMounted: boolean
}

export type FieldCorrectionStateEntry = FieldCorrectionState & {
  debouncer: IntelligentDebouncer
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
  if (!isCorrectionAiReady(stateManager.correction)) return 'blocked'
  const commandLocked = Boolean(options.orchestratorLock)
  if (!commandLocked && !allowAutomaticNetworkAssist()) {
    recordWriteTelemetry({
      capability: 'correction',
      trigger: 'auto',
      outcome: 'noop',
      reasonCodes: ['shortcuts_only'],
      fieldKind: fieldKindFromElement(element),
    })
    return 'noop'
  }
  if (!commandLocked && stateManager.correction.mode === 'direct' && !allowsAutomaticFieldWrite(element)) {
    recordWriteTelemetry({
      capability: 'correction',
      trigger: 'auto',
      outcome: 'blocked',
      reasonCodes: ['unsupported_editor_auto_write'],
      fieldKind: fieldKindFromElement(element),
    })
    return 'blocked'
  }

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

  const segment = extractWritingContext(fullText)
  if (!segment.trim()) return 'noop'
  if (!isEligibleForCorrection(segment)) return 'noop'

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
    recordCorrectionDetected(remoteRequestId, segment, binding.response)
    return 'pending'
  }

  options.metrics.correction_direct_edit += 1
  return await commitMergedCorrection(element, session, segment, correctedSegment, options, {
    requestId: options.orchestratorLock?.requestId,
    generation: options.orchestratorLock?.generation,
    response: data,
    batchId: remoteRequestId,
    auto: !options.orchestratorLock,
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
    { response: binding.response, batchId: binding.remoteRequestId },
  )
  if (result === 'committed') {
    options.metrics.correction_card_accepted += 1
  }
  return result
}

export function dismissCorrectionSuggestion(
  element: EditableElement,
  binding: CorrectionSuggestionBinding | null,
  options: ApplyCorrectionOptions,
): void {
  options.metrics.correction_card_dismissed += 1
  if (binding) {
    recordCorrectionRejected(binding.remoteRequestId, binding.segment, binding.response)
  }
  options.getCard(element).hide()
}

export async function commitMergedCorrection(
  element: EditableElement,
  session: FieldSession,
  segment: string,
  correctedSegment: string,
  options: ApplyCorrectionOptions,
  meta?: {
    requestId?: number
    generation?: number
    response?: CorrectionResponse
    batchId?: string
    auto?: boolean
  },
): Promise<'committed' | 'stale' | 'busy'> {
  const liveText = readFieldText(element)
  const merged = mergeCorrectionIntoField(liveText, segment, correctedSegment)
  if (!merged) {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }

  let requestId = meta?.requestId
  let generation = meta?.generation
  let releaseAfter = false

  if (requestId === undefined || generation === undefined) {
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) return 'busy'
    requestId = acquired.requestId
    generation = acquired.generation
    releaseAfter = true
  }

  const write = commitWriteTransaction(element, 0, liveText.length, merged, {
    origin: 'CORRECT',
    session,
    requestId: requestId!,
    expectedGeneration: generation!,
    cycleGeneration: generation!,
    placeCaretAfter: false,
    allowActiveEdit: true,
    auto: meta?.auto === true,
    capability: 'correction',
    trigger: meta?.auto === true ? 'auto' : 'shortcut',
    textOrigin: 'original_en',
    action: 'english_correction',
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
  if (meta?.response && meta.batchId) {
    recordCorrectionAccepted(meta.batchId, segment, meta.response)
  }
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
    case 'consent_required':
      return 'Enable Flowlary AI to use Writing Correction.'
    case 'usage_exhausted':
      return "Today's AI writing checks are used up. You can continue using Flowlary's local tools."
    case 'account_required':
      return 'Sign in to use Flowlary AI. Your local tools remain available without an account.'
    case 'rate_limited':
      return "You're sending requests too quickly. Try again shortly."
    case 'entitlement_denied':
      return "Today's AI writing checks are used up. You can continue using Flowlary's local tools."
    case 'auth_failed':
      return 'Please sign in again.'
    case 'network':
      return "You're offline. Check your connection and try again."
    case 'AI_UNAVAILABLE':
    case 'AI_PROVIDER_ERROR':
    case 'AI_TIMEOUT':
    case 'AI_INVALID_RESPONSE':
    case 'invalid_response':
      return "Couldn't complete that AI request. Try again in a moment."
    default:
      if (code.startsWith('gateway_http_')) {
        return "Couldn't complete that AI request. Try again in a moment."
      }
      return 'Something went wrong. Try again.'
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
