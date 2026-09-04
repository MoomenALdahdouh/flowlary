import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  decideWriting,
  analyzeFieldText,
  collectShadowCandidates,
  buildFieldContext,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { setPipelineTranslateFnForTests } from '../../../extension/src/core/writeGate/pipelineTranslate.ts'
import { WRITE_COOLDOWN_MS } from '../../../extension/src/core/writeGate/writeGate.ts'
import * as writeGate from '../../../extension/src/core/writeGate/writeGate.ts'
import { runLiveTranslation } from '../../../extension/src/features/translation/liveTranslate.ts'
import { TranslationEngine } from '../../../extension/src/features/translation/engine.ts'
import { createTranslationMetrics } from '../../../extension/src/features/translation/metrics.ts'
import type { TranslationOutcome } from '../../../extension/src/features/translation/types.ts'

import { LIVE_PAUSE_MS } from '../../../extension/src/features/translation/pauseGate.ts'
import { setInternalEngineMode, resetEngineModeForTests } from '../../../extension/src/core/engine/flag.ts'
import {
  startEnforceCoordinator,
  stopEnforceCoordinator,
} from '../../../extension/src/core/writeGate/enforceCoordinator.ts'

const ARABIC_SENTENCE = 'أريد إرسال هذا البريد غدًا.'
const ARABIC_INCOMPLETE = 'أريد إرسال هذا البريد'
const TRANSLATION_DIR = join(process.cwd(), 'src/features/translation')

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

/** Bypass 750ms pause gate (e.g. blur/focus-out) so runFieldCycle can translate synchronously. */
function allowTranslationPause(session: FieldSession) {
  session.noteBlurTranslationPass()
}

function enableTranslation(polish = false) {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: true,
    polishAfterTranslate: polish,
  })
  setInternalEngineMode('enforce')
}

