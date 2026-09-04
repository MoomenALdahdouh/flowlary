import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { resetEngineModeForTests, setInternalEngineMode } from '../../../extension/src/core/engine/flag.ts'
import {
  startEnforceCoordinator,
  stopEnforceCoordinator,
} from '../../../extension/src/core/writeGate/enforceCoordinator.ts'
import * as pipeline from '../../../extension/src/core/writeGate/pipeline.ts'
import { LIVE_PAUSE_MS } from '../../../extension/src/features/translation/pauseGate.ts'
import { REVIEW_PAUSE_MS } from '../../../extension/src/core/engine/writingReview.ts'
import {
  ENGLISH_NETWORK_SPACING_MS,
  IdleScheduler,
  computeFeatureDeadlines,
  englishDelayMs,
  getWritingRuntime,
  isLegacyImmediateCycle,
  resetLegacyImmediateCycleForTests,
} from '../../../extension/src/core/runtime/index.ts'
import type { FeaturePolicyInput } from '../../../extension/src/core/runtime/featurePolicies.ts'

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

function basePolicy(overrides: Partial<FeaturePolicyInput> = {}): FeaturePolicyInput {
  return {
    text: 'hello',
    now: 10_000,
    lastInputAt: 10_000,
    lastEnglishNetworkAt: 0,
    composing: false,
    focusOut: false,
    helpStyle: 'suggestions',
    englishMode: 'box',
    fixWrongTyping: true,
    improveEnglish: true,
    liveTranslation: true,
    wholeFieldEnglish: true,
    reviewEnabled: true,
    ...overrides,
  }
}

describe('IdleScheduler / feature policies', () => {
  it('uses English Box delays', () => {
    expect(englishDelayMs('mid', 'box')).toBe(CORRECTION_DEFAULTS.DEBOUNCE_MS)
    expect(englishDelayMs('word ', 'box')).toBe(CORRECTION_DEFAULTS.WORD_BOUNDARY_DEBOUNCE_MS)
    expect(englishDelayMs('Done.', 'box')).toBe(CORRECTION_DEFAULTS.SENTENCE_BOUNDARY_DEBOUNCE_MS)
    const mid = computeFeatureDeadlines(basePolicy({ text: 'mid', liveTranslation: false, fixWrongTyping: false }))
    expect(mid.get('english')).toBe(10_000 + 120)
  })

  it('uses English Direct delays', () => {
    expect(englishDelayMs('mid', 'direct')).toBe(CORRECTION_DEFAULTS.LIVE_DIRECT_DEBOUNCE_MS)
    expect(englishDelayMs('word ', 'direct')).toBe(CORRECTION_DEFAULTS.LIVE_DIRECT_WORD_BOUNDARY_DEBOUNCE_MS)
    expect(englishDelayMs('Done.', 'direct')).toBe(CORRECTION_DEFAULTS.LIVE_DIRECT_SENTENCE_BOUNDARY_DEBOUNCE_MS)
    const mid = computeFeatureDeadlines(
      basePolicy({ text: 'mid', englishMode: 'direct', helpStyle: 'auto', liveTranslation: false, fixWrongTyping: false }),
    )
    expect(mid.get('english')).toBe(10_000 + 450)
  })

  it('schedules translation at 750ms when Arabic is present', () => {
    const due = computeFeatureDeadlines(basePolicy({ text: 'مرحبا' }))
    expect(due.get('translate')).toBe(10_000 + LIVE_PAUSE_MS)
  })

  it('makes translation due immediately on focus-out', () => {
    const due = computeFeatureDeadlines(basePolicy({ text: 'مرحبا', focusOut: true, now: 12_000 }))
    expect(due.get('translate')).toBe(12_000)
  })

  it('applies 2500ms English network spacing', () => {
    const due = computeFeatureDeadlines(
      basePolicy({
        text: 'mid',
        liveTranslation: false,
        fixWrongTyping: false,
        lastEnglishNetworkAt: 9_000,
      }),
    )
    expect(due.get('english')).toBe(9_000 + ENGLISH_NETWORK_SPACING_MS)
    expect(ENGLISH_NETWORK_SPACING_MS).toBe(2500)
  })

  it('uses the current English delay for layout rather than 400ms', () => {
    const box = computeFeatureDeadlines(basePolicy({ text: 'mid', liveTranslation: false, improveEnglish: false }))
    expect(box.get('layout')).toBe(10_000 + englishDelayMs('mid', 'box'))
    expect(box.get('layout')).not.toBe(10_000 + 400)
    const direct = computeFeatureDeadlines(
      basePolicy({
        text: 'mid',
        englishMode: 'direct',
        helpStyle: 'auto',
        liveTranslation: false,
        improveEnglish: false,
      }),
    )
    expect(direct.get('layout')).toBe(10_000 + 450)
  })

  it('schedules review at 900ms when whole-field English does not own it', () => {
    const due = computeFeatureDeadlines(
      basePolicy({
        wholeFieldEnglish: false,
        liveTranslation: false,
        fixWrongTyping: false,
        improveEnglish: false,
      }),
    )
    expect(due.get('review')).toBe(10_000 + REVIEW_PAUSE_MS)
    expect(REVIEW_PAUSE_MS).toBe(900)
  })

  it('does not schedule review when whole-field English owns correction', () => {
    const due = computeFeatureDeadlines(
      basePolicy({ wholeFieldEnglish: true, liveTranslation: false, fixWrongTyping: false }),
    )
    expect(due.has('review')).toBe(false)
  })

  it('keeps independent deadlines for different features on the same revision', () => {
    const due = computeFeatureDeadlines(basePolicy({ text: 'مرحبا mid' }))
    expect(due.get('english')).toBe(10_000 + 120)
    expect(due.get('translate')).toBe(10_000 + 750)
    expect(due.get('layout')).toBe(10_000 + 120)
  })
})

