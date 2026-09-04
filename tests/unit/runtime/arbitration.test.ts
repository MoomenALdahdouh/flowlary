import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { commitWriteTransaction } from '../../../extension/src/core/writeGate/writeGate.ts'
import {
  applyPipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import {
  abortLowerPriorityOperations,
  clearCommitInFlight,
  COMMIT_RANK,
  evaluateAutomaticArbitration,
  flushDeferredAutomaticCommits,
  markOperationAborted,
  markOperationFailed,
  markOperationRunning,
  prepareAutomaticWrite,
  resetArbitrationForTests,
  resetOperationIdsForTests,
  resetWriteAuthorizationIdsForTests,
  takeArbitrationDecisionsForTests,
} from '../../../extension/src/core/runtime/index.ts'
import { setRuntimeTraceSinkForTests } from '../../../extension/src/core/runtime/trace.ts'
import type { Operation } from '../../../extension/src/core/runtime/types.ts'
import { requestSameRevisionReanalyze, registerSameRevisionReanalyze } from '../../../extension/src/core/runtime/revisionBump.ts'

function textarea(value = '') {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function begin(
  session: FieldSession,
  text: string,
  feature: 'layout' | 'english' | 'translate',
  trigger: 'auto' | 'shortcut' = 'auto',
): Operation {
  const op = session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature,
    purpose: trigger === 'shortcut' ? 'shortcut' : 'auto-analysis',
    trigger,
    snapshotFullText: text,
  })
  markOperationRunning(op)
  return op
}

function candidate(
  session: FieldSession,
  operation: Operation,
  feature: 'layout' | 'english' | 'translate',
  extra: Partial<Parameters<typeof evaluateAutomaticArbitration>[0]> = {},
) {
  return {
    session,
    operation,
    feature,
    action:
      feature === 'layout'
        ? 'layout_fix' as const
        : feature === 'translate'
          ? 'translation' as const
          : 'english_correction' as const,
    effect: 'direct' as const,
    range: { start: 0, end: operation.snapshotFullText.length },
    replacement: 'X',
    ...extra,
  }
}

