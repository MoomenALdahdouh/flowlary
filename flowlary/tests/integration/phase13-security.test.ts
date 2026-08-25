import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { bumpUserGeneration } from '../../extension/src/core/dom/generation.ts'
import { shouldProcessFrame } from '../../extension/src/core/dom/frameGuard.ts'
import { evaluateFieldSafety } from '../../extension/src/core/safety/index.ts'
import { canCacheText } from '../../extension/src/storage/cache/privacy.ts'
import { canRecordHistory } from '../../extension/src/storage/history/privacy.ts'
import { createCacheMetrics } from '@flowlary/shared'
import {
  normalizeCorrection,
  normalizeEntitlement,
  normalizeSettings,
  normalizeTranslation,
} from '../../extension/src/storage/index.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'

describe('Phase 13 — security hardening', () => {
  beforeEach(() => {
    resetBackgroundStartupForTests()
    createMockChromeStorage().install()
    stateManager.settings.enabled = true
    stateManager.settings.pausedUntil = null
    stateManager.settings.excludedDomains = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('background message handling', () => {
    it('rejects unknown messages safely', async () => {
      expect(await handleMessage(null)).toEqual({ ok: false, error: 'unknown_message' })
      expect(await handleMessage({ type: 'RUN_COMMAND', operation: 'PIPELINE' })).toEqual({
        ok: false,
        error: 'unsupported_operation',
      })
    })

    it('normalizes malformed settings patches instead of trusting raw assign', async () => {
      await handleMessage({ type: 'SET_SETTINGS', patch: { enabled: 'yes', excludedDomains: 'bad' } })
      expect(stateManager.settings.enabled).toBe(true)
      expect(stateManager.settings.excludedDomains).toEqual([])
    })

    it('does not accept oversized CORRECT_TEXT', async () => {
      const result = await handleMessage({
        type: 'CORRECT_TEXT',
        requestId: 'req-1',
        text: 'x'.repeat(5000),
        groqApiKey: 'gsk_test_key_123456789012345678901234567890',
      })
      expect(result).toEqual(expect.objectContaining({ ok: false }))
    })
  })

  describe('command orchestrator', () => {
    let engine: InputEngine
    let router: CommandRouter
    let orchestrator: CommandOrchestrator

    beforeEach(() => {
      document.body.innerHTML = ''
      engine = new InputEngine()
      router = new CommandRouter()
      router.register('CORRECT', async () => ({ ok: true, operation: 'CORRECT' }))
      orchestrator = new CommandOrchestrator({ engine, router })
      engine.start()
      orchestrator.start()
    })

    afterEach(() => {
      orchestrator.stop()
      engine.stop()
    })

    it('ignores PIPELINE runtime messages', async () => {
      const ta = document.createElement('textarea')
      document.body.append(ta)
      ta.focus()
      const result = orchestrator.handleRuntimeMessage({ type: 'RUN_COMMAND', operation: 'PIPELINE' })
      expect(result).toBeNull()
      expect(orchestrator.executed).toHaveLength(0)
    })

    it('blocks password fields before dispatch', async () => {
      const input = document.createElement('input')
      input.type = 'password'
      document.body.append(input)
      input.focus()
      const result = await orchestrator.dispatch('CORRECT')
      expect(result.status).toBe('blocked')
      expect(orchestrator.executed).toHaveLength(0)
    })

    it('rejects stale generation commits', async () => {
      const ta = document.createElement('textarea')
      document.body.append(ta)
      ta.value = 'hello'
      ta.focus()
      const session = engine.getSession(ta)!
      const acquired = session.tryAcquireWrite('CORRECT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      bumpUserGeneration(ta, session)
      expect(session.canCommit(acquired.generation, acquired.requestId).ok).toBe(false)
      session.releaseWrite('CORRECT', acquired.requestId)
    })

    it('aborted handler response cannot commit', async () => {
      const ta = document.createElement('textarea')
      document.body.append(ta)
      ta.value = 'hello'
      ta.focus()
      router.register('CORRECT', async () => {
        const session = engine.getSession(ta)
        session?.abortActiveRequest()
        return { ok: true, operation: 'CORRECT' }
      })
      const result = await orchestrator.dispatch('CORRECT')
      expect(result.status).toBe('aborted')
    })
  })

  describe('safety gate', () => {
    beforeEach(() => {
      document.body.innerHTML = ''
    })

    it('blocks sensitive tokens in field text', () => {
      const el = document.createElement('textarea')
      document.body.append(el)
      expect(evaluateFieldSafety(el, { text: JWT }).allowed).toBe(false)
      expect(
        evaluateFieldSafety(el, { text: 'gsk_1234567890123456789012345678901234567890' }).allowed,
      ).toBe(false)
      expect(
        evaluateFieldSafety(el, { text: '-----BEGIN PRIVATE KEY-----\nabc' }).allowed,
      ).toBe(false)
    })

    it('blocks excluded domains', () => {
      const el = document.createElement('textarea')
      document.body.append(el)
      const safety = evaluateFieldSafety(el, {
        hostname: 'secret.example',
        excludedDomains: ['secret.example'],
        text: 'hello',
      })
      expect(safety.allowed).toBe(false)
    })
  })

  describe('cache and history privacy', () => {
    it('does not cache API key shaped text', () => {
      expect(canCacheText('gsk_1234567890123456789012345678901234567890')).toBe(false)
    })

    it('does not record blocked history', () => {
      const el = document.createElement('input')
      el.type = 'password'
      document.body.append(el)
      expect(canRecordHistory({ element: el, sourceText: 'secret', resultText: 'Secret' })).toBe(false)
    })
  })

  describe('storage corruption tolerance', () => {
    it('recovers safe defaults from malformed storage', () => {
      expect(normalizeSettings({ enabled: 123, excludedDomains: 'x' }).enabled).toBe(true)
      expect(normalizeCorrection({ mode: 'admin' }).mode).toBe('direct')
      expect(normalizeTranslation({ liveEnabled: 'true' }).liveEnabled).toBe(false)
      expect(normalizeEntitlement({ license: { cache: { valid: 'yes' } } }).status).not.toBe('pro')
    })
  })

  describe('metrics stay metadata-only', () => {
    it('does not include user text fields', () => {
      const metrics = createCacheMetrics()
      const keys = Object.keys(metrics)
      expect(keys.some((key) => /text|key|token|password|secret/i.test(key))).toBe(false)
    })
  })

  describe('iframe policy', () => {
    it('processes top frame', () => {
      expect(shouldProcessFrame(window)).toBe(true)
    })
  })
})