describe('IdleScheduler timer ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('wakes at the earliest deadline and keeps one timer per field', () => {
    const wakes: Array<{ due: string[]; revision: number }> = []
    const scheduler = new IdleScheduler({
      onWake: (wake) => {
        wakes.push({ due: [...wake.due], revision: wake.revision })
      },
    })
    scheduler.noteUserInput({
      fieldId: 'f1',
      revision: 4,
      lastInputAt: 1_000,
      snapshotText: 'مرحبا',
      composing: false,
      deadlines: new Map([
        ['english', 1_120],
        ['translate', 1_750],
      ]),
    })
    expect(scheduler.pendingTimerCount()).toBe(1)
    vi.advanceTimersByTime(119)
    expect(wakes).toEqual([])
    vi.advanceTimersByTime(1)
    expect(wakes).toEqual([{ due: ['english'], revision: 4 }])
    expect(scheduler.pendingTimerCount()).toBe(1)
    vi.advanceTimersByTime(630)
    expect(wakes).toEqual([
      { due: ['english'], revision: 4 },
      { due: ['translate'], revision: 4 },
    ])
    scheduler.stop()
  })

  it('replaces the pending timer on a new revision', () => {
    const wakes: number[] = []
    const scheduler = new IdleScheduler({
      onWake: (wake) => {
        wakes.push(wake.revision)
      },
    })
    scheduler.noteUserInput({
      fieldId: 'f1',
      revision: 1,
      lastInputAt: 1_000,
      snapshotText: 'a',
      composing: false,
      deadlines: new Map([['english', 1_120]]),
    })
    vi.setSystemTime(1_050)
    scheduler.noteUserInput({
      fieldId: 'f1',
      revision: 2,
      lastInputAt: 1_050,
      snapshotText: 'ab',
      composing: false,
      deadlines: new Map([['english', 1_170]]),
    })
    expect(scheduler.pendingTimerCount()).toBe(1)
    vi.advanceTimersByTime(119)
    expect(wakes).toEqual([])
    vi.advanceTimersByTime(1)
    expect(wakes).toEqual([2])
    scheduler.stop()
  })

  it('does not wake a stale revision after the session has moved on', () => {
    const wakes: number[] = []
    const scheduler = new IdleScheduler({
      onWake: (wake) => {
        wakes.push(wake.revision)
      },
    })
    scheduler.noteUserInput({
      fieldId: 'f1',
      revision: 1,
      lastInputAt: 1_000,
      snapshotText: 'a',
      composing: false,
      deadlines: new Map([['english', 1_050]]),
    })
    const field = scheduler.getSnapshot('f1')!
    expect(field.revision).toBe(1)
    scheduler.recompute({
      fieldId: 'f1',
      revision: 2,
      lastInputAt: 1_040,
      snapshotText: 'ab',
      composing: false,
      deadlines: new Map([['english', 2_000]]),
    })
    vi.advanceTimersByTime(20)
    expect(wakes).toEqual([])
    scheduler.stop()
  })
})

