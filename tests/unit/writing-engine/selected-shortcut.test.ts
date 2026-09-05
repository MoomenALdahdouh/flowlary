import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command } from '@flowlary/shared'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { CommandOrchestrator } from '../../../extension/src/core/router/CommandOrchestrator.ts'
import { CommandRouter } from '../../../extension/src/core/router/CommandRouter.ts'
import {
  resolveExplicitSelectionTarget,
  shortcutRangeForOperation,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { setInternalEngineMode, resetEngineModeForTests } from '../../../extension/src/core/engine/flag.ts'
import { createCorrectionFeature } from '../../../extension/src/features/correction/CorrectionFeature.ts'
import { createLayoutFeature } from '../../../extension/src/features/layout/LayoutFeature.ts'
import { createTranslationFeature } from '../../../extension/src/features/translation/TranslationFeature.ts'
import { commitWriteTransaction } from '../../../extension/src/core/writeGate/writeGate.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { issueImmediateWriteAuthorization } from '../../../extension/src/core/runtime/writeAuthorization.ts'
import * as correctionClient from '../../../extension/src/features/correction/client.ts'
import * as translationClient from '../../../extension/src/features/translation/client.ts'

vi.mock('../../../extension/src/features/correction/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../extension/src/features/correction/client.ts')>()
  return {
    ...actual,
    requestCorrectionRemote: vi.fn(actual.requestCorrectionRemote),
  }
})

vi.mock('../../../extension/src/features/translation/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../extension/src/features/translation/client.ts')>()
  return {
    ...actual,
    requestTranslationRemote: vi.fn(actual.requestTranslationRemote),
  }
})

function textarea(value = '') {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  ta.focus()
  return ta
}

function selectRange(ta: HTMLTextAreaElement, start: number, end: number) {
  ta.focus()
  ta.setSelectionRange(start, end)
}

