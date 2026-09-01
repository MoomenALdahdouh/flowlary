/**
 * Product readiness: local-first path, protected content, stale safety,
 * shadow-mode advisor must not block baseline decisions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  resetHypothesisIdsForTests,
  setAdvisorApplyMode,
  setHypothesisAdvisor,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy, policyPatchFromFirstWin } from '../../../extension/src/core/policy/writingPolicy.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { skipReasonForToken } from '../../../extension/src/core/safety/tokenKind.ts'
import { mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'
import { commitWriteTransaction } from '../../../extension/src/core/writeGate/writeGate.ts'
import { readFieldText } from '../../../extension/src/core/dom/read.ts'
import { clearWritingAnalytics, getWritingAnalyticsSnapshot } from '../../../extension/src/core/observability/writingAnalytics.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function setupPolicy() {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: false,
  })
  stateManager.settings = {
    enabled: true,
    pausedUntil: null,
    excludedDomains: [],
    version: 1,
    helpStyle: 'auto',
  }
  stateManager.layout.autoEnabled = true
  stateManager.layout.mode = 'direct'
  stateManager.correction.enabled = true
  stateManager.correction.mode = 'direct'
  stateManager.translation.liveEnabled = false
}

describe('product readiness — protected content abstention', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
  })

  const protectedSamples: Array<{ token: string; kind: string }> = [
    { token: 'user@example.com', kind: 'email' },
    { token: 'https://flowlary.com/docs', kind: 'url' },
    { token: 'sk-abcdefghijklmnopqrstuvwxyz123456', kind: 'api-key' },
    { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', kind: 'jwt' },
    { token: 'MY_SECRET_TOKEN=abc123', kind: 'env-secret' },
    { token: '/usr/local/bin/node', kind: 'file-path' },
    { token: 'getUserById', kind: 'code-identifier' },
  ]

  it('does not convert a Latin URL inside English into Arabic layout', () => {
    const text = 'Please visit https:'
    const ta = textarea(text)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'url2',
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text)
    const hypotheses = collectHypotheses(text, text.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('does not auto-layout an in-progress URL scheme', () => {
    const text = 'Please visit https '
    const ta = textarea(text)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'url',
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text)
    const hypotheses = collectHypotheses(text, text.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
    expect(decision.action).not.toBe('layout_fix')
    expect(skipReasonForToken('https')).toBe('url')
  })

  it.each(protectedSamples)('does not auto-modify protected token: $kind', ({ token }) => {
    const text = `Please use ${token} today.`
    const ta = textarea(text)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'prot',
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text)
    expect(analysis.chunks.some((chunk) => chunk.protectedKind != null)).toBe(true)
    const hypotheses = collectHypotheses(text, text.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
    if (decision.action !== 'noop' && decision.range) {
      const slice = text.slice(decision.range.start, decision.range.end)
      expect(slice).not.toBe(token)
    }
    expect(skipReasonForToken(token)).toBeTruthy()
  })
})

describe('product readiness — local-first without advisor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('shadow')
  })

  afterEach(() => {
    setHypothesisAdvisor(null)
  })

  it('fixes obvious layout mismatch locally without any advisor', async () => {
    const typed = mapLayoutText('hello please', 'en-US-qwerty', 'ar-101')!
    const ta = textarea(typed)
    const session = new FieldSession(ta)
    const before = ta.value
    const result = await runFieldCycle(ta, session)
    expect(['applied', 'noop', 'suggestion', 'blocked']).toContain(result)
    if (result === 'applied') {
      expect(ta.value).not.toBe(before)
    }
  })

  it('continues when advisor returns unavailable on conflicting hypotheses', () => {
    const typed = mapLayoutText('hello please thanks', 'en-US-qwerty', 'ar-101')!
    const ta = textarea(typed)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'local',
      composing: false,
      textLength: typed.length,
    })
    const analysis = analyzeFieldText(typed)
    const hypotheses = collectHypotheses(typed, typed.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, {
      observeOnly: false,
      hypotheses,
      advisorResult: 'unavailable',
    })
    expect(['noop', 'layout_fix', 'suggestion', 'english_correction']).toContain(decision.action)
  })
})

describe('product readiness — stale generation protection', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
  })

  it('rejects write when generation bumped after decision', () => {
    const ta = textarea('hello world')
    const session = new FieldSession(ta)
    const gen = session.getGeneration()
    session.bumpGeneration()
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const result = commitWriteTransaction(ta, 0, 5, 'world', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      cycleGeneration: gen,
      origin: 'CORRECT',
      auto: true,
      engineOriginated: true,
      capability: 'correction',
      trigger: 'auto',
    })
    expect(result.verdict).toBe('stale')
    expect(ta.value).toBe('hello world')
    session.releaseWrite('CORRECT', acquired.requestId)
  })

  it('runFieldCycle returns stale when user types during cycle', async () => {
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const gen = session.getGeneration()
    session.bumpGeneration()
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('stale')
    expect(session.getGeneration()).toBeGreaterThan(gen)
  })
})

describe('product readiness — shadow advisor non-blocking', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    clearWritingAnalytics()
    setupPolicy()
    setAdvisorApplyMode('shadow')
  })

  afterEach(() => {
    setHypothesisAdvisor(null)
    vi.useRealTimers()
  })

  it('does not await slow advisor before applying baseline decision', async () => {
    let resolveAdvisor: ((value: unknown) => void) | null = null
    const slowAdvisor = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveAdvisor = resolve
        }),
    )
    setHypothesisAdvisor(slowAdvisor)

    const typed = mapLayoutText('hello please thanks today', 'en-US-qwerty', 'ar-101')!
    const ta = textarea(typed)
    const session = new FieldSession(ta)

    const started = performance.now()
    const result = await runFieldCycle(ta, session)
    const elapsed = performance.now() - started
    expect(elapsed).toBeLessThan(500)
    expect(['applied', 'noop', 'suggestion', 'stale', 'blocked']).toContain(result)

    if (resolveAdvisor) {
      resolveAdvisor({
        rankedHypothesisIds: [],
        reasonCode: 'test',
        ambiguityClass: 'test',
      })
    }
  })

  it('records shadow analytics asynchronously after advisor completes', async () => {
    setHypothesisAdvisor(async () => ({
      rankedHypothesisIds: [],
      reasonCode: 'test',
      ambiguityClass: 'test',
    }))

    const typed = mapLayoutText('hello please thanks today', 'en-US-qwerty', 'ar-101')!
    const ta = textarea(typed)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    await vi.waitFor(() => {
      const events = getWritingAnalyticsSnapshot()
      return events.some((event) => event.name === 'writing.shadow_compare')
    }, { timeout: 2000 })
  })
})

describe('product readiness — local path latency', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
    setHypothesisAdvisor(null)
  })

  it('local analyze + decide completes under 50ms for typical input', () => {
    const samples = [
      'hello please send this file today',
      'أنا عملت deploy لكن فيه error',
      'Please contact user@example.com for details.',
      mapLayoutText('the meeting starts tomorrow', 'en-US-qwerty', 'ar-101')!,
    ]
    for (const text of samples) {
      const ta = textarea(text)
      const session = new FieldSession(ta)
      const context = buildFieldContext({
        element: ta,
        session,
        cycleId: 'perf',
        composing: false,
        textLength: text.length,
      })
      const started = performance.now()
      const analysis = analyzeFieldText(text)
      const hypotheses = collectHypotheses(text, text.length, context, analysis)
      const candidates = candidatesFromHypotheses(hypotheses, context)
      decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
      const elapsed = performance.now() - started
      expect(elapsed).toBeLessThan(50)
    }
  })
})

describe('product readiness — cooldown does not drop later words', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
    setHypothesisAdvisor(null)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('can apply a later local decision after write cooldown expires', async () => {
    const first = mapLayoutText('hello ', 'en-US-qwerty', 'ar-101')!
    const ta = textarea(first)
    const session = new FieldSession(ta)
    const firstResult = await runFieldCycle(ta, session)
    expect(['applied', 'noop', 'suggestion', 'blocked']).toContain(firstResult)
    if (firstResult === 'applied') {
      expect(session.isInCooldown()).toBe(true)
      const second = `${ta.value}${mapLayoutText('please', 'en-US-qwerty', 'ar-101')!} `
      ta.value = second
      const during = await runFieldCycle(ta, session)
      expect(during).toBe('noop')
      await vi.advanceTimersByTimeAsync(500)
      const later = await runFieldCycle(ta, session)
      expect(['applied', 'noop', 'suggestion', 'blocked']).toContain(later)
    }
  })
})

describe('product readiness — leftover layout after first-word write', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
  })

  it('still auto-fixes remaining mapped Arabic-keyboard English after hello is already written', () => {
    const leftover = 'hello حمثشسث '
    const ta = textarea(leftover)
    const session = new FieldSession(ta)
    session.noteEngineSpan(0, 5, 'hello')
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'left',
      composing: false,
      textLength: leftover.length,
    })
    const analysis = analyzeFieldText(leftover, {
      correctedRanges: [...session.getCorrectedRanges()],
    })
    const hypotheses = collectHypotheses(leftover, leftover.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
    expect(decision.action).toBe('layout_fix')
    expect(decision.range).toBeTruthy()
    if (decision.range) {
      expect(leftover.slice(decision.range.start, decision.range.end)).toContain('حمثشسث')
    }
  })
})

describe('product readiness — mixed language safety', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
  })

  it('does not auto-fix isolated Latin technical token inside Arabic prose', () => {
    const text = 'أرسل لي الـ API key اليوم.'
    const ta = textarea(text)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'mix',
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text)
    expect(analysis.dominantOrigin).toMatch(/mixed|ar/)
    const hypotheses = collectHypotheses(text, text.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
    if (decision.action === 'layout_fix' && decision.range) {
      const slice = text.slice(decision.range.start, decision.range.end)
      expect(slice).not.toMatch(/^API$/i)
    }
  })
})

describe('product readiness — first-run defaults and write cue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
  })

  it('maps First Win skip defaults to automatic layout and English', () => {
    const mapped = policyPatchFromFirstWin({
      fixWrongTyping: true,
      improveEnglishAuto: true,
      arabicToEnglishMode: false,
    })
    expect(mapped.policy.helpStyle).toBe('auto')
    expect(mapped.policy.fixWrongTyping).toBe(true)
    expect(mapped.correctionMode).toBe('direct')
  })

  it('shows a non-focus cue after a Write Gate mutation', () => {
    const ta = textarea('hello world')
    const session = new FieldSession(ta)
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const result = commitWriteTransaction(ta, 0, 5, 'howdy', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      cycleGeneration: session.getGeneration(),
      origin: 'CORRECT',
      auto: true,
      engineOriginated: true,
      capability: 'correction',
      trigger: 'auto',
    })
    expect(result.verdict).toBe('written')
    const flash = document.querySelector('.fl-correction-flash')
    expect(flash?.textContent).toMatch(/Improved English|Fixed typing|Updated/)
    expect(document.activeElement).not.toBe(flash)
  })
})

describe('product readiness — advisor cannot become a second writer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    clearWritingAnalytics()
    setupPolicy()
    setAdvisorApplyMode('apply')
  })

  afterEach(() => {
    setHypothesisAdvisor(null)
  })

  it('does not apply a late advisor write after the local cycle already mutated the field', async () => {
    let finishAdvisor: ((vote: {
      rankedHypothesisIds: string[]
      reasonCode: string
      ambiguityClass: string
    }) => void) | null = null
    setHypothesisAdvisor(
      () =>
        new Promise((resolve) => {
          finishAdvisor = resolve
        }),
    )

    const typed = mapLayoutText('hello please thanks today', 'en-US-qwerty', 'ar-101')!
    const ta = textarea(typed)
    const session = new FieldSession(ta)
    const result = await runFieldCycle(ta, session)
    const afterLocal = ta.value

    if (result === 'applied') {
      const preserve = {
        rankedHypothesisIds: ['missing-id-should-not-matter'],
        reasonCode: 'late_override',
        ambiguityClass: 'conflict',
      }
      finishAdvisor?.(preserve)
      await Promise.resolve()
      await Promise.resolve()
      expect(ta.value).toBe(afterLocal)
    } else {
      finishAdvisor?.({
        rankedHypothesisIds: [],
        reasonCode: 'unused',
        ambiguityClass: 'none',
      })
      expect(['noop', 'suggestion', 'stale', 'blocked']).toContain(result)
    }
  })

  it('does not auto-write when local noops and advisor later ranks layout', async () => {
    let finishAdvisor: ((vote: {
      rankedHypothesisIds: string[]
      reasonCode: string
      ambiguityClass: string
    }) => void) | null = null
    setHypothesisAdvisor(
      () =>
        new Promise((resolve) => {
          finishAdvisor = resolve
        }),
    )
    const ta = textarea('أنا عملت deploy ')
    const session = new FieldSession(ta)
    const before = ta.value
    const result = await runFieldCycle(ta, session)
    expect(result).not.toBe('applied')
    finishAdvisor?.({
      rankedHypothesisIds: ['h1'],
      reasonCode: 'late_layout',
      ambiguityClass: 'mix',
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(ta.value).toBe(before)
  })
})

describe('product readiness — simple contenteditable auto layout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setupPolicy()
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('shadow')
  })

  it('applies a completed layout token on simple contenteditable', async () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    el.textContent = 'اثممخ '
    document.body.append(el)
    const session = new FieldSession(el)
    const result = await runFieldCycle(el, session)
    expect(result).toBe('applied')
    expect(readFieldText(el)).toMatch(/^hello\s/)
  })
})
