import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  DEBUG_GLOBAL_KEY,
  clearDebugSnapshots,
  clearShadowDecisions,
  getInternalDebugHookForTests,
  getShadowDecisionSnapshot,
  installEngineModeGlobalWatch,
  resetEngineModeForTests,
  runShadowDecisionForTests,
  setInternalEngineMode,
  syncInternalDebugHook,
} from '../../../extension/src/core/engine/index.ts'
import { buildFieldContext } from '../../../extension/src/core/engine/context.ts'
import type { FieldContext } from '../../../extension/src/core/engine/types.ts'
import {
  clearWriteTelemetry,
  getWriteTelemetrySnapshot,
  recordWriteTelemetry,
} from '../../../extension/src/core/observability/writeTelemetry.ts'

const RAW_TEXT_KEY = /^(text|token|tokens|source|target|selection|value|innerHTML|innerText|fieldText|raw)$/i

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function contextFor(element: HTMLTextAreaElement, overrides: Partial<FieldContext> = {}): FieldContext {
  const session = new FieldSession(element)
  const base = buildFieldContext({
    element,
    session,
    cycleId: 'debug-cycle',
    composing: false,
    textLength: element.value.length,
  })
  return { ...base, ...overrides }
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys)
    return keys
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key)
    collectKeys(nested, keys)
  }
  return keys
}

describe('Phase 2.1 internal debug observability', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearShadowDecisions()
    clearWriteTelemetry()
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
    stateManager.translation.liveEnabled = false
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.mode = 'direct'
  })

  afterEach(() => {
    resetEngineModeForTests()
    clearShadowDecisions()
    clearWriteTelemetry()
  })

  it('hook is absent when mode is off', () => {
    syncInternalDebugHook()
    expect(getInternalDebugHookForTests()).toBeUndefined()
    expect((globalThis as Record<string, unknown>)[DEBUG_GLOBAL_KEY]).toBeUndefined()
  })

  it('hook is present when mode is internal_shadow', () => {
    setInternalEngineMode('internal_shadow')
    const hook = getInternalDebugHookForTests()
    expect(hook).toBeDefined()
    expect(hook!.getEngineMode()).toBe('internal_shadow')
    expect(Object.keys(hook!)).toEqual([
      'getEngineMode',
      'getEffectiveWritingPolicy',
      'getShadowDecisionSnapshot',
      'getWriteTelemetrySnapshot',
      'clearDebugSnapshots',
    ])
  })

  it('snapshot contains no raw text-like fields', () => {
    setInternalEngineMode('internal_shadow')
    const secret = 'مرحبا hsjo]lj dont leak this'
    const ta = textarea(secret)
    runShadowDecisionForTests(contextFor(ta), ta.value)
    recordWriteTelemetry({
      capability: 'layout',
      trigger: 'auto',
      outcome: 'blocked',
      reasonCodes: ['unsupported_editor_auto_write'],
      fieldKind: 'textarea',
      rangeLength: secret.length,
    })

    const hook = getInternalDebugHookForTests()!
    const dump = {
      mode: hook.getEngineMode(),
      policy: hook.getEffectiveWritingPolicy(),
      shadow: hook.getShadowDecisionSnapshot(),
      writes: hook.getWriteTelemetrySnapshot(),
    }
    const keys = collectKeys(dump)
    for (const key of keys) {
      expect(key).not.toMatch(RAW_TEXT_KEY)
    }
    const serialized = JSON.stringify(dump)
    expect(serialized).not.toContain('مرحبا')
    expect(serialized).not.toContain('hsjo')
    expect(serialized).not.toContain('dont leak')
    expect(serialized).not.toMatch(/"text":/)
    expect(dump.shadow[0]!.shadow_only).toBe(true)
    expect(dump.shadow[0]!.fieldKind).toBe('textarea')
    expect(dump.writes[0]!.outcome).toBe('blocked')
  })

  it('clear resets only in-memory rings', () => {
    setInternalEngineMode('internal_shadow')
    const ta = textarea('hello world enough words')
    runShadowDecisionForTests(contextFor(ta), ta.value)
    recordWriteTelemetry({
      capability: 'correction',
      trigger: 'auto',
      outcome: 'skipped',
      reasonCodes: ['policy_blocked'],
    })
    expect(getShadowDecisionSnapshot()).toHaveLength(1)
    expect(getWriteTelemetrySnapshot()).toHaveLength(1)

    const settingsBefore = { ...stateManager.settings }
    const layoutBefore = stateManager.layout.autoEnabled
    getInternalDebugHookForTests()!.clearDebugSnapshots()

    expect(getShadowDecisionSnapshot()).toHaveLength(0)
    expect(getWriteTelemetrySnapshot()).toHaveLength(0)
    expect(stateManager.settings).toEqual(settingsBefore)
    expect(stateManager.layout.autoEnabled).toBe(layoutBefore)
    expect(ta.value).toBe('hello world enough words')
  })

  it('hook cannot write or mutate fields', () => {
    setInternalEngineMode('internal_shadow')
    const ta = textarea('keep this value')
    const hook = getInternalDebugHookForTests()!
    hook.getEngineMode()
    hook.getEffectiveWritingPolicy()
    hook.getShadowDecisionSnapshot()
    hook.getWriteTelemetrySnapshot()
    hook.clearDebugSnapshots()
    expect(ta.value).toBe('keep this value')
    expect(hook).not.toHaveProperty('writeReplacement')
    expect(hook).not.toHaveProperty('applyLayoutFix')
    expect(typeof (hook as { acquire?: unknown }).acquire).not.toBe('function')
  })

  it('assigning the engine-mode global in the isolate attaches the hook', () => {
    installEngineModeGlobalWatch()
    expect(getInternalDebugHookForTests()).toBeUndefined()
    ;(globalThis as Record<string, unknown>).__FLOWLARY_ENGINE_MODE__ = 'internal_shadow'
    const hook = getInternalDebugHookForTests()
    expect(hook).toBeDefined()
    expect(hook!.getEngineMode()).toBe('internal_shadow')
  })

  it('clearDebugSnapshots helper matches the hook', () => {
    setInternalEngineMode('internal_shadow')
    recordWriteTelemetry({
      capability: 'command',
      trigger: 'shortcut',
      outcome: 'applied',
      reasonCodes: ['written'],
    })
    clearDebugSnapshots()
    expect(getWriteTelemetrySnapshot()).toHaveLength(0)
  })
})
