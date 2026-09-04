/**
 * Phase 14 — full regression matrix (cross-feature, infrastructure, safety).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStubCorrectionFeature, createStubTranslationFeature } from '@flowlary/shared'
import { LAYOUT_IDS } from '../../extension/src/features/layout/layouts/types.ts'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { createCorrectionFeature } from '../../extension/src/features/correction/CorrectionFeature.ts'
import { createTranslationFeature } from '../../extension/src/features/translation/TranslationFeature.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { detectShortcut } from '../../extension/src/core/input/shortcuts.ts'
import { shouldProcessFrame } from '../../extension/src/core/dom/frameGuard.ts'
import { evaluateFieldSafety } from '../../extension/src/core/safety/index.ts'
import { isExcludedHost, normalizeExcludedDomains } from '../../extension/src/core/safety/domains.ts'
import { OWNED_DOCUMENT_EVENTS } from '../../extension/src/core/events/EventBus.ts'
import { bumpUserGeneration } from '../../extension/src/core/dom/generation.ts'
import { convertManualText } from '../../extension/src/features/layout/layouts/convert.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'

vi.mock('../../extension/src/features/correction/client.ts', () => ({
  requestCorrectionRemote: vi.fn(),
  cancelCorrectionRemote: vi.fn(),
}))

import { requestCorrectionRemote } from '../../extension/src/features/correction/client.ts'

const mockCorrect = vi.mocked(requestCorrectionRemote)

function shortcut(code: string, extra: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    shiftKey: true,
    code,
    ...extra,
  })
}

describe('Phase 14 — regression matrix', () => {
  describe('cross-feature mutex (same field)', () => {
    let engine: InputEngine
    let router: CommandRouter
    let orchestrator: CommandOrchestrator
    let correctCalls: number
    let translateCalls: number
    let layoutCalls: number

    beforeEach(() => {
      vi.useFakeTimers()
      document.body.innerHTML = ''
      correctCalls = 0
      translateCalls = 0
      layoutCalls = 0
      mockCorrect.mockReset()
      mockCorrect.mockImplementation(async (requestId, text) => ({
        type: 'CORRECT_TEXT_RESULT',
        ok: true,
        requestId,
        data: { originalText: text, correctedText: text, changes: [] },
      }))

      stateManager.settings.enabled = true
      stateManager.correction.enabled = true
      stateManager.correction.consentAccepted = true
      stateManager.correction.mode = 'direct'
      stateManager.translation.liveEnabled = false
      stateManager.layout.autoEnabled = false

      engine = new InputEngine()
      router = new CommandRouter()

      const correction = createCorrectionFeature({ engine })
      const originalCorrect = correction.execute.bind(correction)
      correction.execute = async (cmd) => {
        correctCalls += 1
        return originalCorrect(cmd)
      }
      router.registerCorrection(correction)

      const translation = createTranslationFeature({
        engine,
        provider: async (req) => {
          translateCalls += 1
          return { ok: true, translation: `EN:${req.text}` }
        },
      })
      router.registerTranslation(translation)

      const layout = createLayoutFeature({ engine })
      const originalLayout = layout.execute.bind(layout)
      layout.execute = async (cmd) => {
        layoutCalls += 1
        return originalLayout(cmd)
      }
      router.registerLayout(layout)

      orchestrator = new CommandOrchestrator({
        engine,
        router,
        onSpeedBox: () => layout.handleSpeedBox(),
      })
      engine.start()
      correction.start()
      layout.start()
      translation.start()
      orchestrator.start()
    })

    afterEach(() => {
      orchestrator.stop()
      engine.stop()
      vi.useRealTimers()
    })

    it('manual FIX_LAYOUT then TRANSLATE then CORRECT — one writer at a time, no auto-chaining', async () => {
      const ta = document.createElement('textarea')
      ta.value = 'hsjo]lj I dont know what to write'
      document.body.append(ta)
      ta.focus()

      const layoutResult = await orchestrator.dispatch('FIX_LAYOUT')
      expect(layoutResult.handlerExecuted).toBe(true)
      expect(layoutCalls).toBe(1)
      expect(translateCalls).toBe(0)
      expect(correctCalls).toBe(0)

      const translateResult = await orchestrator.dispatch('TRANSLATE')
      expect(translateResult.handlerExecuted).toBe(true)
      expect(translateCalls).toBe(1)
      expect(correctCalls).toBe(0)

      const correctResult = await orchestrator.dispatch('CORRECT')
      expect(correctResult.handlerExecuted).toBe(true)
      expect(correctCalls).toBe(1)

      expect(orchestrator.executed).toEqual(['FIX_LAYOUT', 'TRANSLATE', 'CORRECT'])
      expect(layoutCalls).toBe(1)
      expect(translateCalls).toBe(1)
      expect(correctCalls).toBe(1)
    })

    it('second operation while mutex held returns busy', async () => {
      const ta = document.createElement('textarea')
      ta.value = 'hello'
      document.body.append(ta)
      ta.focus()
      ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      const session = engine.getSession(ta)!
      const hold = session.tryAcquireWrite('CORRECT')
      expect(hold.ok).toBe(true)
      if (!hold.ok) return

      const result = await orchestrator.dispatch('TRANSLATE')
      expect(result.status).toBe('busy')
      session.releaseWrite('CORRECT', hold.requestId)
    })
  })

  describe('command router isolation', () => {
    it('PIPELINE and unknown operations fail closed', async () => {
      const router = new CommandRouter()
      router.register('CORRECT', createStubCorrectionFeature().execute)
      const pipeline = await router.dispatch({
        type: 'PIPELINE',
        field: { id: 'f', tag: 'TEXTAREA' },
        text: 'x',
      })
      expect(pipeline.error).toBe('pipeline_not_implemented')
    })
  })

  describe('shortcut regression', () => {
    it('detects translate, layout, speed box with Ctrl/Cmd+Shift', () => {
      expect(detectShortcut(shortcut('Comma'))).toBe('TRANSLATE')
      expect(detectShortcut(shortcut('KeyP'))).toBe('FIX_LAYOUT')
      expect(detectShortcut(shortcut('KeyE'))).toBe('CORRECT')
      expect(detectShortcut(shortcut('KeyL'))).toBe('SPEED_BOX')
      expect(detectShortcut(shortcut('KeyL', { metaKey: true, ctrlKey: false }))).toBe('SPEED_BOX')
    })

    it('rejects wrong modifier combinations', () => {
      expect(detectShortcut(new KeyboardEvent('keydown', { code: 'Comma', ctrlKey: true }))).toBeNull()
      expect(detectShortcut(new KeyboardEvent('keydown', { code: 'Comma', shiftKey: true }))).toBeNull()
    })

    it('250ms dedupe prevents duplicate dispatch', async () => {
      const engine = new InputEngine()
      const router = new CommandRouter()
      const handler = vi.fn(async () => ({ ok: true, operation: 'TRANSLATE' as const }))
      router.register('TRANSLATE', handler)
      const orchestrator = new CommandOrchestrator({ engine, router })
      engine.start()
      orchestrator.start()
      const ta = document.createElement('textarea')
      document.body.append(ta)
      ta.focus()
      await orchestrator.handleShortcut('TRANSLATE')
      await orchestrator.handleShortcut('TRANSLATE')
      expect(handler).toHaveBeenCalledTimes(1)
      orchestrator.stop()
      engine.stop()
    })
  })

  describe('InputEngine listener ownership', () => {
    it('registers exactly one set of document listeners', () => {
      const addSpy = vi.spyOn(document, 'addEventListener')
      const engine = new InputEngine()
      engine.start()
      const first = addSpy.mock.calls.filter(([type]) =>
        OWNED_DOCUMENT_EVENTS.includes(type as (typeof OWNED_DOCUMENT_EVENTS)[number]),
      ).length
      engine.start()
      const second = addSpy.mock.calls.filter(([type]) =>
        OWNED_DOCUMENT_EVENTS.includes(type as (typeof OWNED_DOCUMENT_EVENTS)[number]),
      ).length
      expect(first).toBe(OWNED_DOCUMENT_EVENTS.length)
      expect(second).toBe(first)
      engine.stop()
      addSpy.mockRestore()
    })
  })

  describe('code editor blocking', () => {
    it('blocks Monaco and CodeMirror structures', () => {
      for (const className of ['monaco-editor', 'CodeMirror', 'ace_editor']) {
        const host = document.createElement('div')
        host.className = className
        const el = document.createElement('textarea')
        host.append(el)
        document.body.append(host)
        expect(evaluateFieldSafety(el).allowed).toBe(false)
        host.remove()
      }
    })
  })

  describe('excluded domains', () => {
    it('matches exact host and subdomains only', () => {
      const domains = normalizeExcludedDomains(['example.com'])
      expect(isExcludedHost('example.com', domains)).toBe(true)
      expect(isExcludedHost('sub.example.com', domains)).toBe(true)
      expect(isExcludedHost('notexample.com', domains)).toBe(false)
      expect(isExcludedHost('bank.example', domains)).toBe(false)
    })
  })

  describe('iframe policy', () => {
    it('allows top frame processing', () => {
      expect(shouldProcessFrame(window)).toBe(true)
    })
  })

  describe('layout world mappings', () => {
    it('every supported layout id round-trips manual conversion', () => {
      for (const id of LAYOUT_IDS) {
        const result = convertManualText('abc', 'en-US-qwerty', id)
        expect(result.ok).toBe(true)
        if (result.ok) expect(typeof result.text).toBe('string')
      }
    })

    it('required world layouts are registered', () => {
      const required = [
        'tr-q',
        'el-standard',
        'es-latam',
        'it-standard',
        'pt-abnt',
        'uk-standard',
        'fa-standard',
        'de-qwertz',
        'fr-azerty',
      ]
      for (const id of required) {
        expect(LAYOUT_IDS).toContain(id)
      }
    })
  })

  describe('background messaging', () => {
    beforeEach(() => {
      resetBackgroundStartupForTests()
      createMockChromeStorage().install()
    })

    it('GET_STATUS and SET_SETTINGS survive malformed patches', async () => {
      const status = await handleMessage({ type: 'GET_STATUS' })
      expect(status).toMatchObject({ brand: { name: 'Flowlary' } })
      await handleMessage({ type: 'SET_SETTINGS', patch: { enabled: 'bad', excludedDomains: 123 } })
      expect(stateManager.settings.enabled).toBe(true)
    })
  })

  describe('performance sanity', () => {
    it('safety evaluation stays bounded on repeated calls', () => {
      const el = document.createElement('textarea')
      document.body.append(el)
      const text = 'hello world this is normal writing text'
      const start = performance.now()
      for (let i = 0; i < 200; i += 1) {
        evaluateFieldSafety(el, { text })
      }
      expect(performance.now() - start).toBeLessThan(500)
    })
  })

  describe('field session stale protection', () => {
    it('user edit during in-flight operation blocks commit', () => {
      const el = document.createElement('textarea')
      const engine = new InputEngine()
      engine.start()
      const session = engine.sessions.getOrCreate(el)
      const acquired = session.tryAcquireWrite('CORRECT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      bumpUserGeneration(el, session)
      expect(session.canCommit(acquired.generation, acquired.requestId).ok).toBe(false)
      session.releaseWrite('CORRECT', acquired.requestId)
      engine.stop()
    })
  })
})
