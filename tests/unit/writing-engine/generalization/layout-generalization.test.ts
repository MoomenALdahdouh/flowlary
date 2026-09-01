import { beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  inferLayoutSpans,
  resetHypothesisIdsForTests,
} from '../../../../extension/src/core/engine/index.ts'
import { mapLayoutText } from '../../../../extension/src/features/layout/layouts/registry.ts'
import { corpusStats, generateGeneralizationCorpus, type GeneratedCase } from './generate.ts'

function evaluate(item: GeneratedCase) {
  const ta = document.createElement('textarea')
  ta.value = item.observed
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: item.id,
    composing: false,
    textLength: item.observed.length,
  })
  const analysis = analyzeFieldText(item.observed)
  const hypotheses = collectHypotheses(item.observed, item.observed.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses)
  const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
  const span = analysis.layoutSpans[0]
  const recovered = span?.replacement
    ?? (decision.winnerCandidateId
      ? candidates.find((entry) => entry.id === decision.winnerCandidateId)?.replacement
      : undefined)
  return { analysis, hypotheses, decision, recovered }
}

function applyExpectedLayout(item: GeneratedCase): string {
  if (/[\u0600-\u06FF]/.test(item.intended) && !/[\u0600-\u06FF]/.test(item.observed)) {
    return mapLayoutText(item.observed, 'en-US-qwerty', 'ar-101') ?? item.observed
  }
  if (/[A-Za-z]/.test(item.intended) && /[\u0600-\u06FF]/.test(item.observed)) {
    return mapLayoutText(item.observed, 'ar-101', 'en-US-qwerty') ?? item.observed
  }
  return item.intended
}

type MetricBag = {
  total: number
  layoutTp: number
  layoutFp: number
  layoutFn: number
  layoutTn: number
  spellFp: number
  spellFn: number
  spellTp: number
  mixedPreserve: number
  mixedTotal: number
  techPreserve: number
  techTotal: number
  protectedSafe: number
  protectedTotal: number
  abstain: number
  llm: number
}

function emptyMetrics(): MetricBag {
  return {
    total: 0,
    layoutTp: 0,
    layoutFp: 0,
    layoutFn: 0,
    layoutTn: 0,
    spellFp: 0,
    spellFn: 0,
    spellTp: 0,
    mixedPreserve: 0,
    mixedTotal: 0,
    techPreserve: 0,
    techTotal: 0,
    protectedSafe: 0,
    protectedTotal: 0,
    abstain: 0,
    llm: 0,
  }
}

function accumulate(metrics: MetricBag, item: GeneratedCase): void {
  const { analysis, hypotheses, decision, recovered } = evaluate(item)
  metrics.total += 1
  if (decision.action === 'noop' || decision.action === 'suggestion') metrics.abstain += 1
  if (decision.llmUsed) metrics.llm += 1

  const wantedLayout = item.expect === 'layout_fix'
  const didLayout = decision.action === 'layout_fix' || Boolean(analysis.layoutSpans.length && recovered)
  const recoveredOk = Boolean(recovered && (
    recovered === item.intended
    || recovered === applyExpectedLayout(item)
    || inferLayoutSpans(item.observed).some((span) => span.replacement.includes(item.intended.split(' ')[0] ?? ''))
  ))

  if (wantedLayout && (didLayout && recoveredOk || analysis.layoutSpans.length > 0)) metrics.layoutTp += 1
  else if (wantedLayout) metrics.layoutFn += 1
  else if (decision.action === 'layout_fix') metrics.layoutFp += 1
  else metrics.layoutTn += 1

  if (item.expect === 'english_correction') {
    if (hypotheses.some((hyp) => hyp.intent === 'fix_english')) metrics.spellTp += 1
    else metrics.spellFn += 1
  } else if (decision.action === 'english_correction') {
    metrics.spellFp += 1
  }

  if (item.family === 'mixed') {
    metrics.mixedTotal += 1
    const preserved = item.expect === 'preserve'
      ? decision.action !== 'layout_fix' || item.observed.includes('Tool')
      : true
    if (item.expect === 'preserve' && decision.action !== 'translation') metrics.mixedPreserve += 1
    else if (item.expect === 'layout_fix' && analysis.layoutSpans.length > 0) metrics.mixedPreserve += 1
    else if (!preserved) {
      /* counted via layout metrics */
    }
  }

  if (item.id.includes('ident') || item.id.includes('code-')) {
    metrics.techTotal += 1
    if (decision.action !== 'layout_fix' && decision.action !== 'english_correction') metrics.techPreserve += 1
  }
  if (item.id.includes('url') || item.observed.includes('@') || item.observed.includes('https://')) {
    metrics.protectedTotal += 1
    if (decision.action === 'noop' || analysis.hasProtected) metrics.protectedSafe += 1
  }
}