describe('WritingRuntime scheduling ownership', () => {
  let engine: InputEngine
  let cycleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    resetLegacyImmediateCycleForTests()
    stateManager.settings.enabled = true
    stateManager.settings.excludedDomains = []
    applyUserWritingPolicy({
      helpStyle: 'suggestions',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
    })
    stateManager.correction.mode = 'box'
    setInternalEngineMode('enforce')
    engine = new InputEngine()
    cycleSpy = vi.spyOn(pipeline, 'runFieldCycle').mockResolvedValue('noop')
    engine.start()
    startEnforceCoordinator(engine)
  })

  afterEach(() => {
    stopEnforceCoordinator()
    engine.stop()
    cycleSpy.mockRestore()
    resetEngineModeForTests()
    resetLegacyImmediateCycleForTests()
    vi.useRealTimers()
  })

  it('does not leave legacyImmediateCycle on by default', () => {
    expect(isLegacyImmediateCycle()).toBe(false)
  })

  it('does not run analysis on each keystroke and keeps one timer per field', () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'h')
    typeInto(ta, 'he')
    typeInto(ta, 'hel')
    typeInto(ta, 'hell')
    expect(cycleSpy).not.toHaveBeenCalled()
    expect(getWritingRuntime()?.takeAnalysisStartsForTests()).toEqual([])
    expect(getWritingRuntime()?.getScheduler().pendingTimerCount()).toBe(1)
  })

  it('multiple feature deadlines share that one timer and wake earliest first', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'مرحبا')
    expect(getWritingRuntime()?.getScheduler().pendingTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(119)
    expect(cycleSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(cycleSpy).toHaveBeenCalledTimes(1)
    const firstDue = cycleSpy.mock.calls[0]?.[2]?.dueFeatures
    expect(firstDue?.has('layout')).toBe(true)
    expect(firstDue?.has('translate')).toBeFalsy()
    await vi.advanceTimersByTimeAsync(629)
    expect(cycleSpy).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(cycleSpy).toHaveBeenCalledTimes(2)
    const secondDue = cycleSpy.mock.calls[1]?.[2]?.dueFeatures
    expect(secondDue?.has('translate')).toBe(true)
  })

  it('recomputation after a new revision does not analyze the old revision', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'a')
    const session = engine.getActiveSession()!
    const firstRevision = session.getRevision()
    await vi.advanceTimersByTimeAsync(50)
    typeInto(ta, 'ab')
    expect(session.getRevision()).toBe(firstRevision + 1)
    await vi.advanceTimersByTimeAsync(120)
    const starts = getWritingRuntime()?.takeAnalysisStartsForTests() ?? []
    expect(starts.every((item) => item.revision === session.getRevision())).toBe(true)
    expect(starts.some((item) => item.revision === firstRevision)).toBe(false)
  })

  it('an old operation cannot become schedulable after a revision bump', () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'a')
    const session = engine.getActiveSession()!
    const stale = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'english',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: 'a',
    })
    typeInto(ta, 'ab')
    expect(stale.revision).toBeLessThan(session.getRevision())
    expect(stale.state).toBe('superseded')
    getWritingRuntime()?.getScheduler().recompute({
      fieldId: session.field.id,
      revision: stale.revision,
      lastInputAt: Date.now(),
      snapshotText: 'a',
      composing: false,
      deadlines: new Map([['english', Date.now()]]),
    })
    expect(stale.state).toBe('superseded')
    expect(stale.revision).not.toBe(session.getRevision())
  })

  it('duplicate same field/revision/feature/purpose does not start duplicate work', async () => {
    const ta = textarea('مرحبا')
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'مرحبا')
    const session = engine.getActiveSession()!
    const runtime = getWritingRuntime()!
    await vi.advanceTimersByTimeAsync(120)
    runtime.takeAnalysisStartsForTests()
    runtime.getScheduler().recompute({
      fieldId: session.field.id,
      revision: session.getRevision(),
      lastInputAt: Date.now() - 120,
      snapshotText: 'مرحبا',
      composing: false,
      deadlines: new Map([['layout', Date.now()]]),
    })
    const again = runtime.takeAnalysisStartsForTests()
    expect(again.filter((item) => item.feature === 'layout')).toHaveLength(0)
  })

  it('focus-out makes translation due immediately', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'مرحبا')
    cycleSpy.mockClear()
    ta.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await Promise.resolve()
    expect(cycleSpy).toHaveBeenCalled()
    const due = cycleSpy.mock.calls.at(-1)?.[2]?.dueFeatures
    expect(due?.has('translate')).toBe(true)
  })

  it('does not schedule automatic assistance when paste arrives as insertText', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))
    typeInto(ta, 'اثممخ حمثشسث ')
    await vi.advanceTimersByTimeAsync(800)
    expect(cycleSpy).not.toHaveBeenCalled()
    expect(getWritingRuntime()?.getScheduler().pendingTimerCount()).toBe(0)
  })

  it('does not schedule after Cmd/Ctrl+V even without a paste event', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'v',
      code: 'KeyV',
      metaKey: true,
    }))
    typeInto(ta, 'اثممخ ')
    await vi.advanceTimersByTimeAsync(800)
    expect(cycleSpy).not.toHaveBeenCalled()
  })

  it('hides idle work when the field is cleared', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'hello')
    expect(getWritingRuntime()?.getScheduler().pendingTimerCount()).toBe(1)
    ta.value = ''
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
    expect(getWritingRuntime()?.getScheduler().pendingTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(800)
    expect(cycleSpy).not.toHaveBeenCalled()
  })

  it('schedules again after the user types following a paste', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true }))
    typeInto(ta, 'اثممخ ')
    await vi.advanceTimersByTimeAsync(800)
    expect(cycleSpy).not.toHaveBeenCalled()
    ta.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'h', code: 'KeyH' }))
    typeInto(ta, 'اثممخ h')
    await vi.advanceTimersByTimeAsync(120)
    expect(cycleSpy).toHaveBeenCalled()
  })
})
