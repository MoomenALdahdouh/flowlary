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
import type { CorrectionMetrics } from './metrics.ts'
import type { CorrectionCard } from './ui/CorrectionCard.ts'

export type FieldCorrectionState = {
  lastSentText: string
  lastCorrectedFor: string
  pendingRequestId: string | null
  card: CorrectionCard | null
}

export type ApplyCorrectionOptions = {
  metrics: CorrectionMetrics
  fieldState: FieldCorrectionState
  currentDebouncerGeneration: () => number
  getCard: (element: EditableElement) => CorrectionCard
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
    return 'blocked'
  }

  if (!isEligibleForCorrection(fullText)) return 'noop'

  const segment = extractWritingContext(fullText)
  if (!segment.trim()) return 'noop'

  if (segment === options.fieldState.lastCorrectedFor) return 'noop'
  if (segment === options.fieldState.lastSentText && options.fieldState.pendingRequestId) {
    return 'noop'
  }

  const acquired = session.tryAcquireWrite('CORRECT')
  if (!acquired.ok) {
    options.metrics.correction_blocked += 1
    return 'busy'
  }

  const { requestId, signal } = acquired
  const remoteRequestId = `${Date.now()}-${requestId}`
  options.fieldState.lastSentText = segment
  options.fieldState.pendingRequestId = remoteRequestId
  options.metrics.correction_requests += 1
  options.metrics.correction_ai_calls += 1

  const mode = stateManager.correction.mode
  const card = options.getCard(element)
  if (mode === 'box') card.setAnalyzing()

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
      return 'aborted'
    }

    if (!element.isConnected) {
      options.metrics.correction_stale_results += 1
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
      card.hide()
      return 'stale'
    }

    if (
      !isResultStillRelevant(currentText, fullText, segment, mode) ||
      !canMergeCorrection(currentText, segment)
    ) {
      options.metrics.correction_stale_results += 1
      card.hide()
      return 'stale'
    }

    return deliverCorrectionResult(element, session, currentText, segment, result.data, options)
  } catch {
    options.metrics.correction_errors += 1
    return 'error'
  } finally {
    options.fieldState.pendingRequestId = null
    session.releaseWrite('CORRECT', requestId)
  }
}

function deliverCorrectionResult(
  element: EditableElement,
  session: FieldSession,
  currentText: string,
  segment: string,
  data: CorrectionResponse,
  options: ApplyCorrectionOptions,
): 'committed' | 'noop' | 'pending' | 'stale' {
  const correctedSegment = data.correctedText
  if (!correctedSegment || correctedSegment === segment) {
    options.getCard(element).hide()
    return 'noop'
  }

  const mode = stateManager.correction.mode

  if (mode === 'box') {
    options.getCard(element).setReady(correctedSegment, segment, () => {
      void commitMergedCorrection(element, session, segment, correctedSegment, options)
    })
    return 'pending'
  }

  return commitMergedCorrection(element, session, segment, correctedSegment, options)
}

export async function commitMergedCorrection(
  element: EditableElement,
  session: FieldSession,
  segment: string,
  correctedSegment: string,
  options: ApplyCorrectionOptions,
): Promise<'committed' | 'stale' | 'busy'> {
  const liveText = readFieldText(element)
  const merged = mergeCorrectionIntoField(liveText, segment, correctedSegment)
  if (!merged) {
    options.metrics.correction_stale_results += 1
    options.getCard(element).hide()
    return 'stale'
  }

  const acquired = session.tryAcquireWrite('CORRECT')
  if (!acquired.ok) return 'busy'

  const write = writeReplacement(element, 0, liveText.length, merged, {
    origin: 'CORRECT',
    session,
    requestId: acquired.requestId,
    expectedGeneration: acquired.generation,
    placeCaretAfter: false,
    allowActiveEdit: true,
  })

  session.releaseWrite('CORRECT', acquired.requestId)

  if (write.verdict !== 'written') {
    options.metrics.correction_stale_results += 1
    return 'stale'
  }

  options.fieldState.lastCorrectedFor = extractWritingContext(merged)
  options.fieldState.lastSentText = options.fieldState.lastCorrectedFor
  options.getCard(element).hide()
  options.metrics.correction_commits += 1
  return 'committed'
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
