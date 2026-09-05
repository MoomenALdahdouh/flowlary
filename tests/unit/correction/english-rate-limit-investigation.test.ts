/**
 * Evidence harness + regression: English AI request frequency under IdleScheduler.
 * Confirms normal typing is not a request storm; 2500ms network spacing is honored.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyLocalEnglishRepair, isCredibleLocalEnglish } from '@flowlary/shared'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { resetEngineModeForTests, setInternalEngineMode } from '../../../extension/src/core/engine/flag.ts'
import {
  startEnforceCoordinator,
  stopEnforceCoordinator,
} from '../../../extension/src/core/writeGate/enforceCoordinator.ts'
import {
  ENGLISH_NETWORK_SPACING_MS,
  getWritingRuntime,
  markOperationRunning,
  resetLegacyImmediateCycleForTests,
  resetOperationIdsForTests,
  resetPhysicalHttpForTests,
  resetWriteAuthorizationIdsForTests,
} from '../../../extension/src/core/runtime/index.ts'
import { resetPipelineSuggestionsForTests } from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { createCorrectionFeature } from '../../../extension/src/features/correction/CorrectionFeature.ts'
import { runCorrectionRequest } from '../../../extension/src/features/correction/applyCorrection.ts'
import { createCorrectionMetrics } from '../../../extension/src/features/correction/metrics.ts'
import { CorrectionCard } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import { IntelligentDebouncer } from '../../../extension/src/features/correction/debounce.ts'
import { requestCorrectionRemote } from '../../../extension/src/features/correction/client.ts'
import { clearAssistCooldownForTests } from '../../../extension/src/features/correction/assistCooldown.ts'
import { buildLocalCorrectionResponse } from '../../../extension/src/features/correction/localSuggestion.ts'

vi.mock('../../../extension/src/features/correction/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../extension/src/features/correction/client.ts')>()
  return {
    ...actual,
    requestCorrectionRemote: vi.fn(),
  }
})

/** Screenshot text from the rate-limit report. */
const SCREENSHOT =
  'hell hwo are yuo ar eyou okay if you need i can hel yuo'

type RequestLog = {
  at: number
  requestId: string
  textLen: number
}

