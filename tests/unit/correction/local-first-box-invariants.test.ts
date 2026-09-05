/**
 * Writing Runtime safety invariants for local-first English Box.
 * Does not redesign runtime — only verifies late AI cannot violate Box identity.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyLocalEnglishRepair,
  lookupKnownTypo,
} from '@flowlary/shared'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { markOperationRunning } from '../../../extension/src/core/runtime/index.ts'
import {
  acceptCorrectionSuggestion,
  dismissCorrectionSuggestion,
  runCorrectionRequest,
} from '../../../extension/src/features/correction/applyCorrection.ts'
import { createCorrectionMetrics } from '../../../extension/src/features/correction/metrics.ts'
import { CorrectionCard } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import { IntelligentDebouncer } from '../../../extension/src/features/correction/debounce.ts'
import { requestCorrectionRemote } from '../../../extension/src/features/correction/client.ts'
import { clearAssistCooldownForTests } from '../../../extension/src/features/correction/assistCooldown.ts'
import {
  buildLocalCorrectionResponse,
  isActionableCorrectionError,
  presentLocalBoxSuggestion,
} from '../../../extension/src/features/correction/localSuggestion.ts'

vi.mock('../../../extension/src/features/correction/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../extension/src/features/correction/client.ts')>()
  return {
    ...actual,
    requestCorrectionRemote: vi.fn(),
  }
})

function fieldSetup(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const debouncer = new IntelligentDebouncer(() => undefined)
  debouncer.schedule(ta.value)
  const fieldState = {
    debouncer,
    lastSentText: '',
    lastCorrectedFor: '',
    pendingRequestId: null as string | null,
    lastCorrectionRequestAt: 0,
    card: null as CorrectionCard | null,
    cardMounted: false,
    dismissedSnapshotFullText: null as string | null,
  }
  const card = new CorrectionCard({
    highlights: true,
    onApply: () => undefined,
    onDismiss: () => undefined,
  })
  fieldState.card = card
  const getCard = (el: typeof ta) => {
    card.mount(el)
    fieldState.cardMounted = true
    return card
  }
  return { ta, session, debouncer, fieldState, card, getCard }
}

function beginEnglish(session: FieldSession, text: string) {
  const op = session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'english',
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: text,
  })
  markOperationRunning(op)
  return op
}

describe('local-first English Box — Writing Runtime invariants', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    applyUserWritingPolicy({
      helpStyle: 'suggestions',
      improveEnglish: true,
      fixWrongTyping: false,
      arabicToEnglishMode: false,
    })
    stateManager.correction.consentAccepted = true
    stateManager.correction.enabled = true
    stateManager.correction.highlights = true
    clearAssistCooldownForTests()
    vi.mocked(requestCorrectionRemote).mockReset()
  })

  afterEach(() => {
    vi.mocked(requestCorrectionRemote).mockReset()
  })

  it('1. local typo suggestion appears immediately while AI is delayed', async () => {
    let release!: (value: unknown) => void
    const gate = new Promise((resolve) => {
      release = resolve
    })
    vi.mocked(requestCorrectionRemote).mockImplementation(async (id, text) => {
      await gate
      return {
        type: 'CORRECT_TEXT_RESULT' as const,
        ok: true as const,
        requestId: id,
        data: {
          originalText: text,
          correctedText: 'Hello, how are you?',
          changes: [],
        },
      }
    })

    const source = 'hell hwo are yuo'
    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(source)
    const operation = beginEnglish(session, source)
    const pending = runCorrectionRequest(ta, session, source, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })

    // Before AI resolves: local Box must already be ready.
    await vi.waitFor(() => {
      expect(card.getState()).toBe('ready')
    })
    expect(card.getBinding()?.remoteRequestId.startsWith('local-')).toBe(true)
    expect(card.getBinding()?.response.correctedText.toLowerCase()).toContain('you')

    release(undefined)
    await pending
    expect(card.getState()).toBe('ready')
  })

  it('2. typing again before AI returns — late AI cannot replace newer Box', async () => {
    let release!: (value: unknown) => void
    const gate = new Promise((resolve) => {
      release = resolve
    })
    vi.mocked(requestCorrectionRemote).mockImplementation(async (id, text) => {
      await gate
      return {
        type: 'CORRECT_TEXT_RESULT' as const,
        ok: true as const,
        requestId: id,
        data: {
          originalText: text,
          correctedText: 'STALE_AI_SHOULD_NOT_APPEAR',
          changes: [],
        },
      }
    })

    const first = 'hell hwo are yuo'
    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(first)
    const op1 = beginEnglish(session, first)
    const late = runCorrectionRequest(ta, session, first, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation: op1,
    })
    await vi.waitFor(() => expect(card.getState()).toBe('ready'))

    // User types again — new revision + newer local Box (same field).
    session.bumpGeneration()
    const second = 'I dont know'
    ta.value = second
    const shown = presentLocalBoxSuggestion(ta, session, second, {
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation: beginEnglish(session, second),
    })
    expect(shown).toBe(true)
    const newerBinding = card.getBinding()
    expect(newerBinding?.snapshotFullText).toBe(second)
    expect(newerBinding?.response.correctedText).toContain("don't")

    release(undefined)
    const lateResult = await late
    expect(lateResult).toBe('stale')
    expect(card.getBinding()?.snapshotFullText).toBe(second)
    expect(card.getBinding()?.response.correctedText).not.toBe('STALE_AI_SHOULD_NOT_APPEAR')
    expect(ta.value).toBe(second)
  })

  it('3. dismiss local Box — late AI cannot resurrect for the old revision', async () => {
    let release!: (value: unknown) => void
    const gate = new Promise((resolve) => {
      release = resolve
    })
    vi.mocked(requestCorrectionRemote).mockImplementation(async (id, text) => {
      await gate
      return {
        type: 'CORRECT_TEXT_RESULT' as const,
        ok: true as const,
        requestId: id,
        data: {
          originalText: text,
          correctedText: 'Hello, how are you?',
          changes: [],
        },
      }
    })

    const source = 'hell hwo are yuo'
    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(source)
    const operation = beginEnglish(session, source)
    const late = runCorrectionRequest(ta, session, source, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    await vi.waitFor(() => expect(card.getState()).toBe('ready'))
    const binding = card.getBinding()
    dismissCorrectionSuggestion(ta, binding, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    expect(card.getState()).toBe('hidden')
    expect(fieldState.dismissedSnapshotFullText).toBe(source)

    release(undefined)
    const result = await late
    expect(['noop', 'stale', 'pending']).toContain(result)
    expect(card.getState()).toBe('hidden')
    expect(ta.value).toBe(source)
  })

  it('4. accept local Box — late AI cannot overwrite committed text', async () => {
    let release!: (value: unknown) => void
    const gate = new Promise((resolve) => {
      release = resolve
    })
    vi.mocked(requestCorrectionRemote).mockImplementation(async (id, text) => {
      await gate
      return {
        type: 'CORRECT_TEXT_RESULT' as const,
        ok: true as const,
        requestId: id,
        data: {
          originalText: text,
          correctedText: 'LATE_AI_OVERWRITE',
          changes: [],
        },
      }
    })

    const source = 'hell hwo are yuo'
    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(source)
    const operation = beginEnglish(session, source)
    const late = runCorrectionRequest(ta, session, source, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    await vi.waitFor(() => expect(card.getState()).toBe('ready'))
    const binding = card.getBinding()!
    const accepted = await acceptCorrectionSuggestion(ta, session, binding, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    expect(accepted).toBe('committed')
    const committed = ta.value
    expect(committed.toLowerCase()).toContain('you')
    expect(committed).not.toBe(source)

    release(undefined)
    const lateResult = await late
    expect(lateResult).toBe('stale')
    expect(ta.value).toBe(committed)
    expect(ta.value).not.toContain('LATE_AI_OVERWRITE')
  })

  it('5. AI refinement may replace Box only when identity remains valid', async () => {
    let release!: (value: unknown) => void
    const gate = new Promise((resolve) => {
      release = resolve
    })
    vi.mocked(requestCorrectionRemote).mockImplementation(async (id, text) => {
      await gate
      return {
        type: 'CORRECT_TEXT_RESULT' as const,
        ok: true as const,
        requestId: id,
        data: {
          originalText: text,
          correctedText: 'Hello, how are you today?',
          changes: [],
        },
      }
    })

    const source = 'hell hwo are yuo'
    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(source)
    const operation = beginEnglish(session, source)
    const pending = runCorrectionRequest(ta, session, source, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    await vi.waitFor(() => expect(card.getBinding()?.remoteRequestId.startsWith('local-')).toBe(true))
    const localOpId = card.getBinding()?.operationId
    expect(localOpId).toBe(operation.operationId)

    release(undefined)
    expect(await pending).toBe('pending')
    expect(card.getState()).toBe('ready')
    expect(card.getBinding()?.response.correctedText).toBe('Hello, how are you today?')
    expect(card.getBinding()?.operationId).toBe(operation.operationId)
    expect(card.getBinding()?.revision).toBe(operation.revision)
    expect(card.getBinding()?.snapshotFullText).toBe(source)
  })

  it('6. transient provider/gateway/timeout failures remain silent', async () => {
    for (const code of ['AI_UNAVAILABLE', 'AI_PROVIDER_ERROR', 'AI_TIMEOUT', 'AI_INVALID_RESPONSE', 'gateway_http_502'] as const) {
      expect(isActionableCorrectionError(code)).toBe(false)
    }

    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: false,
      requestId: 'x',
      error: 'AI_PROVIDER_ERROR',
    })

    // No local typo available — must hide, not error-toast.
    const source = 'I need more details about this topic please'
    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(source)
    const operation = beginEnglish(session, source)
    const result = await runCorrectionRequest(ta, session, source, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    expect(['error', 'noop']).toContain(result)
    expect(card.getState()).not.toBe('error')
    expect(requestCorrectionRemote).toHaveBeenCalled()
  })

  it('7. auth, quota, offline, and rate-limit errors remain actionable', async () => {
    for (const code of ['consent_required', 'usage_exhausted', 'entitlement_denied', 'account_required', 'auth_failed', 'network', 'rate_limited'] as const) {
      expect(isActionableCorrectionError(code)).toBe(true)
    }

    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: false,
      requestId: 'x',
      error: 'usage_exhausted',
    })
    const source = 'I need more details about this topic please'
    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(source)
    const operation = beginEnglish(session, source)
    const result = await runCorrectionRequest(ta, session, source, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    expect(result).toBe('error')
    expect(card.getState()).toBe('error')
    expect(requestCorrectionRemote).toHaveBeenCalled()
  })

  it('8. typo-map repairs only for explicit known mappings', () => {
    expect(lookupKnownTypo('yuo')).toBe('you')
    expect(lookupKnownTypo('helpng')).toBe('helping')
    expect(lookupKnownTypo('xyzqwv')).toBeNull()
    expect(lookupKnownTypo('helpngxyz')).toBeNull()

    const mapped = applyLocalEnglishRepair('yuo helpng')
    expect(mapped.toLowerCase()).toContain('you')
    expect(mapped.toLowerCase()).toContain('helping')

    // Arbitrary near-miss must not invent a mapping (allowPartial requires typo-map hits).
    const untouched = 'flibberjab'
    expect(lookupKnownTypo(untouched)).toBeNull()
    expect(buildLocalCorrectionResponse(untouched, { allowPartial: true })).toBeNull()
    expect(applyLocalEnglishRepair(untouched).toLowerCase()).toContain('flibberjab')
  })
})
