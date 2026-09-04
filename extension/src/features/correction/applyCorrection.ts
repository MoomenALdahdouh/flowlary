import type { CorrectionResponse } from '@flowlary/shared'
import { DIRECT_HIGHLIGHT_PREVIEW_MS } from '@flowlary/shared'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import { readFieldText } from '../../core/dom/read.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { extractWritingContext } from './segment.ts'
import {
  mergeCorrectionIntoField,
} from './mergeCorrection.ts'
import { isEligibleForCorrection, shouldShowEnglishAssistant } from './language.ts'
import { requestCorrectionRemote } from './client.ts'
import { isCorrectionAiReady } from './readiness.ts'
import { allowAutomaticNetworkAssist } from '../../core/policy/writingPolicy.ts'
import { allowsAutomaticFieldWrite } from '../../core/safety/autoWrite.ts'
import {
  isAssistCooldownActive,
  noteAssistRateLimited,
} from './assistCooldown.ts'
import { hideEnglishPipelineSuggestion } from '../../core/writeGate/pipelineSuggest.ts'
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
import { presentLocalBoxSuggestion } from './localSuggestion.ts'
import type { IntelligentDebouncer } from './debounce.ts'
import type { Operation } from '../../core/runtime/types.ts'
import { authorizationForOperationWrite } from '../../core/runtime/writeAuthorization.ts'
import {
  clearCommitInFlight,
  flushDeferredAutomaticCommits,
  prepareAutomaticWrite,
} from '../../core/runtime/arbitration.ts'
import { isOperationCurrent } from '../../core/runtime/validity.ts'
import { mergeAbortSignals } from '../../core/runtime/abortSignals.ts'
import {
  createBoxSuggestion,
  evaluateBoxApplyAuthorization,
  writeAuthorizationFromBox,
} from '../../core/runtime/suggestion.ts'
import { markOperationFailed } from '../../core/runtime/Operation.ts'
import { hashWritingSample } from '@flowlary/shared'

export type FieldCorrectionState = {
  lastSentText: string
  lastCorrectedFor: string
  pendingRequestId: string | null
  lastCorrectionRequestAt: number
  card: CorrectionCard | null
  cardMounted: boolean
}

export type FieldCorrectionStateEntry = FieldCorrectionState & {
  debouncer: IntelligentDebouncer
}

function ensureEnglishOperation(
  session: FieldSession,
  fullText: string,
  operation: Operation | undefined,
): Operation {
  if (operation) return operation
  return session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'english',
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: fullText,
  })
}

function toCorrectionBoxBinding(input: {
  session: FieldSession
  fullText: string
  segment: string
  remoteRequestId: string
  debouncerGeneration: number
  response: CorrectionResponse
  operation?: Operation
}): CorrectionSuggestionBinding {
  const operation = ensureEnglishOperation(input.session, input.fullText, input.operation)
  const start = Math.max(0, input.fullText.lastIndexOf(input.segment))
  const range = { start, end: start + input.segment.length }
  const box = createBoxSuggestion({
    operation,
    range,
    replacement: input.response.correctedText,
    action: 'english_correction',
    textOrigin: 'original_en',
    state: 'ready',
  })
  return {
    remoteRequestId: input.remoteRequestId,
    debouncerGeneration: input.debouncerGeneration,
    fieldGeneration: box.revision,
    segment: input.segment,
    requestedFullText: box.snapshotFullText,
    response: input.response,
    operationId: box.operationId,
    revision: box.revision,
    fieldId: box.fieldId,
    snapshotFullText: box.snapshotFullText,
    snapshotHash: box.snapshotHash || hashWritingSample(box.snapshotFullText),
    range: box.range,
    rangeText: box.rangeText,
    replacement: box.replacement,
    boxState: 'ready',
  }
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
  operation?: Operation
}

