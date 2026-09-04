import { describe, expect, it } from 'vitest'
import { candidatesFromHypotheses } from '../../../extension/src/core/engine/candidates.ts'
import type { FieldContext, Hypothesis } from '../../../extension/src/core/engine/types.ts'

function translationHypothesis(): Hypothesis {
  return {
    id: 'h-tr-1',
    span: { start: 0, end: 20 },
    intent: 'translate',
    candidateAction: 'translation',
    replacementSource: 'none',
    localScore: 0.85,
    evidence: [{ kind: 'sentence_stable' }],
    risk: 'low',
    needsLLM: false,
    sourceChunkIds: ['c1'],
    conflicts: [],
  }
}

function richEditorContext(): FieldContext {
  return {
    fieldId: 'f1',
    generation: 1,
    cycleId: 'c1',
    editorTier: 2,
    capabilities: {
      autoWrite: false,
      suggestion: true,
      manualShortcut: true,
    },
    safetyAllowed: true,
    composing: false,
    mutexHeld: false,
    translationSessionId: 'ts-1',
    hostname: 'gemini.google.com',
    fieldKind: 'contenteditable',
    helpStyle: 'auto',
    assistantEnabled: true,
    layoutAuto: false,
    correctionEnabled: false,
    aiAdvisorEnabled: true,
    aiWritingReviewEnabled: true,
    liveTranslation: true,
    arabicToEnglishMode: true,
    translationPauseReady: true,
    translatedRanges: [],
    polishAfterTranslate: false,
    liveWholeFieldCorrection: false,
    cooldownActive: false,
    textLength: 20,
    inputSource: 'typing',
    selection: null,
  }
}

describe('translation candidates on rich editors', () => {
  it('keeps translation eligible on tier-2 contenteditable without autoWrite', () => {
    const [candidate] = candidatesFromHypotheses([translationHypothesis()], richEditorContext())
    expect(candidate?.capability).toBe('translation')
    expect(candidate?.eligibleForAuto).toBe(true)
  })

  it('still blocks layout auto on rich editors', () => {
    const layoutHypothesis: Hypothesis = {
      ...translationHypothesis(),
      id: 'h-layout-1',
      intent: 'fix_layout',
      candidateAction: 'layout_fix',
      replacement: 'hello',
    }
    const [candidate] = candidatesFromHypotheses([layoutHypothesis], richEditorContext())
    expect(candidate?.eligibleForAuto).toBe(false)
  })
})