function disableTranslation() {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: false,
    polishAfterTranslate: false,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('N2 unified translation pipeline', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    disableTranslation()
    setPipelineTranslateFnForTests(async (text) => ({ ok: true, translation: `EN:${text}` }))
    stateManager.correction.mode = 'direct'
    stateManager.layout.mode = 'direct'
  })

  afterEach(() => {
    setPipelineTranslateFnForTests(null)
    resetEngineModeForTests()
    stateManager.settings.helpStyle = null
    stateManager.settings.fixWrongTyping = null
    stateManager.settings.improveEnglish = null
    stateManager.settings.arabicToEnglishMode = null
    stateManager.settings.polishAfterTranslate = null
    stateManager.settings.improveEnglishAfterTranslate = null
    stateManager.translation.liveEnabled = false
    stateManager.layout.autoEnabled = true
    stateManager.correction.mode = 'direct'
  })

  it('Translation Mode OFF → no translation', async () => {
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('noop')
    expect(ta.value).toBe(ARABIC_SENTENCE)
    expect(session.getTranslationSessionId()).toBeNull()
  })

  it('Translation Mode ON → session becomes active', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    expect(session.getTranslationSessionId()).toBeTruthy()
  })

  it('Arabic alone does not activate translation', async () => {
    disableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'off',
      composing: false,
      textLength: ta.value.length,
    })
    expect(context.arabicToEnglishMode).toBe(false)
    const candidates = collectShadowCandidates(
      ta.value,
      ta.value.length,
      context,
      analyzeFieldText(ta.value),
    )
    expect(candidates.some((item) => item.capability === 'translation')).toBe(false)
    await runFieldCycle(ta, session)
    expect(ta.value).toBe(ARABIC_SENTENCE)
  })

  it('translation waits for pause before emitting a hypothesis', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_INCOMPLETE)
    const session = new FieldSession(ta)
    session.noteInput()
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('noop')
    expect(ta.value).toBe(ARABIC_INCOMPLETE)
  })

  it('translation runs after pause with paragraph fallback (Lingo liveSegmentOnPause)', async () => {
    enableTranslation()
    const ta = textarea(`${ARABIC_INCOMPLETE} `)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('applied')
    expect(ta.value).toBe(`EN:${ARABIC_INCOMPLETE}`)
  })

  it('active session produces a real translation through the pipeline', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('applied')
    expect(ta.value).toBe(`EN:${ARABIC_SENTENCE}`)
  })

  it('translation result goes through the Write Gate', async () => {
    enableTranslation()
    const gate = vi.spyOn(writeGate, 'commitWriteTransaction')
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    expect(gate).toHaveBeenCalled()
    expect(gate.mock.calls[0]?.[4]).toMatchObject({
      capability: 'translation',
      trigger: 'auto',
      tagTranslated: true,
      textOrigin: 'translated_en',
    })
    gate.mockRestore()
  })

  it('translation sources do not call writeReplacement or mutate .value directly', () => {
    const files = readdirSync(TRANSLATION_DIR).filter((name) => name.endsWith('.ts'))
    const blob = [
      ...files.map((name) => readFileSync(join(TRANSLATION_DIR, name), 'utf8')),
      readFileSync(join(process.cwd(), 'src/core/writeGate/pipelineTranslate.ts'), 'utf8'),
    ].join('\n')
    expect(blob).not.toMatch(/\bwriteReplacement\s*\(/)
    expect(blob).not.toMatch(/\bsetNativeValue\s*\(/)
    expect(blob).toMatch(/\bcommitWriteTransaction\s*\(/)
  })

  it('global ON + field paused → no translation in that field', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    session.pauseTranslationOnField()
    const result = await runFieldCycle(ta, session)
    expect(result).not.toBe('applied')
    expect(ta.value).toBe(ARABIC_SENTENCE)
    expect(session.isTranslationPaused()).toBe(true)
  })

  it('global ON + another field active still translates', async () => {
    enableTranslation()
    const a = textarea(ARABIC_SENTENCE)
    const b = textarea(ARABIC_SENTENCE)
    const sessionA = new FieldSession(a)
    const sessionB = new FieldSession(b)
    sessionA.pauseTranslationOnField()
    allowTranslationPause(sessionB)
    await runFieldCycle(a, sessionA)
    await runFieldCycle(b, sessionB)
    expect(a.value).toBe(ARABIC_SENTENCE)
    expect(b.value).toBe(`EN:${ARABIC_SENTENCE}`)
  })

  it('resume paused field restores translation', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    session.pauseTranslationOnField()
    await runFieldCycle(ta, session)
    expect(ta.value).toBe(ARABIC_SENTENCE)
    session.resumeTranslationOnField()
    allowTranslationPause(session)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('applied')
    expect(ta.value).toBe(`EN:${ARABIC_SENTENCE}`)
  })

  it('stale translation response is discarded', async () => {
    enableTranslation()
    const hold = deferred<TranslationOutcome>()
    setPipelineTranslateFnForTests(() => hold.promise)
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    const pending = runFieldCycle(ta, session)
    ta.value = 'نص جديد.'
    session.bumpGeneration()
    hold.resolve({ ok: true, translation: 'STALE' })
    expect(await pending).toBe('stale')
    expect(ta.value).toBe('نص جديد.')
  })

  it('current translation response is accepted', async () => {
    enableTranslation()
    const hold = deferred<TranslationOutcome>()
    setPipelineTranslateFnForTests(() => hold.promise)
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    const pending = runFieldCycle(ta, session)
    hold.resolve({ ok: true, translation: 'Fresh English.' })
    expect(await pending).toBe('applied')
    expect(ta.value).toBe('Fresh English.')
  })

  it('successful translation is tagged translated_en', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    expect(session.hasTranslatedOverlap(0, ta.value.length)).toBe(true)
    session.pruneTranslatedTags(ta.value)
    expect(session.getTranslatedRanges().length).toBeGreaterThan(0)
  })

  it('user edit of translated text invalidates the tag', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    ta.value = `X${ta.value.slice(1)}`
    session.pruneTranslatedTags(ta.value)
    expect(session.hasTranslatedOverlap(0, ta.value.length)).toBe(false)
  })

  it('cooldown prevents immediate English rewrite', async () => {
    enableTranslation(false)
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    expect(session.isInCooldown()).toBe(true)
    const before = ta.value
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe(before)
  })

  it('improveEnglishAfterTranslate ON may polish after cooldown', async () => {
    enableTranslation(true)
    setPipelineTranslateFnForTests(async () => ({ ok: true, translation: 'I dont know.' }))
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    expect(ta.value).toBe('I dont know.')
    session.enterCooldown(0)
    const result = await runFieldCycle(ta, session)
    expect(['applied', 'noop']).toContain(result)
    if (result === 'applied') {
      expect(ta.value).toContain("don't")
    }
  })

  it('improveEnglishAfterTranslate OFF → no automatic polish', async () => {
    enableTranslation(false)
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    session.enterCooldown(0)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'polish-off',
      composing: false,
      textLength: ta.value.length,
    })
    session.pruneTranslatedTags(ta.value)
    const analysis = analyzeFieldText(ta.value)
    if (session.hasTranslatedOverlap(0, ta.value.length)) {
      analysis.dominantOrigin = 'translated_en'
    }
    const decision = decideWriting(
      { ...context, cooldownActive: false, polishAfterTranslate: false },
      analysis,
      collectShadowCandidates(ta.value, ta.value.length, context, analysis),
      { observeOnly: false },
    )
    expect(decision.action).not.toBe('english_correction')
  })

  it('translation failure leaves original text untouched', async () => {
    enableTranslation()
    setPipelineTranslateFnForTests(async () => ({ ok: false, code: 'upstream' }))
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('noop')
    expect(ta.value).toBe(ARABIC_SENTENCE)
  })

  it('empty or invalid translation is never written', async () => {
    enableTranslation()
    setPipelineTranslateFnForTests(async () => ({ ok: true, translation: '   ' }))
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe(ARABIC_SENTENCE)
  })

  it('disabling Translation Mode prevents future automatic translation', async () => {
    enableTranslation()
    disableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    session.ensureTranslationSession()
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe(ARABIC_SENTENCE)
    expect(session.getTranslationSessionId()).toBeNull()
  })

  it('runLiveTranslation honors per-field pause', async () => {
    enableTranslation()
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    session.pauseTranslationOnField()
    const result = await runLiveTranslation(ta, session, {
      engine: new TranslationEngine({
        translate: async () => ({ ok: true, translation: 'NOPE' }),
      }),
      metrics: createTranslationMetrics(),
      fieldState: { lastRequestedKey: null, lastTranslatedKey: null },
    })
    expect(result).toBe('disabled')
    expect(ta.value).toBe(ARABIC_SENTENCE)
  })

  it('continues translating Arabic appended after an earlier translated segment', async () => {
    enableTranslation()
    const ARABIC_PART2 = 'والله ما نعرف'
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    allowTranslationPause(session)
    await runFieldCycle(ta, session)
    const afterFirst = ta.value
    expect(afterFirst).toBe(`EN:${ARABIC_SENTENCE}`)

    ta.value = `${afterFirst} ${ARABIC_PART2}`
    session.noteInput()
    session.enterCooldown(0)
    allowTranslationPause(session)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('applied')
    expect(ta.value).toBe(`${afterFirst} EN:${ARABIC_PART2}`)
  })
})

describe('N2 cooldown duration', () => {
  it('write gate cooldown is 450ms', () => {
    expect(WRITE_COOLDOWN_MS).toBe(450)
  })

  it('live translation pause matches Lingo (750ms)', () => {
    expect(LIVE_PAUSE_MS).toBe(750)
  })
})