describe('Phase 9 unified arbitration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetOperationIdsForTests()
    resetWriteAuthorizationIdsForTests()
    resetArbitrationForTests()
    resetPipelineSuggestionsForTests()
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
    })
    stateManager.translation.liveEnabled = true
    stateManager.correction.mode = 'direct'
    stateManager.settings.enabled = true
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
    setRuntimeTraceSinkForTests(null)
    registerSameRevisionReanalyze(null)
  })

  it('1-4. only valid current operations enter as committable', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const ready = begin(session, ta.value, 'english')
    expect(evaluateAutomaticArbitration(candidate(session, ready, 'english')).verdict).toBe('ALLOW')
    clearCommitInFlight(session)

    const stale = begin(session, ta.value, 'layout')
    session.bumpGeneration()
    expect(evaluateAutomaticArbitration(candidate(session, stale, 'layout')).verdict).toBe('REJECT')

    const aborted = begin(session, ta.value, 'english')
    markOperationAborted(aborted)
    expect(evaluateAutomaticArbitration(candidate(session, aborted, 'english')).verdict).toBe('REJECT')

    const failed = begin(session, 'hi', 'translate')
    markOperationFailed(failed)
    expect(evaluateAutomaticArbitration(candidate(session, failed, 'translate')).verdict).toBe('REJECT')
  })

  it('5-10. same-revision operations coexist; completion order does not change rank', () => {
    const ta = textarea('مرحبا hello')
    const session = new FieldSession(ta)
    const layout = begin(session, ta.value, 'layout')
    const english = begin(session, ta.value, 'english')
    const translate = begin(session, ta.value, 'translate')
    expect(layout.revision).toBe(english.revision)
    expect(translate.revision).toBe(english.revision)
    expect(COMMIT_RANK.layout).toBeGreaterThan(COMMIT_RANK.translate)
    expect(COMMIT_RANK.translate).toBeGreaterThan(COMMIT_RANK.english)

    const englishFirst = evaluateAutomaticArbitration(
      candidate(session, english, 'english', { resume: () => undefined }),
    )
    expect(englishFirst.verdict).toBe('DEFER')
    const translateFirst = evaluateAutomaticArbitration(
      candidate(session, translate, 'translate', { resume: () => undefined }),
    )
    expect(translateFirst.verdict).toBe('DEFER')
    const layoutWins = prepareAutomaticWrite(candidate(session, layout, 'layout'))
    expect(layoutWins.decision.verdict).toBe('ALLOW')
    expect(layoutWins.authorization).not.toBeNull()
    clearCommitInFlight(session)
  })

  it('11-13. LAYOUT > TRANSLATE > ENGLISH; lower is deferred, higher is not blocked by lower', () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    begin(session, ta.value, 'english')
    const translate = begin(session, ta.value, 'translate')
    const decision = evaluateAutomaticArbitration(candidate(session, translate, 'translate'))
    expect(decision.verdict).toBe('ALLOW')
    expect(decision.reason).toBe('highest_ready')
    clearCommitInFlight(session)

    const english = session.operations.list().find((item) => item.feature === 'english')!
    const held = evaluateAutomaticArbitration(
      candidate(session, english, 'english', {
        resume: () => undefined,
      }),
    )
    expect(held.verdict).toBe('DEFER')
    expect(held.reason).toBe('translate_pending')
  })

  it('14-18. ALLOW mints authorization; DEFER/REJECT do not; mutex cannot revive REJECT', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const op = begin(session, ta.value, 'english')
    const allowed = prepareAutomaticWrite(candidate(session, op, 'english'))
    expect(allowed.decision.verdict).toBe('ALLOW')
    expect(allowed.authorization?.operationId).toBe(op.operationId)
    clearCommitInFlight(session)

    const blocked = begin(session, 'مرحبا', 'english')
    begin(session, 'مرحبا', 'translate')
    const deferred = prepareAutomaticWrite(
      candidate(session, blocked, 'english', { resume: () => undefined }),
    )
    expect(deferred.decision.verdict).toBe('DEFER')
    expect(deferred.authorization).toBeNull()

    markOperationFailed(blocked)
    const rejected = prepareAutomaticWrite(candidate(session, blocked, 'english'))
    expect(rejected.decision.verdict).toBe('REJECT')
    expect(rejected.authorization).toBeNull()
    const lock = session.tryAcquireWrite('CORRECT')
    expect(lock.ok).toBe(true)
    if (lock.ok) session.releaseWrite('CORRECT', lock.requestId)
    expect(prepareAutomaticWrite(candidate(session, blocked, 'english')).authorization).toBeNull()
  })

  it('19. ALLOW then revision bump is rejected by authorization/write', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const op = begin(session, ta.value, 'layout')
    const prepared = prepareAutomaticWrite(candidate(session, op, 'layout'))
    expect(prepared.authorization).not.toBeNull()
    session.bumpGeneration()
    const acquired = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    try {
      const write = commitWriteTransaction(ta, 0, 5, 'X', {
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        origin: 'FIX_LAYOUT',
        auto: true,
        capability: 'layout',
        trigger: 'auto',
        action: 'layout_fix',
        authorization: prepared.authorization!,
      })
      expect(write.verdict).toBe('stale')
    } finally {
      session.releaseWrite('FIX_LAYOUT', acquired.requestId)
    }
  })

  it('20. two simultaneous Direct candidates cannot both write overlapping text', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const layout = begin(session, ta.value, 'layout')
    const english = begin(session, ta.value, 'english')
    const first = prepareAutomaticWrite(candidate(session, layout, 'layout'))
    const second = prepareAutomaticWrite(
      candidate(session, english, 'english', { resume: () => undefined }),
    )
    expect(first.decision.verdict).toBe('ALLOW')
    expect(second.decision.verdict).not.toBe('ALLOW')
    clearCommitInFlight(session)
  })

  it('21-22. deferred/late results cannot resurrect after revision change', () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const english = begin(session, ta.value, 'english')
    begin(session, ta.value, 'translate')
    let resumed = 0
    evaluateAutomaticArbitration(
      candidate(session, english, 'english', {
        resume: () => {
          resumed += 1
        },
      }),
    )
    session.bumpGeneration()
    flushDeferredAutomaticCommits(session)
    expect(resumed).toBe(0)
    expect(evaluateAutomaticArbitration(candidate(session, english, 'english')).verdict).toBe('REJECT')
  })

  it('23-24. arbitration does not request unbounded same-revision reanalysis', () => {
    let calls = 0
    registerSameRevisionReanalyze(() => {
      calls += 1
      requestSameRevisionReanalyze('nope')
    })
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const op = begin(session, ta.value, 'english')
    evaluateAutomaticArbitration(candidate(session, op, 'english'))
    clearCommitInFlight(session)
    expect(calls).toBe(0)
    expect(session.trySameRevisionReanalysis()).toBe(true)
    expect(session.trySameRevisionReanalysis()).toBe(false)
  })

  it('25-26. older revision always loses; identity is operation-based', () => {
    const ta = textarea('one')
    const session = new FieldSession(ta)
    const older = begin(session, 'one', 'english')
    session.bumpGeneration()
    ta.value = 'two'
    const newer = begin(session, 'two', 'english')
    expect(older.operationId).not.toBe(newer.operationId)
    expect(older.revision).toBeLessThan(newer.revision)
    expect(evaluateAutomaticArbitration(candidate(session, older, 'english')).verdict).toBe('REJECT')
    expect(evaluateAutomaticArbitration(candidate(session, newer, 'english')).verdict).toBe('ALLOW')
    clearCommitInFlight(session)
  })

  it('27-29. one feature failure does not cancel the others', () => {
    const ta = textarea('مرحبا hi')
    const session = new FieldSession(ta)
    const layout = begin(session, ta.value, 'layout')
    const english = begin(session, ta.value, 'english')
    const translate = begin(session, ta.value, 'translate')
    markOperationFailed(translate)
    expect(layout.state).toBe('running')
    expect(english.state).toBe('running')
    markOperationFailed(english)
    expect(layout.state).toBe('running')
    markOperationFailed(layout)
    const translate2 = begin(session, ta.value, 'translate')
    expect(translate2.state).toBe('running')
    expect(evaluateAutomaticArbitration(candidate(session, translate2, 'translate')).verdict).toBe('ALLOW')
    clearCommitInFlight(session)
  })

  it('30-34. Box occupancy follows rank; layout cannot skip arbitration', () => {
    const source = 'مرحبا'
    const ta = textarea(source)
    const session = new FieldSession(ta)
    const translate = begin(session, source, 'translate')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getRevision(),
      range: { start: 0, end: source.length },
      sourceText: source,
      suggestion: 'Hello',
      action: 'translation',
      textOrigin: 'original_ar',
      operation: translate,
    })
    expect(applyPipelineSuggestion(session.field.id)).toBe('applied')

    const staleBox = begin(session, source, 'translate')
    session.bumpGeneration()
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: source.length },
      sourceText: source,
      suggestion: 'Hello',
      action: 'translation',
      textOrigin: 'original_ar',
      operation: staleBox,
    })
    expect(applyPipelineSuggestion(session.field.id)).not.toBe('applied')

    const enTa = textarea('helllo')
    const enSession = new FieldSession(enTa)
    stateManager.correction.enabled = false
    const english = begin(enSession, enTa.value, 'english')
    presentPipelineSuggestion({
      fieldId: enSession.field.id,
      element: enTa,
      session: enSession,
      generation: enSession.getRevision(),
      range: { start: 0, end: 6 },
      sourceText: 'helllo',
      suggestion: 'hello',
      action: 'english_correction',
      textOrigin: 'original_en',
      operation: english,
    })
    expect(applyPipelineSuggestion(enSession.field.id)).toBe('applied')

    const layout = begin(session, 'abc', 'layout')
    markOperationAborted(layout)
    const bypass = prepareAutomaticWrite(candidate(session, layout, 'layout'))
    expect(bypass.decision.verdict).toBe('REJECT')
    expect(bypass.authorization).toBeNull()
  })

  it('35. arbitration decisions are traced without user text', () => {
    const lines: string[] = []
    setRuntimeTraceSinkForTests((line) => lines.push(line))
    const secret = 'SECRET_USER_TEXT_مرحبا'
    const ta = textarea(secret)
    const session = new FieldSession(ta)
    const op = begin(session, secret, 'layout')
    evaluateAutomaticArbitration(candidate(session, op, 'layout'))
    clearCommitInFlight(session)
    expect(lines.some((line) => line.includes('ARBITRATE'))).toBe(true)
    expect(lines.some((line) => line.includes('verdict=ALLOW'))).toBe(true)
    expect(lines.join('\n')).not.toContain(secret)
  })

  it('layout Direct aborts lower-priority live operations', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const layout = begin(session, ta.value, 'layout')
    const english = begin(session, ta.value, 'english')
    abortLowerPriorityOperations(session, 'layout')
    expect(layout.state).toBe('running')
    expect(english.state).toBe('failed')
  })
})