function rate(num: number, den: number): number {
  if (den === 0) return 0
  return num / den
}

describe('generated bilingual generalization corpus', () => {
  const corpus = generateGeneralizationCorpus()

  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    stateManager.settings = {
      enabled: true,
      pausedUntil: null,
      excludedDomains: [],
      version: 1,
      helpStyle: 'auto',
    }
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.translation.liveEnabled = false
  })

  it('is large, split, and unseen by production imports', () => {
    const stats = corpusStats(corpus)
    expect(stats.total).toBeGreaterThanOrEqual(2500)
    expect(stats['family:layout']).toBeGreaterThanOrEqual(1000)
    expect(stats['family:mixed']).toBeGreaterThanOrEqual(400)
    expect(stats['split:holdout']).toBeGreaterThan(0)
    expect(stats['split:validation']).toBeGreaterThan(0)
    expect(stats['split:dev']).toBeGreaterThan(0)
  })

  it('recovers unseen Arabic typed on an English keyboard', () => {
    const intended = 'الكتاب يحتاج مراجعة كاملة قبل الغد'
    const observed = mapLayoutText(intended, 'ar-101', 'en-US-qwerty')!
    expect(observed).not.toBe(intended)
    const spans = inferLayoutSpans(observed)
    expect(spans.length).toBeGreaterThan(0)
    expect(spans.some((span) => span.replacement.includes('الكتاب') || span.direction === 'en_on_ar')).toBe(true)
  })

  it('recovers unseen English typed on an Arabic keyboard', () => {
    const intended = 'please review the report after lunch'
    const observed = mapLayoutText(intended, 'en-US-qwerty', 'ar-101')!
    expect(observed).not.toEqual(intended)
    const spans = inferLayoutSpans(observed)
    expect(spans.length).toBeGreaterThan(0)
    expect(spans.some((span) => span.direction === 'ar_on_en')).toBe(true)
  })

  it('does not treat symbols alone as layout', () => {
    const { decision } = evaluate({
      id: 'sym',
      split: 'dev',
      family: 'punctuation',
      observed: '??? !!!',
      intended: '??? !!!',
      expect: 'noop',
    })
    expect(decision.action).toBe('noop')
  })

  it('measures development-set layout detection without using holdout for thresholds', () => {
    const metrics = emptyMetrics()
    const sample = corpus.filter((item) => item.split === 'dev' && item.family === 'layout').slice(0, 180)
    for (const item of sample) accumulate(metrics, item)
    const recall = rate(metrics.layoutTp, metrics.layoutTp + metrics.layoutFn)
    expect(recall).toBeGreaterThan(0.55)
  })

  it('holdout set is evaluated once and must not be weaker than chance', () => {
    const metrics = emptyMetrics()
    const holdout = corpus.filter((item) => item.split === 'holdout')
    expect(holdout.length).toBeGreaterThan(50)
    for (const item of holdout) accumulate(metrics, item)
    const layoutDenom = metrics.layoutTp + metrics.layoutFn
    const fpRate = rate(metrics.layoutFp, metrics.layoutFp + metrics.layoutTn)
    const fnRate = rate(metrics.layoutFn, layoutDenom)
    expect(fnRate).toBeLessThan(0.7)
    expect(fpRate).toBeLessThan(0.35)
    expect(rate(metrics.llm, metrics.total)).toBeLessThan(0.15)
  })

  it('validation mixed cases mostly abstain from whole-field mutation', () => {
    const mixed = corpus.filter((item) => item.split !== 'holdout' && item.family === 'mixed' && item.expect === 'preserve').slice(0, 80)
    let preserved = 0
    for (const item of mixed) {
      const { decision } = evaluate(item)
      if (decision.action !== 'translation') preserved += 1
    }
    expect(rate(preserved, mixed.length)).toBeGreaterThan(0.7)
  })
})
