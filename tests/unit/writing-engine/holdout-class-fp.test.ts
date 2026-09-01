import { describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  decideWriting,
} from '../../../extension/src/core/engine/index.ts'
import { collectHypotheses } from '../../../extension/src/core/engine/hypotheses.ts'
import { collectShadowCandidates } from '../../../extension/src/core/engine/candidates.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'

/**
 * Class-level holdout: false-positive auto layout on intentional mixed bilingual text.
 * Score the class, not a single demo sentence.
 */
const MIXED_PRESERVE = [
  'أنا عملت deploy لكن فيه error',
  'أرسل لي الـ API key اليوم.',
  'check the ملف PDF tomorrow',
  'ok شكرا see you',
  'token JWT stays as-is هنا',
]

function decide(text: string) {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: false,
  })
  const ta = document.createElement('textarea')
  ta.value = `${text} `
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'holdout',
    composing: false,
    textLength: ta.value.length,
  })
  const analysis = analyzeFieldText(ta.value, { caret: ta.value.length })
  const hypotheses = collectHypotheses(ta.value, ta.value.length, context, analysis)
  const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
  return decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
}

describe('holdout class false-positive rate', () => {
  it('does not auto-remap intentional mixed bilingual fields', () => {
    const falsePositives = MIXED_PRESERVE.filter((sample) => decide(sample).action === 'layout_fix')
    expect(falsePositives, `layout remapped: ${falsePositives.join(' | ')}`).toEqual([])
  })

  it('keeps layout islands local: Arabic-keyboard English remaps without sending the mixed field', () => {
    const typed = 'ؤخةةهىل خق ىخف '
    const decision = decide(typed.trim())
    expect(decision.action === 'layout_fix' || decision.action === 'suggestion' || decision.action === 'noop').toBe(true)
  })
})
