import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  ENGINE_FLAG_KEY,
  establishEngineMode,
  getEngineMode,
  isEnforceEngineEnabled,
  resetEngineModeForTests,
  setHypothesisAdvisor,
  setInternalEngineMode,
  stopShadowEngine,
} from '../../../extension/src/core/engine/index.ts'
import {
  applyUserWritingPolicy,
  policyPatchFromFirstWin,
  resolveWritingPolicy,
} from '../../../extension/src/core/policy/writingPolicy.ts'
import { startWritingRuntime } from '../../../extension/src/content/startWritingRuntime.ts'
import { stopEnforceCoordinator } from '../../../extension/src/core/writeGate/enforceCoordinator.ts'
import { analyzeFieldText } from '../../../extension/src/core/engine/chunks.ts'
import { collectShadowCandidates } from '../../../extension/src/core/engine/candidates.ts'
import { buildFieldContext } from '../../../extension/src/core/engine/context.ts'
import { decideWriting } from '../../../extension/src/core/engine/decide.ts'
import { LayoutScheduler } from '../../../extension/src/features/layout/scheduler.ts'
import { createLayoutMetrics } from '../../../extension/src/features/layout/metrics.ts'
import * as layoutFix from '../../../extension/src/features/layout/fixCurrentText.ts'
import type { LayoutClassifier } from '../../../extension/src/features/layout/classifier/LayoutClassifier.ts'
import type { SpeedBox } from '../../../extension/src/features/layout/speedBox.ts'
import type { UserLayoutProfile } from '../../../extension/src/features/layout/layouts/types.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

describe('N1 enforce initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetEngineModeForTests()
    vi.mocked(chrome.storage.local.get).mockResolvedValue({})
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

  afterEach(() => {
    stopEnforceCoordinator()
    stopShadowEngine()
    resetEngineModeForTests()
    setHypothesisAdvisor(null)
  })

  it('normal initialization is enforce before feature schedulers start', async () => {
    const order: string[] = []
    let modeWhenFeaturesStarted: string | null = null
    const engine = new InputEngine()

    const mode = await startWritingRuntime({
      engine,
      startChip: false,
      bootstrap: async () => {
        order.push('bootstrap')
        expect(isEnforceEngineEnabled()).toBe(false)
      },
      correction: {
        start() {
          order.push('correction')
          modeWhenFeaturesStarted = getEngineMode()
        },
      },
      layout: {
        start() {
          order.push('layout')
        },
      },
      translation: {
        start() {
          order.push('translation')
        },
      },
      orchestrator: {
        start() {
          order.push('orchestrator')
        },
      },
    })

    expect(mode).toBe('enforce')
    expect(modeWhenFeaturesStarted).toBe('enforce')
    expect(order).toEqual(['bootstrap', 'correction', 'layout', 'translation', 'orchestrator'])
    engine.stop()
  })

  it('explicit internal_shadow remains internal_shadow', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      [ENGINE_FLAG_KEY]: 'internal_shadow',
    })
    expect(await establishEngineMode()).toBe('internal_shadow')
    expect(isEnforceEngineEnabled()).toBe(false)
  })

  it('explicit stored off remains off', async () => {
    vi.mocked(chrome.storage.local.get).mockResolvedValue({
      [ENGINE_FLAG_KEY]: 'off',
    })
    expect(await establishEngineMode()).toBe('off')
    expect(isEnforceEngineEnabled()).toBe(false)
  })

  it('explicit memory off remains off', async () => {
    setInternalEngineMode('off')
    expect(await establishEngineMode()).toBe('off')
  })

  it('legacy layout scheduler does not write after enforce is established', async () => {
    await establishEngineMode()
    expect(isEnforceEngineEnabled()).toBe(true)

    const apply = vi.spyOn(layoutFix, 'applyLayoutFix')
    const engine = new InputEngine()
    const ta = textarea('hsjo]lj ')
    const profile: UserLayoutProfile = {
      sourceLayout: 'en-US-qwerty',
      enabledLayouts: ['en-US-qwerty', 'ar-101'],
    }
    const scheduler = new LayoutScheduler({
      engine,
      classifier: {
        decideFromCache: () => null,
        classify: async () => ({ ok: false }),
        canApply: () => false,
      } as unknown as LayoutClassifier,
      metrics: createLayoutMetrics(),
      getProfile: () => profile,
      getExceptions: () => [],
      getSpeedBox: () =>
        ({
          isOpen: () => false,
          handleEscape: () => undefined,
        }) as SpeedBox,
    })

    scheduler.start()
    engine.eventBus.emit({
      type: 'keyup',
      key: ' ',
      code: 'Space',
      target: ta,
      session: engine.sessions.getOrCreate(ta),
      composing: false,
      origin: 'USER',
    })
    expect(apply).not.toHaveBeenCalled()
    scheduler.stop()
    apply.mockRestore()
  })
})

describe('N1 First Win English shortcut-only', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
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

  it('layout auto stays on when English is shortcut only', () => {
    const mapped = policyPatchFromFirstWin({
      fixWrongTyping: true,
      improveEnglishAuto: false,
      arabicToEnglishMode: false,
    })
    expect(mapped.policy.helpStyle).toBe('auto')
    expect(mapped.policy.fixWrongTyping).toBe(true)
    expect(mapped.correctionMode).toBe('box')

    applyUserWritingPolicy(mapped.policy)
    stateManager.correction.mode = mapped.correctionMode
    const policy = resolveWritingPolicy()
    expect(policy.helpStyle).toBe('auto')
    expect(policy.fixWrongTyping).toBe(true)
    expect(policy.improveEnglish).toBe(true)
    expect(policy.arabicToEnglishMode).toBe(false)
    expect(stateManager.layout.autoEnabled).toBe(true)
    expect(stateManager.correction.enabled).toBe(true)
    expect(stateManager.correction.mode).toBe('box')
    expect(stateManager.translation.liveEnabled).toBe(false)
  })

  it('does not auto-apply English when correction mode is box', () => {
    const mapped = policyPatchFromFirstWin({
      fixWrongTyping: true,
      improveEnglishAuto: false,
      arabicToEnglishMode: false,
    })
    applyUserWritingPolicy(mapped.policy)
    stateManager.correction.mode = 'box'

    const ta = textarea('I dont know ')
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'n1',
      composing: false,
      textLength: ta.value.length,
    })
    const analysis = analyzeFieldText(ta.value)
    const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
    const english = candidates.find((item) => item.capability === 'english_correction')
    expect(english?.eligibleForAuto).toBe(false)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false })
    expect(decision.action).not.toBe('english_correction')
    expect(context.layoutAuto).toBe(true)
  })

  it('uses shortcuts_only only when no capability stays automatic', () => {
    const mapped = policyPatchFromFirstWin({
      fixWrongTyping: false,
      improveEnglishAuto: false,
      arabicToEnglishMode: false,
    })
    expect(mapped.policy.helpStyle).toBe('shortcuts_only')
    expect(mapped.policy.fixWrongTyping).toBe(false)
  })
})
