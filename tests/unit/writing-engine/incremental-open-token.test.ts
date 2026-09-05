import { beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  inferLayoutSpans,
  openTokenRange,
  repairKeyboardLayoutText,
} from '../../../extension/src/core/engine/index.ts'
import { mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { setAdvisorApplyMode } from '../../../extension/src/core/engine/advisor.ts'
import { setInternalEngineMode } from '../../../extension/src/core/engine/flag.ts'

const INTENDED = 'مرحبا hello are you comming or not نعم انا فادم الان'
const GARBLED_COMING = mapLayoutText('comming', 'en-US-qwerty', 'ar-101')!
const USER_TYPED =
  'مرحبا hello how are you are you ؤخةةهىل خق ىخف نعم hkh rh]l hghk'
const USER_FIXED = 'مرحبا hello how are you are you comming or not نعم انا قادم الان'

async function drainCycles(ta: HTMLTextAreaElement, session: FieldSession): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    if (session.isInCooldown()) {
      await new Promise((resolve) => setTimeout(resolve, session.getCooldownUntil() - Date.now() + 20))
    }
    const before = ta.value
    const result = await runFieldCycle(ta, session)
    if (result !== 'applied' && ta.value === before) break
  }
}

async function typeThrough(text: string): Promise<HTMLTextAreaElement> {
  const ta = document.createElement('textarea')
  document.body.append(ta)
  ta.focus()
  const session = new FieldSession(ta)
  for (const char of text) {
    ta.value += char
    ta.selectionStart = ta.selectionEnd = ta.value.length
    await runFieldCycle(ta, session)
  }
  await drainCycles(ta, session)
  return ta
}

describe('incremental open-token writing', () => {
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
    stateManager.layout.mode = 'direct'
    stateManager.correction.enabled = true
    setAdvisorApplyMode('shadow')
  })

  it('marks the token under the caret as open until a boundary', () => {
    expect(openTokenRange('comming', 7)).toEqual({ start: 0, end: 7 })
    expect(openTokenRange('comming ', 8)).toBeNull()
    expect(openTokenRange('hello comming', 13)).toEqual({ start: 6, end: 13 })
    expect(openTokenRange('hello comming', 3)).toEqual({ start: 0, end: 5 })
    expect(openTokenRange('comming', 7, undefined, { commitOpenToken: true })).toBeNull()
  })

  it('keeps the last wrong-layout word out while typing, then includes it when committed', () => {
    const typed = 'jhjd ig s,t jr,g gd'
    expect(inferLayoutSpans(typed, undefined, { caret: typed.length }).map((span) => span.replacement)).toEqual([
      'تاتي هل سوف تقول',
    ])
    expect(
      inferLayoutSpans(typed, undefined, { caret: typed.length, commitOpenToken: true }).map(
        (span) => span.replacement,
      ),
    ).toEqual(['تاتي هل سوف تقول لي'])
  })

  it('does not drop trailing layout words after junk glyphs or short bridges', () => {
    const broken =
      'مرحبا كيف حالك هل انت بخير ام لا متى سوف jhjd ig s,t jr,g gd lh§ h jtug'
    const spans = inferLayoutSpans(broken, undefined, { commitOpenToken: true })
    expect(spans).toHaveLength(1)
    expect(spans[0]?.replacement).toBe('تاتي هل سوف تقول لي ما ا تفعل')
    expect(repairKeyboardLayoutText(broken).text).toBe(
      'مرحبا كيف حالك هل انت بخير ام لا متى سوف تاتي هل سوف تقول لي ما ا تفعل',
    )
  })

  it('offers the last wrong-keyboard word after Arabic prose (idkd → هيني)', () => {
    const text = 'مرحبا كيف حالك يا حسن وين انت راح تيجي ولا لا انا قاعد بستناك idkd'
    expect(inferLayoutSpans(text, undefined, { caret: text.length })).toEqual([])
    const committed = inferLayoutSpans(text, undefined, {
      caret: text.length,
      commitOpenToken: true,
    })
    expect(committed).toHaveLength(1)
    expect(committed[0]?.replacement).toBe('هيني')
    expect(committed[0]?.risk).toBe('low')
    expect(repairKeyboardLayoutText(text).text).toBe(
      'مرحبا كيف حالك يا حسن وين انت راح تيجي ولا لا انا قاعد بستناك هيني',
    )
  })

  it('does not emit a layout span for an unfinished wrong-keyboard word', () => {
    const prefix = GARBLED_COMING.slice(0, Math.min(5, GARBLED_COMING.length))
    const live = inferLayoutSpans(prefix, undefined, { caret: prefix.length })
    expect(live).toEqual([])
  })

  it('does not rewrite https while the scheme is still being typed', () => {
    for (const prefix of ['h', 'ht', 'htt', 'http', 'https', 'https:', 'https:/']) {
      const spans = inferLayoutSpans(prefix, undefined, { caret: prefix.length })
      expect(spans.every((span) => !span.replacement.includes('اففحس'))).toBe(true)
      expect(repairKeyboardLayoutText(prefix).text.startsWith(prefix[0]!)).toBe(true)
    }
  })

  it('keeps the intended mixed sentence intact while it is typed', async () => {
    const ta = await typeThrough(`${INTENDED} `)
    expect(ta.value).toContain('مرحبا')
    expect(ta.value).toContain('hello')
    expect(ta.value).toContain('comming')
    expect(ta.value).toContain('نعم')
    expect(ta.value).toContain('فادم')
    expect(ta.value).not.toContain('ؤخةةهىل')
    expect(ta.value).not.toMatch(/\bhkh\b/)
  })

  it('does not finalize a garbled word before the space', async () => {
    const ta = await typeThrough(GARBLED_COMING)
    expect(ta.value).toBe(GARBLED_COMING)
    expect(analyzeFieldText(ta.value, { caret: ta.value.length }).openToken).not.toBeNull()
  })

  it('does not force-remap an isolated completed garbled word after Space', async () => {
    const completed = `${GARBLED_COMING} `
    expect(inferLayoutSpans(completed).some((span) => span.replacement === 'comming' && span.risk === 'low')).toBe(false)
    const ta = await typeThrough(completed)
    expect(ta.value).toContain(GARBLED_COMING)
  })

  it('repairs the reported bilingual sentence after tokens complete', async () => {
    const ta = await typeThrough(`${USER_TYPED} `)
    expect(ta.value).toContain('comming or not')
    expect(ta.value).toContain('انا قادم الان')
    expect(ta.value).toContain('مرحبا')
    expect(ta.value).toContain('hello')
    expect(ta.value).not.toContain('ؤخةةهىل')
  })

  it('does not let a later unfinished token rewrite an earlier correction', async () => {
    const ta = await typeThrough('hello hkh rh]l hghk ')
    expect(ta.value).toContain('انا قادم الان')
    const afterFix = ta.value
    ta.focus()
    const session = new FieldSession(ta)
    ta.value = `${afterFix}thanks`
    ta.selectionStart = ta.selectionEnd = ta.value.length
    await runFieldCycle(ta, session)
    expect(ta.value).toContain('انا قادم الان')
    expect(ta.value).toContain('hello')
    expect(ta.value.endsWith('thanks')).toBe(true)
  })

  it('still repairs a completed snapshot in one pass', () => {
    expect(repairKeyboardLayoutText(USER_TYPED).text).toBe(USER_FIXED)
  })
})
