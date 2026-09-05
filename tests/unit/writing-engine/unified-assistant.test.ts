import { beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  applyUserWritingPolicy,
  resolveOperatingState,
  resolveWritingPolicy,
} from '../../../extension/src/core/policy/writingPolicy.ts'
import { decideWriting } from '../../../extension/src/core/engine/decide.ts'
import { analyzeFieldText } from '../../../extension/src/core/engine/chunks.ts'
import { collectShadowCandidates } from '../../../extension/src/core/engine/candidates.ts'
import { buildFieldContext } from '../../../extension/src/core/engine/context.ts'
import { applyInstantSpellingIfSafe } from '../../../extension/src/features/correction/instantSpell.ts'
import { WRITE_COOLDOWN_MS } from '../../../extension/src/core/writeGate/writeGate.ts'
import {
  clearWritingAnalytics,
  getWritingAnalyticsSnapshot,
  recordWritingAnalytics,
} from '../../../extension/src/core/observability/writingAnalytics.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

describe('unified writing assistant', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearWritingAnalytics()
    stateManager.settings = {
      enabled: true,
      pausedUntil: null,
      excludedDomains: [],
      version: 1,
      helpStyle: null,
    }
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.translation.liveEnabled = false
    stateManager.translation.mode = 'direct'
    stateManager.translation.shortcutEnabled = true
  })

  it('fixWrongTyping and improveEnglish project independently', () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
    })
    applyUserWritingPolicy({ fixWrongTyping: false })
    expect(resolveWritingPolicy().fixWrongTyping).toBe(false)
    expect(resolveWritingPolicy().improveEnglish).toBe(true)
    expect(stateManager.layout.autoEnabled).toBe(false)
    expect(stateManager.correction.enabled).toBe(true)

    applyUserWritingPolicy({ improveEnglish: false })
    applyUserWritingPolicy({ fixWrongTyping: true })
    expect(resolveWritingPolicy().fixWrongTyping).toBe(true)
    expect(resolveWritingPolicy().improveEnglish).toBe(false)
    expect(stateManager.layout.autoEnabled).toBe(true)
    expect(stateManager.correction.enabled).toBe(false)
  })

  it('maps policy onto legacy feature flags', () => {
    applyUserWritingPolicy({
      helpStyle: 'shortcuts_only',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
    })
    const policy = resolveWritingPolicy()
    expect(policy.operatingState).toBe('manual')
    expect(stateManager.layout.autoEnabled).toBe(false)
    expect(stateManager.translation.liveEnabled).toBe(false)
    expect(stateManager.correction.enabled).toBe(true)
  })

  it('keeps live translation on in Box mode so cards can appear', () => {
    applyUserWritingPolicy({
      helpStyle: 'suggestions',
      fixWrongTyping: false,
      improveEnglish: false,
      arabicToEnglishMode: true,
    })
    const policy = resolveWritingPolicy()
    expect(policy.helpStyle).toBe('suggestions')
    expect(policy.liveTranslation).toBe(true)
    expect(stateManager.translation.liveEnabled).toBe(true)
    expect(stateManager.translation.mode).toBe('box')
  })

  it('keeps existing users on derived auto when helpStyle is unset', () => {
    expect(resolveWritingPolicy().helpStyle).toBe('auto')
    expect(resolveWritingPolicy().derived).toBe(true)
  })

  it('blocks instant spelling when the field looks like a layout mismatch', () => {
    expect(applyInstantSpellingIfSafe('hsjo]lj ')).toBe('hsjo]lj ')
  })

  it('prefers layout over grammar in one decision', () => {
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 't1',
      composing: false,
      textLength: ta.value.length,
    })
    const analysis = analyzeFieldText(ta.value)
    const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false })
    expect(decision.blockedCandidateCapabilities).toContain('english_correction')
    if (decision.action !== 'noop') {
      expect(decision.action).toBe('layout_fix')
    }
  })

  it('does not auto-translate without an explicit session', () => {
    applyUserWritingPolicy({ arabicToEnglishMode: false })
    const ta = textarea('مرحبا بالعالم.')
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 't2',
      composing: false,
      textLength: ta.value.length,
    })
    const analysis = analyzeFieldText(ta.value)
    const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false })
    expect(decision.action === 'translation').toBe(false)
  })

  it('field pause clears the translation session', () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    session.ensureTranslationSession()
    expect(session.getTranslationSessionId()).toBeTruthy()
    session.pauseTranslationOnField()
    expect(session.isTranslationPaused()).toBe(true)
    expect(session.ensureTranslationSession()).toBeNull()
  })

  it('cooldown blocks stacked auto writes', () => {
    const session = new FieldSession(textarea('hello'))
    session.enterCooldown(WRITE_COOLDOWN_MS)
    expect(session.isInCooldown()).toBe(true)
    session.bumpGeneration()
    expect(session.isInCooldown()).toBe(false)
  })

  it('records analytics without raw text', () => {
    recordWritingAnalytics({
      name: 'writing.decision',
      action: 'noop',
      trigger: 'auto',
      outcome: 'noop',
      textOrigin: 'original_en',
      reasonCodes: ['ambiguous_mixed'],
      shadowOnly: false,
    })
    const event = getWritingAnalyticsSnapshot()[0]
    expect(event?.textOrigin).toBe('original_en')
    expect(JSON.stringify(event)).not.toMatch(/hello/)
  })

  it('operating states match the three user modes', () => {
    expect(resolveOperatingState('auto', false)).toBe('normal')
    expect(resolveOperatingState('auto', true)).toBe('translation')
    expect(resolveOperatingState('shortcuts_only', true)).toBe('manual')
  })
})