describe('selected text shortcut actions', () => {
  let engine: InputEngine
  let router: CommandRouter
  let orchestrator: CommandOrchestrator
  let correction: ReturnType<typeof createCorrectionFeature>
  let layout: ReturnType<typeof createLayoutFeature>
  let translation: ReturnType<typeof createTranslationFeature>

  beforeEach(() => {
    document.body.innerHTML = ''
    setInternalEngineMode('enforce')
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
      polishAfterTranslate: false,
    })
    stateManager.layout.autoEnabled = true
    stateManager.layout.directShortcutEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.layout.sourceLayout = 'en-US-qwerty'
    stateManager.layout.targetLayouts = ['ar-101']
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.correction.mode = 'direct'
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.mode = 'direct'
    stateManager.translation.sourceLanguage = 'ar'
    stateManager.translation.targetLanguage = 'en'
    stateManager.settings.enabled = true

    engine = new InputEngine()
    engine.start()
    correction = createCorrectionFeature({ engine })
    layout = createLayoutFeature({ engine })
    translation = createTranslationFeature({
      engine,
      provider: async (request) => ({
        ok: true,
        translation: `EN(${request.text})`,
      }),
    })
    router = new CommandRouter()
    router.registerCorrection(correction)
    router.registerLayout(layout)
    router.registerTranslation(translation)
    orchestrator = new CommandOrchestrator({ engine, router })
    orchestrator.start()

    vi.mocked(correctionClient.requestCorrectionRemote).mockReset()
    vi.mocked(translationClient.requestTranslationRemote).mockReset()
  })

  afterEach(() => {
    orchestrator.stop()
    correction.stop()
    layout.stop()
    translation.stop()
    engine.stop()
    resetEngineModeForTests()
    document.body.innerHTML = ''
  })

  it('keeps an explicit selection in shortcutRangeForOperation', () => {
    expect(shortcutRangeForOperation('hello world again', 'CORRECT', { start: 6, end: 11 })).toEqual({
      start: 6,
      end: 11,
    })
  })

  it('rejects a selection whose live slice no longer matches the stamp', () => {
    const command: Command = {
      type: 'CORRECT',
      field: { id: 'f', tag: 'TEXTAREA' },
      text: 'aa bad aa',
      rangeStart: 3,
      rangeEnd: 6,
      explicitSelection: true,
    }
    expect(resolveExplicitSelectionTarget('aa bad aa', command)).toEqual({
      start: 3,
      end: 6,
      text: 'bad',
    })
    expect(resolveExplicitSelectionTarget('aa xxx aa', command)).toBeNull()
    expect(resolveExplicitSelectionTarget('XXaa bad aa', command)).toBeNull()
  })

  it('Fix Typing on a middle selection leaves surrounding text untouched', async () => {
    const prefix = 'KEEP '
    const broken = 'lvpfh'
    const suffix = ' END'
    const ta = textarea(`${prefix}${broken}${suffix}`)
    selectRange(ta, prefix.length, prefix.length + broken.length)
    const result = await orchestrator.dispatch('FIX_LAYOUT', { target: ta })
    expect(result.status).toBe('success')
    expect(ta.value).toBe(`${prefix}مرحبا${suffix}`)
  })

  it('rejects WriteAuthorization when the selected range text no longer matches', () => {
    const ta = textarea('hello bad world')
    const session = new FieldSession(ta)
    const auth = issueImmediateWriteAuthorization({
      session,
      action: 'english_correction',
      range: { start: 6, end: 9 },
      replacement: 'good',
      snapshotFullText: 'hello bad world',
      purpose: 'shortcut',
      trigger: 'shortcut',
    })
    ta.value = 'hello xxx world'
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const write = commitWriteTransaction(ta, 6, 9, 'good', {
      origin: 'CORRECT',
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      capability: 'correction',
      trigger: 'shortcut',
      authorization: auth,
    })
    expect(write.verdict).not.toBe('written')
    session.releaseWrite('CORRECT', acquired.requestId)
  })

  it('Improve English on a middle selection corrects only that span', async () => {
    const prefix = 'Please note: '
    const bad = 'I has a problem'
    const suffix = ' today.'
    const ta = textarea(`${prefix}${bad}${suffix}`)
    selectRange(ta, prefix.length, prefix.length + bad.length)
    vi.mocked(correctionClient.requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'sel-1',
      data: {
        originalText: bad,
        correctedText: 'I have a problem',
        changes: [],
      },
    })
    const result = await orchestrator.dispatch('CORRECT', { target: ta })
    expect(result.handlerExecuted).toBe(true)
    expect(ta.value).toBe(`${prefix}I have a problem${suffix}`)
    expect(ta.value).toContain('Please note:')
    expect(ta.value).toContain('today.')
  })

  it('Translation on a selected Arabic sentence replaces only the selection', async () => {
    const prefix = 'Intro '
    const arabic = 'مرحبا كيف حالك'
    const suffix = ' Outro'
    const ta = textarea(`${prefix}${arabic}${suffix}`)
    selectRange(ta, prefix.length, prefix.length + arabic.length)
    const result = await orchestrator.dispatch('TRANSLATE', { target: ta })
    expect(result.status).toBe('success')
    expect(ta.value).toBe(`${prefix}EN(${arabic})${suffix}`)
  })

  it('multi-sentence selection is the only translated unit', async () => {
    const prefix = 'P '
    const arabic = 'مرحبا. كيف حالك؟'
    const suffix = ' S'
    const ta = textarea(`${prefix}${arabic}${suffix}`)
    selectRange(ta, prefix.length, prefix.length + arabic.length)
    await orchestrator.dispatch('TRANSLATE', { target: ta })
    expect(ta.value).toBe(`${prefix}EN(${arabic})${suffix}`)
  })

  it('no selection keeps existing Improve English shortcut behavior', async () => {
    const ta = textarea('I has a problem')
    selectRange(ta, ta.value.length, ta.value.length)
    vi.mocked(correctionClient.requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'full-1',
      data: {
        originalText: 'I has a problem',
        correctedText: 'I have a problem',
        changes: [],
      },
    })
    await orchestrator.dispatch('CORRECT', { target: ta })
    expect(ta.value).toBe('I have a problem')
  })

  it('duplicate selected text uses the exact original offsets, not the first match', async () => {
    const first = 'I has a problem'
    const second = 'I has a problem'
    const ta = textarea(`${first} and ${second}`)
    const start = first.length + 5
    const end = start + second.length
    selectRange(ta, start, end)
    vi.mocked(correctionClient.requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'dup-1',
      data: {
        originalText: second,
        correctedText: 'I have a problem',
        changes: [],
      },
    })
    await orchestrator.dispatch('CORRECT', { target: ta })
    expect(ta.value).toBe(`${first} and I have a problem`)
    expect(ta.value.indexOf('I has a problem')).toBe(0)
    expect(ta.value.lastIndexOf('I has a problem')).toBe(0)
  })

  it('rejects a late English write after the user types', async () => {
    const ta = textarea('Prefix I has a problem')
    const start = 7
    const end = ta.value.length
    selectRange(ta, start, end)
    let release!: (value: Awaited<ReturnType<typeof correctionClient.requestCorrectionRemote>>) => void
    vi.mocked(correctionClient.requestCorrectionRemote).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    const pending = orchestrator.dispatch('CORRECT', { target: ta })
    await new Promise((r) => setTimeout(r, 20))
    ta.value = 'Prefix I has a problem!!!'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    engine.sessions.getOrCreate(ta).bumpGeneration()
    release({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'late-1',
      data: {
        originalText: 'I has a problem',
        correctedText: 'I have a problem',
        changes: [],
      },
    })
    await pending
    expect(ta.value).not.toBe('Prefix I have a problem')
  })
  it('selected shortcut works on input and simple contenteditable', async () => {
    const input = document.createElement('input')
    input.value = 'KEEP lvpfh END'
    document.body.append(input)
    input.focus()
    input.setSelectionRange(5, 10)
    await orchestrator.dispatch('FIX_LAYOUT', { target: input })
    expect(input.value).toBe('KEEP مرحبا END')

    const ce = document.createElement('div')
    ce.contentEditable = 'true'
    ce.textContent = 'KEEP lvpfh END'
    document.body.append(ce)
    ce.focus()
    const textNode = ce.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 5)
    range.setEnd(textNode, 10)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    await orchestrator.dispatch('FIX_LAYOUT', { target: ce })
    expect(ce.textContent).toBe('KEEP مرحبا END')
  })

  it('stamps explicitSelection on the command for a live selection', async () => {
    const ta = textarea('hello world')
    selectRange(ta, 0, 5)
    const seen: Command[] = []
    const original = router.dispatch.bind(router)
    router.dispatch = async (command) => {
      seen.push(command)
      return original(command)
    }
    await orchestrator.dispatch('FIX_LAYOUT', { target: ta })
    expect(seen[0]?.explicitSelection).toBe(true)
    expect(seen[0]?.rangeStart).toBe(0)
    expect(seen[0]?.rangeEnd).toBe(5)
  })
})
