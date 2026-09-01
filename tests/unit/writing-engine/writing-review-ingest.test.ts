/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { analyzeFieldText, buildFieldContext, collectHypotheses } from '../../../extension/src/core/engine/index.ts'
import { ingestReviewEdits, pickReviewEdit } from '../../../extension/src/core/engine/ingestReviewEdits.ts'
import { extractReviewIsland } from '../../../extension/src/core/engine/reviewIsland.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import type { WritingReviewEdit } from '@flowlary/shared'

function contextFor(text: string) {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: false,
  })
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'review',
    composing: false,
    textLength: text.length,
  })
  const analysis = analyzeFieldText(text, { caret: text.length, commitOpenToken: true })
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  return { ta, session, context, analysis, hypotheses }
}

describe('writing review ingest', () => {
  it('turns a high-confidence English spelling edit into an auto-eligible hypothesis', () => {
    const text = 'hello comming tomorrow. '
    const { context, analysis, hypotheses } = contextFor(text)
    const island = extractReviewIsland(text, text.length, analysis)!
    const start = island.snippet.indexOf('comming')
    const extra = ingestReviewEdits([{
      start,
      end: start + 7,
      original: 'comming',
      proposed: 'coming',
      kind: 'spelling',
      confidence: 'high',
    }], island, analysis, context, hypotheses)
    expect(extra).toHaveLength(1)
    expect(extra[0]?.replacement).toBe('coming')
    expect(extra[0]?.risk).toBe('low')
    expect(extra[0]?.intent).toBe('fix_english')
  })

  it('drops layout_suspect that does not match mapLayout', () => {
    const text = 'Please deploy the API. '
    const { context, analysis, hypotheses } = contextFor(text)
    const island = extractReviewIsland(text, text.length, analysis)!
    expect(ingestReviewEdits([{
      start: 0,
      end: 7,
      original: island.snippet.slice(0, 7),
      proposed: 'zzzzzzz',
      kind: 'layout_suspect',
      confidence: 'high',
    }], island, analysis, context, hypotheses)).toEqual([])
  })

  it('picks spelling over grammar and keeps one edit', () => {
    const edits: WritingReviewEdit[] = [
      {
        start: 10, end: 18, original: 'tomorrow', proposed: 'tommorrow', kind: 'grammar', confidence: 'high',
      },
      {
        start: 0, end: 7, original: 'comming', proposed: 'coming', kind: 'spelling', confidence: 'high',
      },
    ]
    expect(pickReviewEdit(edits)?.kind).toBe('spelling')
  })

  it('drops an unfinished open token and a user override span', () => {
    const openText = 'hello comming'
    const open = contextFor(openText)
    const island = extractReviewIsland(openText, openText.length, open.analysis)
    if (island && open.analysis.openToken) {
      const start = island.snippet.indexOf('comming')
      expect(ingestReviewEdits([{
        start,
        end: start + 7,
        original: 'comming',
        proposed: 'coming',
        kind: 'spelling',
        confidence: 'high',
      }], island, open.analysis, open.context, open.hypotheses)).toEqual([])
    }
    const text = 'hello comming tomorrow. '
    const prepared = contextFor(text)
    prepared.session.noteUserOverride(6, 13)
    const analysis2 = analyzeFieldText(text, {
      caret: text.length,
      commitOpenToken: true,
      overrideRanges: [...prepared.session.getOverrideRanges()],
    })
    const hyps2 = collectHypotheses(text, text.length, prepared.context, analysis2)
    const island2 = extractReviewIsland(text, text.length, analysis2)!
    const start = island2.snippet.indexOf('comming')
    expect(ingestReviewEdits([{
      start,
      end: start + 7,
      original: 'comming',
      proposed: 'coming',
      kind: 'spelling',
      confidence: 'high',
    }], island2, analysis2, prepared.context, hyps2)).toEqual([])
  })
})