function textarea(value = '') {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function typeInto(ta: HTMLTextAreaElement, value: string) {
  ta.value = value
  ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}

function fieldSetup(text: string) {
  const ta = textarea(text)
  const session = new FieldSession(ta)
  const debouncer = new IntelligentDebouncer(() => undefined)
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

async function bootEnglishRuntime() {
  setInternalEngineMode('enforce')
  const engine = new InputEngine()
  const correction = createCorrectionFeature({ engine })
  engine.start()
  startEnforceCoordinator(engine)
  correction.start()
  const ta = textarea()
  ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  return { engine, correction, ta }
}

function shutdown(correction: ReturnType<typeof createCorrectionFeature>, engine: InputEngine) {
  correction.stop()
  stopEnforceCoordinator()
  engine.stop()
}

describe('English rate-limit / request frequency', () => {
  const logs: RequestLog[] = []

  beforeEach(() => {
    document.body.innerHTML = ''
    logs.length = 0
    resetOperationIdsForTests()
    resetWriteAuthorizationIdsForTests()
    resetPipelineSuggestionsForTests()
    resetPhysicalHttpForTests()
    resetLegacyImmediateCycleForTests()
    clearAssistCooldownForTests()
    applyUserWritingPolicy({
      helpStyle: 'suggestions',
      fixWrongTyping: false,
      improveEnglish: true,
      arabicToEnglishMode: false,
    })
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'box'
    stateManager.correction.consentAccepted = true
    stateManager.correction.highlights = true
    stateManager.settings.enabled = true
    vi.mocked(requestCorrectionRemote).mockReset()
    vi.mocked(requestCorrectionRemote).mockImplementation(async (requestId, text) => {
      logs.push({
        at: Date.now(),
        requestId: String(requestId),
        textLen: String(text).length,
      })
      return {
        type: 'CORRECT_TEXT_RESULT',
        ok: true,
        requestId,
        data: {
          originalText: String(text),
          correctedText: applyLocalEnglishRepair(String(text)),
          changes: [],
        },
      }
    })
  })

  afterEach(() => {
    stopEnforceCoordinator()
    resetEngineModeForTests()
    resetPhysicalHttpForTests()
    vi.useRealTimers()
  })

  it('screenshot local repair is useful but not strictly credible (needs AI or partial fallback)', () => {
    const fixed = applyLocalEnglishRepair(SCREENSHOT)
    expect(fixed).not.toBe(SCREENSHOT)
    expect(fixed.toLowerCase()).toContain('help')
    expect(fixed.toLowerCase()).not.toContain('yuo')
    expect(isCredibleLocalEnglish(fixed)).toBe(false)
    expect(buildLocalCorrectionResponse(SCREENSHOT)).toBeNull()
    expect(buildLocalCorrectionResponse(SCREENSHOT, { allowPartial: true })).not.toBeNull()
  })

  it('A. type normally and pause once → exactly 1 AI request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    const { engine, correction, ta } = await bootEnglishRuntime()

    for (const ch of 'hell hwo are yuo') {
      typeInto(ta, `${ta.value}${ch}`)
      vi.advanceTimersByTime(20)
    }
    expect(logs.length).toBe(0)

    await vi.advanceTimersByTimeAsync(150)
    await Promise.resolve()
    await Promise.resolve()
    expect(logs.length).toBe(1)

    shutdown(correction, engine)
  })

  it('B. continuous typing → 0 until final pause, then 1', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(20_000)
    const { engine, correction, ta } = await bootEnglishRuntime()

    for (let i = 1; i <= SCREENSHOT.length; i++) {
      typeInto(ta, SCREENSHOT.slice(0, i))
      vi.advanceTimersByTime(30)
    }
    expect(logs.length).toBe(0)
    await vi.advanceTimersByTimeAsync(150)
    await Promise.resolve()
    await Promise.resolve()
    expect(logs.length).toBe(1)

    shutdown(correction, engine)
  })

  it('C. sentence, pause, edit one word → 2 AI requests; 2500ms spacing respected', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(30_000)
    const { engine, correction, ta } = await bootEnglishRuntime()

    typeInto(ta, 'hell hwo are yuo')
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    await Promise.resolve()
    expect(logs.length).toBe(1)
    const firstAt = logs[0]!.at

    typeInto(ta, 'hell how are yuo')
    // Advance only past box idle delay — not the network spacing timer.
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    expect(logs.length).toBe(1)

    const session = engine.sessions.get(ta)!
    const snap = getWritingRuntime()?.getScheduler().getSnapshot(session.field.id)
    const englishDue = snap?.deadlines.get('english')
    expect(englishDue).toBe(firstAt + ENGLISH_NETWORK_SPACING_MS)

    await vi.advanceTimersByTimeAsync(ENGLISH_NETWORK_SPACING_MS)
    await Promise.resolve()
    await Promise.resolve()
    expect(logs.length).toBe(2)
    expect(logs[1]!.at - logs[0]!.at).toBeGreaterThanOrEqual(ENGLISH_NETWORK_SPACING_MS)

    shutdown(correction, engine)
  })

  it('D. several typos then one pause → exactly 1 AI request', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(35_000)
    const { engine, correction, ta } = await bootEnglishRuntime()

    // Must include English function words so AI eligibility passes (local alone is not enough).
    typeInto(ta, 'hell hwo are yuo helpng me')
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    await Promise.resolve()
    expect(logs.length).toBe(1)

    shutdown(correction, engine)
  })

  it('F. AI pending while typing → spacing prevents request storm', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(40_000)
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    vi.mocked(requestCorrectionRemote).mockImplementation(async (requestId, text) => {
      logs.push({
        at: Date.now(),
        requestId: String(requestId),
        textLen: String(text).length,
      })
      await gate
      return {
        type: 'CORRECT_TEXT_RESULT',
        ok: true,
        requestId,
        data: {
          originalText: String(text),
          correctedText: applyLocalEnglishRepair(String(text)),
          changes: [],
        },
      }
    })

    const { engine, correction, ta } = await bootEnglishRuntime()
    typeInto(ta, 'hell hwo are yuo')
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    expect(logs.length).toBe(1)

    typeInto(ta, 'hell hwo are yuo okay')
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    expect(logs.length).toBe(1)

    await vi.advanceTimersByTimeAsync(ENGLISH_NETWORK_SPACING_MS)
    await Promise.resolve()
    expect(logs.length).toBeLessThanOrEqual(2)

    release()
    await Promise.resolve()
    shutdown(correction, engine)
  })

  it('G. AI failure then continue typing → no automatic retry loop', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(45_000)
    vi.mocked(requestCorrectionRemote).mockImplementation(async (requestId) => {
      logs.push({
        at: Date.now(),
        requestId: String(requestId),
        textLen: 0,
      })
      return {
        type: 'CORRECT_TEXT_RESULT',
        ok: false,
        requestId,
        error: 'AI_PROVIDER_ERROR',
      }
    })

    const { engine, correction, ta } = await bootEnglishRuntime()
    typeInto(ta, 'hell hwo are yuo')
    await vi.advanceTimersByTimeAsync(200)
    await Promise.resolve()
    await Promise.resolve()
    expect(logs.length).toBe(1)

    // Without further USER input, no automatic retry.
    await vi.advanceTimersByTimeAsync(5_000)
    await Promise.resolve()
    expect(logs.length).toBe(1)

    shutdown(correction, engine)
  })

  it('screenshot + rate_limited prefers partial local Box; rate-limit stays actionable when no local fix', async () => {
    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: false,
      requestId: 'rl',
      error: 'rate_limited',
    })

    const withLocal = fieldSetup(SCREENSHOT)
    const op1 = beginEnglish(withLocal.session, SCREENSHOT)
    const outcome1 = await runCorrectionRequest(
      withLocal.ta,
      withLocal.session,
      SCREENSHOT,
      withLocal.debouncer.currentGeneration(),
      {
        metrics: createCorrectionMetrics(),
        fieldState: withLocal.fieldState,
        currentDebouncerGeneration: () => withLocal.debouncer.currentGeneration(),
        getCard: withLocal.getCard,
        operation: op1,
      },
    )
    expect(outcome1).toBe('pending')
    expect(withLocal.card.getState()).toBe('ready')
    expect(withLocal.card.getBinding()?.remoteRequestId.startsWith('local-')).toBe(true)

    // No local improvement possible → rate-limit message remains actionable.
    clearAssistCooldownForTests()
    const untouched = 'Hello, how are you?'
    expect(buildLocalCorrectionResponse(untouched, { allowPartial: true })).toBeNull()
    const noLocal = fieldSetup(untouched)
    const op2 = beginEnglish(noLocal.session, untouched)
    const outcome2 = await runCorrectionRequest(
      noLocal.ta,
      noLocal.session,
      untouched,
      noLocal.debouncer.currentGeneration(),
      {
        metrics: createCorrectionMetrics(),
        fieldState: noLocal.fieldState,
        currentDebouncerGeneration: () => noLocal.debouncer.currentGeneration(),
        getCard: noLocal.getCard,
        operation: op2,
      },
    )
    expect(outcome2).toBe('error')
    expect(noLocal.card.getState()).toBe('error')
  })

  it('known local typos show local Box first; AI refine still sends exactly one request', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    vi.mocked(requestCorrectionRemote).mockImplementation(async (requestId, text) => {
      logs.push({
        at: Date.now(),
        requestId: String(requestId),
        textLen: String(text).length,
      })
      await gate
      return {
        type: 'CORRECT_TEXT_RESULT',
        ok: true,
        requestId,
        data: {
          originalText: String(text),
          correctedText: 'Hello, how are you?',
          changes: [],
        },
      }
    })

    const source = 'hell hwo are yuo'
    expect(isCredibleLocalEnglish(applyLocalEnglishRepair(source))).toBe(true)
    expect(buildLocalCorrectionResponse(source)).not.toBeNull()

    const { ta, session, debouncer, fieldState, card, getCard } = fieldSetup(source)
    const operation = beginEnglish(session, source)
    const pending = runCorrectionRequest(ta, session, source, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    await vi.waitFor(() => expect(card.getState()).toBe('ready'))
    expect(card.getBinding()?.remoteRequestId.startsWith('local-')).toBe(true)
    expect(logs.length).toBe(1)
    release()
    await pending
    expect(logs.length).toBe(1)
  })

  it('IdleScheduler owns automatic English; typing does not analyze per keystroke', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(50_000)
    const { engine, correction, ta } = await bootEnglishRuntime()
    typeInto(ta, 'h')
    typeInto(ta, 'he')
    typeInto(ta, 'hel')
    expect(getWritingRuntime()?.takeAnalysisStartsForTests()).toEqual([])
    expect(logs.length).toBe(0)
    await vi.advanceTimersByTimeAsync(44)
    expect(getWritingRuntime()?.takeAnalysisStartsForTests()).toEqual([])
    await vi.advanceTimersByTimeAsync(80)
    const starts = getWritingRuntime()?.takeAnalysisStartsForTests() ?? []
    expect(starts.some((s) => s.feature === 'english')).toBe(true)
    shutdown(correction, engine)
  })
})
