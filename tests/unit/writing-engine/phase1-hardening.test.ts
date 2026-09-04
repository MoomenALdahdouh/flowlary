import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { writeReplacement } from '../../../extension/src/core/dom/editor.ts'
import { readCaret, readFieldText } from '../../../extension/src/core/dom/read.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  resolveHelpStyle,
  isShortcutsOnly,
} from '../../../extension/src/core/policy/writingPolicy.ts'
import { allowsAutomaticFieldWrite } from '../../../extension/src/core/safety/autoWrite.ts'
import {
  applyInstantSpelling,
  isAutoSpellCandidate,
} from '../../../extension/src/features/correction/instantSpell.ts'
import { applyLayoutFix } from '../../../extension/src/features/layout/fixCurrentText.ts'
import {
  clearWriteTelemetry,
  getWriteTelemetrySnapshot,
  recordWriteTelemetry,
} from '../../../extension/src/core/observability/writeTelemetry.ts'
import { STORAGE_KEYS } from '@flowlary/shared'
import {
  CONTENT_SCRIPT_POLICY_STORAGE_KEYS,
  installContentScriptAccountListener,
  resetContentScriptAccountListenerForTests,
} from '../../../extension/src/content/accountBootstrap.ts'
function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

describe('Phase 1 writing-engine hardening', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearWriteTelemetry()
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

  describe('instant spell', () => {
    it('does not auto-replace fo, ot, or im', () => {
      expect(applyInstantSpelling('a fo b ')).toBe('a fo b ')
      expect(applyInstantSpelling('go ot bed ')).toBe('go ot bed ')
      expect(applyInstantSpelling('im here ')).toBe('im here ')
      expect(isAutoSpellCandidate('fo')).toBe(false)
      expect(isAutoSpellCandidate('ot')).toBe(false)
      expect(isAutoSpellCandidate('im')).toBe(false)
    })

    it('still fixes longer unambiguous typos', () => {
      expect(applyInstantSpelling('hello hwo ')).toBe('hello how ')
    })
  })

  describe('help style mapping', () => {
    it('derives shortcuts_only when no auto capability is on', () => {
      stateManager.layout.autoEnabled = false
      stateManager.correction.enabled = false
      stateManager.translation.liveEnabled = false
      expect(resolveHelpStyle()).toBe('shortcuts_only')
      expect(isShortcutsOnly()).toBe(true)
    })

    it('honors explicit helpStyle over toggles', () => {
      stateManager.layout.autoEnabled = true
      stateManager.settings.helpStyle = 'shortcuts_only'
      expect(resolveHelpStyle()).toBe('shortcuts_only')
    })
  })

  describe('write lock', () => {
    it('auto layout acquires the field mutex', () => {
      const ta = textarea('hsjo]lj ')
      const session = new FieldSession(ta)
      const held = session.tryAcquireWrite('CORRECT')
      expect(held.ok).toBe(true)

      const applied = applyLayoutFix(
        ta,
        session,
        {
          start: 0,
          end: 7,
          word: 'hsjo]lj',
          corrected: 'استخدمت',
          sourceLayout: 'en-US-qwerty',
          targetLayout: 'ar-101',
        },
        session.getGeneration(),
        undefined,
        { historyMode: 'automatic' },
      )
      expect(applied).toBe(false)
      expect(ta.value).toBe('hsjo]lj ')
      if (held.ok) session.releaseWrite('CORRECT', held.requestId)
    })

    it('rejects a write when another request owns the mutex even without requestId', () => {
      const ta = textarea('hello')
      const session = new FieldSession(ta)
      const held = session.tryAcquireWrite('TRANSLATE')
      expect(held.ok).toBe(true)
      const result = writeReplacement(ta, 0, 5, 'world', {
        origin: 'FIX_LAYOUT',
        session,
      })
      expect(result.verdict).toBe('rejected')
      expect(result.reason).toBe('mutex')
      expect(ta.value).toBe('hello')
      if (held.ok) session.releaseWrite('TRANSLATE', held.requestId)
    })
  })

  describe('contenteditable auto-write', () => {
    it('allows automatic writes on simple contenteditable; shortcuts still write', () => {
      const el = document.createElement('div')
      el.contentEditable = 'true'
      el.textContent = 'hello'
      document.body.append(el)
      expect(allowsAutomaticFieldWrite(el)).toBe(true)

      const session = new FieldSession(el)
      const acquired = session.tryAcquireWrite('FIX_LAYOUT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      const auto = writeReplacement(el, 0, 5, 'world', {
        origin: 'FIX_LAYOUT',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        auto: true,
      })
      expect(auto.verdict).toBe('written')
      expect(el.textContent).toBe('world')
    })

    it('does not auto-write nested rich contenteditable', () => {
      const el = document.createElement('div')
      el.contentEditable = 'true'
      el.innerHTML = '<div><span>hello</span></div>'
      document.body.append(el)
      expect(allowsAutomaticFieldWrite(el)).toBe(false)

      const session = new FieldSession(el)
      const acquired = session.tryAcquireWrite('FIX_LAYOUT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      const auto = writeReplacement(el, 0, 5, 'world', {
        origin: 'FIX_LAYOUT',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        auto: true,
      })
      expect(auto.verdict).toBe('rejected')
      expect(auto.reason).toBe('unsupported_editor')
    })

    it('allows live translation auto-write on nested rich contenteditable', () => {
      const el = document.createElement('div')
      el.contentEditable = 'true'
      el.innerHTML = '<div><span>مرحبا</span></div>'
      document.body.append(el)
      expect(allowsAutomaticFieldWrite(el)).toBe(false)

      const session = new FieldSession(el)
      const acquired = session.tryAcquireWrite('TRANSLATE')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      const auto = writeReplacement(el, 0, 5, 'Hello', {
        origin: 'TRANSLATE',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        auto: true,
      })
      expect(auto.verdict).toBe('written')
      expect(readFieldText(el)).toBe('Hello')
    })

    it('keeps the following space when replacing a contenteditable word', () => {
      const el = document.createElement('div')
      el.contentEditable = 'true'
      el.textContent = 'اثممخ please'
      document.body.append(el)
      const session = new FieldSession(el)
      const acquired = session.tryAcquireWrite('FIX_LAYOUT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      const result = writeReplacement(el, 0, 5, 'hello', {
        origin: 'FIX_LAYOUT',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        auto: false,
      })
      expect(result.verdict).toBe('written')
      expect(readFieldText(el)).toBe('hello please')
    })

    it('places the caret after the completing space on contenteditable', () => {
      const el = document.createElement('div')
      el.contentEditable = 'true'
      el.textContent = 'اثممخ '
      document.body.append(el)
      const session = new FieldSession(el)
      const acquired = session.tryAcquireWrite('FIX_LAYOUT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      const result = writeReplacement(el, 0, 5, 'hello', {
        origin: 'FIX_LAYOUT',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        auto: true,
      })
      expect(result.verdict).toBe('written')
      expect(readFieldText(el)).toBe('hello ')
      expect(readCaret(el)).toBe(6)
    })

    it('allows automatic writes on textarea', () => {
      const ta = textarea('hello')
      expect(allowsAutomaticFieldWrite(ta)).toBe(true)
      const session = new FieldSession(ta)
      const acquired = session.tryAcquireWrite('CORRECT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      const result = writeReplacement(ta, 0, 5, 'world', {
        origin: 'CORRECT',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        auto: true,
      })
      expect(result.verdict).toBe('written')
      expect(ta.value).toBe('world')
    })
  })

  describe('telemetry privacy', () => {
    it('stores reason codes and never raw field text', () => {
      recordWriteTelemetry({
        capability: 'layout',
        trigger: 'auto',
        outcome: 'blocked',
        reasonCodes: ['unsupported_editor_auto_write'],
        fieldKind: 'contenteditable',
        rangeLength: 12,
      })
      const snap = getWriteTelemetrySnapshot()
      expect(snap).toHaveLength(1)
      expect(snap[0]!.reasonCodes).toContain('unsupported_editor_auto_write')
      expect(snap[0]!.shadowOnly).toBe(false)
      const serialized = JSON.stringify(snap)
      expect(serialized).not.toMatch(/hello|password|في/)
      expect(serialized).not.toContain('"text"')
    })
  })

  describe('shortcuts_only write gate', () => {
    it('rejects auto writes when helpStyle is shortcuts_only', () => {
      stateManager.settings.helpStyle = 'shortcuts_only'
      const ta = textarea('hello')
      const session = new FieldSession(ta)
      const acquired = session.tryAcquireWrite('CORRECT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      const result = writeReplacement(ta, 0, 5, 'world', {
        origin: 'CORRECT',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        auto: true,
      })
      expect(result.verdict).toBe('rejected')
      expect(result.reason).toBe('shortcuts_only')
      expect(ta.value).toBe('hello')
    })
  })

  describe('content-script policy keys', () => {
    it('lists the settings keys that live-sync', () => {
      expect(CONTENT_SCRIPT_POLICY_STORAGE_KEYS).toEqual([
        STORAGE_KEYS.settings,
        STORAGE_KEYS.correction,
        STORAGE_KEYS.translation,
        STORAGE_KEYS.layout,
        STORAGE_KEYS.layoutProfile,
      ])
    })
  })
})

describe('content-script storage listener', () => {
  beforeEach(() => {
    resetContentScriptAccountListenerForTests()
  })

  it('registers a listener that hydrates on policy key changes', async () => {
    const listeners: Array<(changes: unknown, area: string) => void> = []
    const addListener = vi.fn((fn: (changes: unknown, area: string) => void) => {
      listeners.push(fn)
    })
    ;(chrome.storage as unknown as { onChanged: { addListener: typeof addListener } }).onChanged = {
      addListener,
    }

    installContentScriptAccountListener({})
    expect(addListener).toHaveBeenCalledTimes(1)
    expect(listeners).toHaveLength(1)
  })
})