export async function runCorrectionRequest(
  element: EditableElement,
  session: FieldSession,
  fullText: string,
  debouncerGeneration: number,
  options: ApplyCorrectionOptions,
): Promise<'committed' | 'stale' | 'blocked' | 'noop' | 'busy' | 'aborted' | 'error' | 'pending'> {
  if (!stateManager.isActive() || !stateManager.correction.enabled) return 'noop'
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

  if (session.isComposing()) return 'blocked'
  if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    return 'stale'
  }

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
  if (!isEligibleForCorrection(segment)) {
    if (presentLocalBoxSuggestion(element, session, fullText, options)) return 'pending'
    return 'noop'
  }

  if (segment === options.fieldState.lastCorrectedFor) return 'noop'
  if (segment === options.fieldState.lastSentText && options.fieldState.pendingRequestId) {
    return 'noop'
  }

  const mode = stateManager.correction.mode
  const card = options.getCard(element)

  if (!isCorrectionAiReady(stateManager.correction)) {
    if (presentLocalBoxSuggestion(element, session, fullText, options)) return 'pending'
    card.setError(mapError('consent_required'))
    return 'blocked'
  }

  if (isAssistCooldownActive()) {
    return 'noop'
  }

  if (mode === 'box' || stateManager.correction.highlights) {
    hideEnglishPipelineSuggestion(session.field.id)
    card.setAnalyzing()
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
  if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    if (!reuseOrchestratorLock) session.releaseWrite('CORRECT', acquired.requestId)
    return 'stale'
  }

  const { requestId } = acquired
  const signal = mergeAbortSignals([acquired.signal, options.operation?.abort.signal])
  const releaseAfterRequest = !reuseOrchestratorLock
  const remoteRequestId = `${Date.now()}-${requestId}`
  options.fieldState.lastSentText = segment
  options.fieldState.pendingRequestId = remoteRequestId
  options.fieldState.lastCorrectionRequestAt = Date.now()
  session.noteEnglishNetwork(options.fieldState.lastCorrectionRequestAt)
  options.metrics.correction_requests += 1
  options.metrics.correction_ai_calls += 1

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
      undefined,
      {
        fieldId: session.field.id,
        feature: 'english',
        isCurrent: () => {
          if (signal.aborted) return false
          if (!options.operation) return true
          return isOperationCurrent(options.operation, session.getRevision())
        },
      },
    )

    if (signal.aborted || (options.operation && !isOperationCurrent(options.operation, session.getRevision()))) {
      options.metrics.correction_stale_results += 1
      invalidateCardSuggestion(options, 'stale')
      return options.operation?.state === 'aborted' ? 'aborted' : 'stale'
    }

    if (!element.isConnected) {
      options.metrics.correction_stale_results += 1
      invalidateCardSuggestion(options, 'stale')
      return 'stale'
    }

    const currentText = readFieldText(element)
    const snapshot = options.operation?.snapshotFullText ?? fullText
    if (currentText !== snapshot) {
      options.metrics.correction_stale_results += 1
      invalidateCardSuggestion(options, 'stale')
      return 'stale'
    }

    if (!result.ok) {
      options.metrics.correction_errors += 1
      if (result.error === 'rate_limited') {
        noteAssistRateLimited()
      }
      const quotaLike =
        result.error === 'usage_exhausted' ||
        result.error === 'entitlement_denied' ||
        result.error === 'consent_required' ||
        result.error === 'account_required'
      if (!quotaLike && mode === 'box' && presentLocalBoxSuggestion(element, session, snapshot, options)) {
        options.fieldState.pendingRequestId = null
        return 'error'
      }
      if (result.error !== 'aborted' && (mode === 'box' || stateManager.correction.highlights)) {
        card.setError(mapError(result.error))
      } else {
        card.hide()
      }
      options.fieldState.pendingRequestId = null
      return 'error'
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
  if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    invalidateCardSuggestion(options, 'stale')
    return 'stale'
  }

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
  if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    return 'stale'
  }
  const correctedSegment = data.correctedText
  if (!correctedSegment || correctedSegment === segment) {
    if (presentLocalBoxSuggestion(element, session, currentText, options)) return 'pending'
    options.getCard(element).hide()
    return 'noop'
  }

  const mode = stateManager.correction.mode

  if (mode === 'box') {
    const binding = toCorrectionBoxBinding({
      session,
      fullText: requestedFullText,
      segment,
      remoteRequestId,
      debouncerGeneration,
      response: { ...data, originalText: segment },
      operation: options.operation,
    })
    hideEnglishPipelineSuggestion(session.field.id)
    options.getCard(element).setReady(binding)
    options.metrics.correction_card_shown += 1
    recordCorrectionDetected(remoteRequestId, segment, binding.response)
    return 'pending'
  }

  if (stateManager.correction.highlights && data.changes.length > 0) {
    const binding = toCorrectionBoxBinding({
      session,
      fullText: requestedFullText,
      segment,
      remoteRequestId,
      debouncerGeneration,
      response: { ...data, originalText: segment },
      operation: options.operation,
    })
    hideEnglishPipelineSuggestion(session.field.id)
    options.getCard(element).setReady(binding)
    options.metrics.correction_card_shown += 1
    recordCorrectionDetected(remoteRequestId, segment, binding.response)

    await new Promise((resolve) => setTimeout(resolve, DIRECT_HIGHLIGHT_PREVIEW_MS))

    if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
      options.metrics.correction_stale_results += 1
      options.getCard(element).hide()
      return 'stale'
    }

    const liveText = readFieldText(element)
    if (liveText !== (options.operation?.snapshotFullText ?? requestedFullText)) {
      options.metrics.correction_stale_results += 1
      options.getCard(element).hide()
      return 'stale'
    }
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

  const alreadyApplied =
    extractWritingContext(liveText) === binding.response.correctedText ||
    liveText === binding.response.correctedText
  if (alreadyApplied) {
    options.getCard(element).retainAfterApply(liveText, session.getGeneration())
    return 'committed'
  }

  if (
    !binding.operationId
    || binding.revision == null
    || !binding.fieldId
    || binding.snapshotFullText == null
    || !binding.range
    || binding.rangeText == null
    || binding.replacement == null
    || (binding.boxState ?? 'ready') !== 'ready'
  ) {
    options.metrics.correction_card_stale += 1
    options.getCard(element).hide()
    return 'stale'
  }

  const suggestion = {
    operationId: binding.operationId,
    revision: binding.revision,
    fieldId: binding.fieldId,
    snapshotFullText: binding.snapshotFullText,
    snapshotHash: binding.snapshotHash ?? '',
    range: binding.range,
    rangeText: binding.rangeText,
    replacement: binding.replacement,
    action: 'english_correction' as const,
    state: 'ready' as const,
    textOrigin: 'original_en' as const,
  }
  const operation = session.operations.get(binding.operationId)
  const authorized = evaluateBoxApplyAuthorization({
    suggestion,
    session,
    element,
    operation,
  })
  if (!authorized.ok) {
    if (authorized.reason === 'snapshot_mismatch' && operation) {
      markOperationFailed(operation)
    }
    options.metrics.correction_card_stale += 1
    options.getCard(element).hide()
    return 'stale'
  }

  binding.boxState = 'applying'

  const ticket = writeAuthorizationFromBox({ suggestion, operation })
  if (!ticket.ok) {
    binding.boxState = 'stale'
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
    {
      response: binding.response,
      batchId: binding.remoteRequestId,
      authorization: ticket.authorization,
    },
  )
  if (result !== 'committed') {
    binding.boxState = 'stale'
  }
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
    authorization?: import('../../core/runtime/writeAuthorization.ts').WriteAuthorization
  },
): Promise<'committed' | 'stale' | 'busy'> {
  const liveText = readFieldText(element)
  if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }
  const snapshot = options.operation?.snapshotFullText ?? liveText
  if (options.operation && liveText !== snapshot) {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }
  const authorizedWrite = meta?.authorization
  const merged = authorizedWrite
    ? authorizedWrite.replacement
    : mergeCorrectionIntoField(snapshot, segment, correctedSegment)
  if (!merged) {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }

  const start = authorizedWrite ? authorizedWrite.range.start : 0
  const end = authorizedWrite ? authorizedWrite.range.end : liveText.length

  let autoAuthorization = authorizedWrite
  if (!autoAuthorization && meta?.auto === true) {
    const operation = options.operation ?? session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'english',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: snapshot,
    })
    const prepared = prepareAutomaticWrite({
      session,
      operation,
      feature: 'english',
      action: 'english_correction',
      effect: 'direct',
      range: { start, end },
      replacement: merged,
      resume: () => {
        void commitMergedCorrection(element, session, segment, correctedSegment, options, meta)
      },
    })
    if (prepared.decision.verdict === 'DEFER') return 'busy'
    if (prepared.decision.verdict !== 'ALLOW' || !prepared.authorization) return 'stale'
    autoAuthorization = prepared.authorization
  }

  let requestId = meta?.requestId
  let generation = meta?.generation
  let releaseAfter = false

  if (requestId === undefined || generation === undefined) {
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) {
      if (meta?.auto === true) clearCommitInFlight(session)
      return 'busy'
    }
    requestId = acquired.requestId
    generation = acquired.generation
    releaseAfter = true
  }

  try {
    const authorization = autoAuthorization ?? authorizationForOperationWrite({
      session,
      operation: options.operation,
      action: 'english_correction',
      range: { start, end },
      replacement: merged,
      snapshotFullText: options.operation?.snapshotFullText ?? snapshot,
      purpose: meta?.auto === true ? 'auto-analysis' : 'shortcut',
      trigger: meta?.auto === true ? 'auto' : 'shortcut',
    })

    const write = commitWriteTransaction(element, start, end, merged, {
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
      authorization,
    })

    if (write.verdict !== 'written') {
      options.metrics.correction_stale_results += 1
      options.getCard(element).hide()
      return 'stale'
    }
  } finally {
    if (releaseAfter) {
      session.releaseWrite('CORRECT', requestId!)
    }
    if (meta?.auto === true) {
      clearCommitInFlight(session)
      flushDeferredAutomaticCommits(session)
    }
  }

  options.fieldState.lastCorrectedFor = extractWritingContext(readFieldText(element))
  options.fieldState.lastSentText = options.fieldState.lastCorrectedFor
  if (stateManager.correction.mode === 'box') {
    options.getCard(element).retainAfterApply(readFieldText(element), session.getGeneration())
  } else {
    options.getCard(element).hide()
  }
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

  if (!binding.operationId || binding.revision == null || binding.snapshotFullText == null) {
    invalidateCardSuggestion(options, 'stale')
    return
  }
  if (binding.revision !== session.getRevision() || binding.snapshotFullText !== fullText) {
    invalidateCardSuggestion(options, 'stale')
  }
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

  const cardState = card.getState()

  if (mode === 'direct') {
    if (card.hasReadyCorrection() || cardState === 'error') return
    if (cardState === 'analyzing' && stateManager.correction.highlights) return
    card.hide()
    return
  }

  if (mode !== 'box') {
    card.hide()
    return
  }

  if (!text.trim()) {
    card.hide()
    options.fieldState.lastSentText = ''
    options.fieldState.lastCorrectedFor = ''
    return
  }

  if (shouldShowEnglishAssistant(text)) {
    card.ensureVisible(text)
  }
}
