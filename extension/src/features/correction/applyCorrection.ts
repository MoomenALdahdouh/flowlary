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
import { presentLocalBoxSuggestion, isActionableCorrectionError } from './localSuggestion.ts'
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
import { runtimeTrace } from '../../core/runtime/trace.ts'
import { hashWritingSample } from '@flowlary/shared'

export type FieldCorrectionState = {
  lastSentText: string
  lastCorrectedFor: string
  pendingRequestId: string | null
  lastCorrectionRequestAt: number
  card: CorrectionCard | null
  cardMounted: boolean
  /**
   * Snapshot the user dismissed. Late AI/local recovery for the same snapshot
   * must not resurrect a Box (Writing Runtime stale-Box invariant).
   */
  dismissedSnapshotFullText?: string | null
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
  selectionTarget?: { start: number; end: number; text: string }
}): CorrectionSuggestionBinding | null {
  const operation = ensureEnglishOperation(input.session, input.fullText, input.operation)
  let range: { start: number; end: number }
  if (input.selectionTarget) {
    range = { start: input.selectionTarget.start, end: input.selectionTarget.end }
  } else {
    // Legacy whole-field / context path only. Explicit selection must pass selectionTarget.
    const start = Math.max(0, input.fullText.lastIndexOf(input.segment))
    range = { start, end: start + input.segment.length }
  }
  if (input.fullText.slice(range.start, range.end) !== input.segment) {
    return null
  }
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
  /** Explicit user selection — write target is this range only. */
  selectionTarget?: {
    start: number
    end: number
    text: string
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

  const segment = options.selectionTarget?.text ?? extractWritingContext(fullText)
  if (options.selectionTarget) {
    const liveSlice = fullText.slice(options.selectionTarget.start, options.selectionTarget.end)
    if (liveSlice !== options.selectionTarget.text) return 'stale'
  }
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
    if (mode === 'box' || stateManager.correction.highlights) {
      card.setError(mapError('consent_required'))
    } else {
      card.hide()
    }
    return 'blocked'
  }

  if (isAssistCooldownActive()) {
    return 'noop'
  }

  if (
    options.fieldState.dismissedSnapshotFullText
    && options.fieldState.dismissedSnapshotFullText !== fullText
  ) {
    options.fieldState.dismissedSnapshotFullText = null
  }

  // Box: surface a local fix immediately when we can. AI may refine it afterward.
  // This keeps the tool useful even when the network path fails.
  const hadLocalReady =
    mode === 'box'
    && !isDismissedSnapshot(options.fieldState, fullText)
    && presentLocalBoxSuggestion(element, session, fullText, options)

  if ((mode === 'box' || stateManager.correction.highlights) && !hadLocalReady) {
    if (!isDismissedSnapshot(options.fieldState, fullText)) {
      hideEnglishPipelineSuggestion(session.field.id)
      card.setAnalyzing()
    }
  } else if (hadLocalReady) {
    hideEnglishPipelineSuggestion(session.field.id)
  }

  const active = session.getActiveRequest()
  const reuseOrchestratorLock =
    options.orchestratorLock &&
    active?.operation === 'CORRECT' &&
    active.requestId === options.orchestratorLock.requestId

  // Box only shows a card — holding CORRECT through the network blocks Accept on the
  // local-first Box (Writing Runtime: mutex is for writes, not for analysis).
  const holdMutexForNetwork = mode === 'direct' || Boolean(reuseOrchestratorLock)

  let requestId = Date.now()
  let signal: AbortSignal | undefined = options.operation?.abort.signal
  let releaseAfterRequest = false

  if (holdMutexForNetwork) {
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
    requestId = acquired.requestId
    signal = mergeAbortSignals([acquired.signal, options.operation?.abort.signal])
    releaseAfterRequest = !reuseOrchestratorLock
  } else if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    return 'stale'
  }

  const remoteRequestId = `${Date.now()}-${requestId}`
  const pendingBefore = Boolean(
    options.fieldState.pendingRequestId
    || (session.getActiveRequest()?.operation === 'CORRECT'),
  )
  options.fieldState.lastSentText = segment
  options.fieldState.pendingRequestId = remoteRequestId
  options.fieldState.lastCorrectionRequestAt = Date.now()
  session.noteEnglishNetwork(options.fieldState.lastCorrectionRequestAt)
  options.metrics.correction_requests += 1
  options.metrics.correction_ai_calls += 1
  runtimeTrace({
    name: 'ENGLISH_HTTP',
    fieldId: session.field.id,
    revision: options.operation?.revision ?? session.getRevision(),
    operationId: options.operation?.operationId,
    feature: 'english',
    purpose: options.operation?.purpose,
    state: 'dispatch',
    trigger: options.operation?.trigger ?? (commandLocked ? 'shortcut' : 'auto'),
    localFirst: hadLocalReady,
    pendingBefore,
  })

  let delivery:
    | {
        currentText: string
        data: CorrectionResponse
      }
    | null = null

  try {
    const previousText = fullText.slice(0, Math.max(0, fullText.length - segment.length)).slice(-200)
    const httpStartedAt = Date.now()
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
          if (signal?.aborted) return false
          if (!options.operation) return true
          return isOperationCurrent(options.operation, session.getRevision())
        },
      },
    )
    runtimeTrace({
      name: 'ENGLISH_HTTP',
      fieldId: session.field.id,
      revision: options.operation?.revision ?? session.getRevision(),
      operationId: options.operation?.operationId,
      feature: 'english',
      purpose: options.operation?.purpose,
      state: result.ok ? 'ok' : result.aborted ? 'aborted' : 'error',
      trigger: options.operation?.trigger ?? (commandLocked ? 'shortcut' : 'auto'),
      localFirst: hadLocalReady,
      pendingBefore,
      httpStatus: result.ok ? 200 : result.error,
      durationMs: Date.now() - httpStartedAt,
    })

    if (
      signal?.aborted
      || (options.operation && !isOperationCurrent(options.operation, session.getRevision()))
    ) {
      options.metrics.correction_stale_results += 1
      invalidateOwnCardSuggestion(options, remoteRequestId, options.operation?.operationId)
      return options.operation?.state === 'aborted' ? 'aborted' : 'stale'
    }

    if (!element.isConnected) {
      options.metrics.correction_stale_results += 1
      invalidateOwnCardSuggestion(options, remoteRequestId, options.operation?.operationId)
      return 'stale'
    }

    const currentText = readFieldText(element)
    const snapshot = options.operation?.snapshotFullText ?? fullText
    if (currentText !== snapshot) {
      options.metrics.correction_stale_results += 1
      invalidateOwnCardSuggestion(options, remoteRequestId, options.operation?.operationId)
      return 'stale'
    }

    if (!result.ok) {
      options.metrics.correction_errors += 1
      if (result.error === 'rate_limited') {
        noteAssistRateLimited()
      }
      const recovered = recoverFromCorrectionFailure(
        element,
        session,
        snapshot,
        result.error,
        options,
        card,
        hadLocalReady,
      )
      options.fieldState.pendingRequestId = null
      return recovered
    }

    delivery = { currentText, data: result.data }
  } catch {
    options.metrics.correction_errors += 1
    const snapshot = options.operation?.snapshotFullText ?? fullText
    const recovered = recoverFromCorrectionFailure(
      element,
      session,
      snapshot,
      'AI_PROVIDER_ERROR',
      options,
      card,
      hadLocalReady,
    )
    options.fieldState.pendingRequestId = null
    return recovered
  } finally {
    options.fieldState.pendingRequestId = null
    if (releaseAfterRequest) {
      session.releaseWrite('CORRECT', requestId)
    }
  }

  if (!delivery) return 'error'
  if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    invalidateOwnCardSuggestion(options, remoteRequestId, options.operation.operationId)
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
): Promise<'committed' | 'noop' | 'pending' | 'stale' | 'busy'> {
  if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) {
    return 'stale'
  }
  const correctedSegment = data.correctedText
  if (!correctedSegment || correctedSegment === segment) {
    if (presentLocalBoxSuggestion(element, session, currentText, options)) return 'pending'
    // Keep a local card that was shown before the AI round-trip.
    if (options.getCard(element).hasReadyCorrection()) return 'pending'
    options.getCard(element).hide()
    return 'noop'
  }

  const mode = stateManager.correction.mode

  if (mode === 'box') {
    if (isDismissedSnapshot(options.fieldState, requestedFullText)) {
      return 'noop'
    }
    if (!mayRefineVisibleBox(options, remoteRequestId, requestedFullText, options.operation?.operationId)) {
      return 'stale'
    }
    const binding = toCorrectionBoxBinding({
      session,
      fullText: requestedFullText,
      segment,
      remoteRequestId,
      debouncerGeneration,
      response: { ...data, originalText: segment },
      operation: options.operation,
      selectionTarget: options.selectionTarget,
    })
    if (!binding) return 'stale'
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
      selectionTarget: options.selectionTarget,
    })
    if (!binding) return 'stale'
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
    options.fieldState.dismissedSnapshotFullText =
      binding.requestedFullText ?? binding.snapshotFullText ?? readFieldText(element)
  } else {
    options.fieldState.dismissedSnapshotFullText = readFieldText(element)
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

  const selectionTarget = options.selectionTarget
  if (selectionTarget) {
    const liveSlice = liveText.slice(selectionTarget.start, selectionTarget.end)
    if (liveSlice !== selectionTarget.text || selectionTarget.text !== segment) {
      options.metrics.correction_stale_results += 1
      options.getCard(element).hide()
      return 'stale'
    }
  }

  const authorizedWrite = meta?.authorization
  const selectionWrite = Boolean(selectionTarget) && !authorizedWrite
  const merged = authorizedWrite
    ? authorizedWrite.replacement
    : selectionWrite
      ? correctedSegment
      : mergeCorrectionIntoField(snapshot, segment, correctedSegment)
  if (merged == null) {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }

  const start = authorizedWrite
    ? authorizedWrite.range.start
    : selectionTarget
      ? selectionTarget.start
      : 0
  const end = authorizedWrite
    ? authorizedWrite.range.end
    : selectionTarget
      ? selectionTarget.end
      : liveText.length

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

  options.fieldState.lastCorrectedFor = selectionTarget
    ? correctedSegment
    : extractWritingContext(readFieldText(element))
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

function isDismissedSnapshot(fieldState: FieldCorrectionState, snapshot: string): boolean {
  return Boolean(fieldState.dismissedSnapshotFullText && fieldState.dismissedSnapshotFullText === snapshot)
}

/** True when the visible card is owned by this in-flight request (or still analyzing). */
function cardOwnedByRequest(
  card: CorrectionCard | null | undefined,
  remoteRequestId: string,
  operationId?: string,
): boolean {
  if (!card) return false
  const binding = card.getBinding()
  if (!binding) return card.getState() === 'analyzing'
  if (binding.remoteRequestId === remoteRequestId) return true
  if (operationId && binding.operationId === operationId) return true
  return false
}

/**
 * AI may refine a ready Box only when it still owns the visible suggestion
 * (same request/operation) or the card is a local-first preview for the same snapshot.
 */
function mayRefineVisibleBox(
  options: ApplyCorrectionOptions,
  remoteRequestId: string,
  requestedFullText: string,
  operationId?: string,
): boolean {
  const card = options.fieldState.card
  if (!card) return true
  const state = card.getState()
  if (state === 'hidden' || state === 'error') return true
  if (state === 'analyzing') return true
  if (cardOwnedByRequest(card, remoteRequestId, operationId)) return true
  const binding = card.getBinding()
  if (
    binding
    && binding.remoteRequestId.startsWith('local-')
    && binding.snapshotFullText === requestedFullText
    && (operationId == null || binding.operationId === operationId || binding.operationId != null)
  ) {
    // Same-snapshot local preview: AI refinement is allowed when identity still matches.
    if (options.operation && binding.operationId && binding.operationId !== options.operation.operationId) {
      return false
    }
    if (options.operation && binding.revision != null && binding.revision !== options.operation.revision) {
      return false
    }
    return true
  }
  return false
}

function invalidateOwnCardSuggestion(
  options: ApplyCorrectionOptions,
  remoteRequestId: string,
  operationId?: string,
): void {
  if (!cardOwnedByRequest(options.fieldState.card, remoteRequestId, operationId)) {
    return
  }
  options.metrics.correction_card_stale += 1
  options.fieldState.card?.hide()
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

function recoverFromCorrectionFailure(
  element: EditableElement,
  session: FieldSession,
  snapshot: string,
  errorCode: string,
  options: ApplyCorrectionOptions,
  card: CorrectionCard,
  hadLocalReady: boolean,
): 'pending' | 'error' | 'aborted' {
  if (errorCode === 'aborted') {
    if (!hadLocalReady && cardOwnedByRequest(card, options.fieldState.pendingRequestId ?? '', options.operation?.operationId)) {
      card.hide()
    }
    return 'aborted'
  }

  if (isDismissedSnapshot(options.fieldState, snapshot)) {
    if (isActionableCorrectionError(errorCode) && (stateManager.correction.mode === 'box' || stateManager.correction.highlights)) {
      card.setError(mapError(errorCode))
      return 'error'
    }
    return 'error'
  }

  // Prefer any local improvement over an error card — including partial repairs.
  if (
    presentLocalBoxSuggestion(element, session, snapshot, {
      ...options,
      allowPartial: true,
    })
  ) {
    return 'pending'
  }

  // Keep an already-shown local suggestion; never replace it with a failure toast.
  if (hadLocalReady || card.hasReadyCorrection()) {
    return 'pending'
  }

  // Only surface errors the user can act on (sign-in, quota, offline, rate limit).
  if (
    isActionableCorrectionError(errorCode) &&
    (stateManager.correction.mode === 'box' || stateManager.correction.highlights)
  ) {
    card.setError(mapError(errorCode))
    return 'error'
  }

  card.hide()
  return 'error'
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
