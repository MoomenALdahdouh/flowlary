import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  ENGINE_FLAG_KEY,
  ENGINE_VERSION,
  analyzeFieldText,
  buildFieldContext,
  clearShadowDecisions,
  collectShadowCandidates,
  getEngineMode,
  getShadowDecisionSnapshot,
  resetEngineModeForTests,
  runShadowDecisionForTests,
  setInternalEngineMode,
} from '../../../extension/src/core/engine/index.ts'
import type { FieldContext } from '../../../extension/src/core/engine/types.ts'

const ENGINE_DIR = join(process.cwd(), 'src/core/engine')

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function contextFor(
  element: HTMLTextAreaElement | HTMLElement,
  overrides: Partial<FieldContext> = {},
): FieldContext {
  const session = new FieldSession(element)
  const base = buildFieldContext({
    element,
    session,
    cycleId: 'test-cycle',
    composing: false,
    textLength: 'value' in element ? element.value.length : (element.textContent?.length ?? 0),
  })
  return { ...base, ...overrides }
}

describe('Phase 2 shadow decision engine', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearShadowDecisions()
    resetEngineModeForTests()
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
    stateManager.correction.consentAccepted = true
    stateManager.translation.liveEnabled = false
    stateManager.translation.mode = 'direct'
    stateManager.translation.shortcutEnabled = true
    setInternalEngineMode('internal_shadow')
  })

  afterEach(() => {
    resetEngineModeForTests()
    clearShadowDecisions()
  })

  it('defaults to off', () => {
    resetEngineModeForTests()
    expect(getEngineMode()).toBe('off')
  })

  it('never mutates the field', () => {
    const ta = textarea('hello hsjo]lj ')
    const before = ta.value
    runShadowDecisionForTests(contextFor(ta), ta.value)
    expect(ta.value).toBe(before)
  })

  it('engine source tree does not import writers or cards', () => {
    const files = readdirSync(ENGINE_DIR).filter((name) => name.endsWith('.ts'))
    const blob = files.map((name) => readFileSync(join(ENGINE_DIR, name), 'utf8')).join('\n')
    expect(blob).not.toMatch(/\bwriteReplacement\s*\(/)
    expect(blob).not.toMatch(/\bcommitReplacement\s*\(/)
    expect(blob).not.toMatch(/\bapplyLayoutFix\s*\(/)
    expect(blob).not.toMatch(/from ['"].*CorrectionCard/)
    expect(blob).not.toMatch(/from ['"].*InlineSuggestionCard/)
    expect(blob).not.toMatch(/from ['"].*editor\.ts['"]/)
  })

  it('protected context => noop without treating it as a write', () => {
    const ta = textarea('hello')
    const result = runShadowDecisionForTests(
      contextFor(ta, { safetyAllowed: false, safetyReason: 'password-field' }),
      ta.value,
    )
    expect(result.decision.action).toBe('noop')
    expect(result.decision.reasonCodes).toContain('protected_context')
    expect(result.event.analyzed).toBe(false)
    expect(result.event.shadowOnly).toBe(true)
  })

  it('active composition => noop and no analysis', () => {
    const ta = textarea('hello')
    const result = runShadowDecisionForTests(contextFor(ta, { composing: true }), ta.value)
    expect(result.decision.action).toBe('noop')
    expect(result.decision.reasonCodes).toContain('composing')
    expect(result.event.analyzed).toBe(false)
  })

  it('shortcuts_only => noop and no shadow auto analysis', () => {
    const ta = textarea('hsjo]lj hello')
    const result = runShadowDecisionForTests(
      contextFor(ta, { helpStyle: 'shortcuts_only' }),
      ta.value,
    )
    expect(result.decision.action).toBe('noop')
    expect(result.decision.reasonCodes).toContain('policy_shortcuts_only')
    expect(result.event.analyzed).toBe(false)
    expect(result.candidates).toEqual([])
  })

  it('simple contenteditable is an auto-write surface; nested composers are not', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    el.textContent = 'hello world today'
    document.body.append(el)
    const session = new FieldSession(el)
    const ctx = buildFieldContext({
      element: el,
      session,
      cycleId: 'ce',
      composing: false,
      textLength: 16,
    })
    expect(ctx.editorTier).toBe(2)
    expect(ctx.capabilities.autoWrite).toBe(true)
    expect(ctx.capabilities.manualShortcut).toBe(true)
    const result = runShadowDecisionForTests(ctx, el.textContent ?? '')
    expect(result.decision.reasonCodes).not.toContain('unsupported_editor')
    expect(result.event.comparison).not.toBe('unsupported_editor')
  })

  it('short ambiguous token is never a layout_fix auto decision', () => {
    const ta = textarea('td ')
    const analysis = analyzeFieldText(ta.value)
    const ctx = contextFor(ta)
    const candidates = collectShadowCandidates(ta.value, ta.value.length, ctx, analysis)
    const layout = candidates.filter((item) => item.capability === 'layout_fix')
    for (const item of layout) {
      expect(item.eligibleForAuto).toBe(false)
    }
    const result = runShadowDecisionForTests(ctx, ta.value)
    expect(result.decision.action).not.toBe('layout_fix')
    expect(['noop', 'suggestion']).toContain(result.decision.action)
  })

  it('high-confidence layout mismatch outranks English correction', () => {
    const ta = textarea('hsjo]lj ')
    const result = runShadowDecisionForTests(contextFor(ta), ta.value)
    expect(result.decision.action).toBe('layout_fix')
    expect(result.decision.reasonCodes).toContain('single_winner_layout')
    expect(result.decision.blockedCandidateCapabilities).toContain('english_correction')
  })

  it('live translation candidate is session_missing and does not write', () => {
    stateManager.translation.liveEnabled = true
    const ta = textarea('مرحبا كيف حالك اليوم؟')
    const result = runShadowDecisionForTests(contextFor(ta, { liveTranslation: true }), ta.value)
    expect(result.candidates.some((item) => item.capability === 'translation')).toBe(true)
    expect(result.decision.action).not.toBe('layout_fix')
    expect(result.decision.reasonCodes.some((code) => code === 'session_missing' || code === 'legacy_live_behavior' || code === 'no_candidates' || code === 'ambiguous_mixed' || code === 'shadow_observe_only')).toBe(true)
    expect(result.event.shadowOnly).toBe(true)
  })

  it('mixed ambiguous text blocks English correction auto', () => {
    const ta = textarea('مرحبا hello how are you')
    const result = runShadowDecisionForTests(contextFor(ta), ta.value)
    expect(result.decision.action).not.toBe('english_correction')
    expect(result.analysis?.hasAmbiguousMixed).toBe(true)
    expect(result.analysis?.chunks.some((chunk) => chunk.role === 'arabic_prose')).toBe(true)
    expect(result.analysis?.chunks.some((chunk) => chunk.role === 'english_prose' || chunk.role === 'intentional_foreign_token')).toBe(true)
  })

  it('shadow telemetry has no raw text and includes flag metadata', () => {
    const ta = textarea('I dont know what to write today')
    runShadowDecisionForTests(contextFor(ta), ta.value)
    const snap = getShadowDecisionSnapshot()
    expect(snap.length).toBeGreaterThan(0)
    const row = snap[0]!
    expect(row.shadow_only).toBe(true)
    expect(row.shadowOnly).toBe(true)
    expect(row.engine_version).toBe(ENGINE_VERSION)
    expect(row.engineVersion).toBe(ENGINE_VERSION)
    expect(row.featureFlagKey).toBe(ENGINE_FLAG_KEY)
    expect(row.featureFlagVariant).toBe('internal_shadow')
    const serialized = JSON.stringify(snap)
    expect(serialized).not.toContain('dont')
    expect(serialized).not.toContain('hsjo')
    expect(serialized).not.toContain('مرحبا')
    expect(serialized).not.toMatch(/"text":/)
  })

  it('mutex-held context is noop', () => {
    const ta = textarea('hello')
    const result = runShadowDecisionForTests(contextFor(ta, { mutexHeld: true }), ta.value)
    expect(result.decision.action).toBe('noop')
    expect(result.decision.reasonCodes).toContain('mutex_held')
    expect(result.event.analyzed).toBe(false)
  })

  it('produces exactly one decision action per cycle', () => {
    const ta = textarea('I dont know what to write today')
    const result = runShadowDecisionForTests(contextFor(ta), ta.value)
    expect(['layout_fix', 'translation', 'english_correction', 'suggestion', 'noop']).toContain(
      result.decision.action,
    )
    expect(result.decision.reasonCodes).toContain('shadow_observe_only')
  })
})
