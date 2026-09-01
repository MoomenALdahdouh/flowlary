/**
 * Isolated architecture-audit baseline. Not imported by production.
 * Measures local Decision Engine + consult rate on a new unseen corpus.
 * Does not call Groq / Gemini / OpenRouter.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildAdvisorPacket,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  resetHypothesisIdsForTests,
  setHypothesisAdvisor,
  shouldConsultAdvisor,
} from '../../../extension/src/core/engine/index.ts'
import type { Hypothesis } from '../../../extension/src/core/engine/types.ts'
import {
  generateArchitectureCorpus,
  type ArchCase,
  type ArchGold,
} from './generate.ts'

export const ARCH_BASELINE_METRICS: Record<string, unknown> = {}

function inspect(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: `arch-${Math.random().toString(36).slice(2, 10)}`,
    composing: false,
    textLength: text.length,
  })
  const started = performance.now()
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const ms = performance.now() - started
  const candidates = candidatesFromHypotheses(hypotheses, context)
  const baseline = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
    advisorResult: 'unused',
  })
  document.body.innerHTML = ''
  return { context, analysis, hypotheses, candidates, baseline, ms }
}

function goldHypExists(gold: ArchGold, hyps: Hypothesis[]): boolean {
  if (gold === 'layout_fix') return hyps.some((item) => item.intent === 'fix_layout')
  if (gold === 'fix_english') return hyps.some((item) => item.intent === 'fix_english')
  return hyps.some((item) => item.intent === 'preserve' || item.intent === 'write_as_is' || item.intent === 'unknown')
}

function actionOk(gold: ArchGold, action: string): boolean {
  if (gold === 'layout_fix') return action === 'layout_fix'
  if (gold === 'fix_english') return action === 'english_correction' || action === 'suggestion' || action === 'noop'
  return action === 'noop' || action === 'suggestion'
}

function summarize(cases: ArchCase[]) {
  let ok = 0
  let layoutGold = 0
  let layoutHit = 0
  let layoutFp = 0
  let layoutFn = 0
  let mixLayoutFp = 0
  let consult = 0
  let hypExist = 0
  let protectedLayout = 0
  let msSum = 0
  const byFamily: Record<string, { n: number; ok: number; consult: number }> = {}

  for (const item of cases) {
    const result = inspect(item.input)
    msSum += result.ms
    if (goldHypExists(item.gold, result.hypotheses)) hypExist += 1
    const consultNow = shouldConsultAdvisor(result.hypotheses, result.context, result.analysis)
    if (consultNow) consult += 1
    const action = result.baseline.action
    const good = actionOk(item.gold, action)
    if (good) ok += 1
    if (item.gold === 'layout_fix') {
      layoutGold += 1
      if (action === 'layout_fix') layoutHit += 1
      else layoutFn += 1
    } else if (action === 'layout_fix') {
      layoutFp += 1
      if (item.family === 'mixed' || item.family === 'contextual' || item.family === 'technical') mixLayoutFp += 1
    }
    if (result.hypotheses.some((hyp) => (
      hyp.intent === 'fix_layout'
      && hyp.sourceChunkIds.some((id) => result.analysis.chunks.find((chunk) => chunk.id === id)?.protectedKind)
    ))) {
      protectedLayout += 1
    }
    const bucket = byFamily[item.family] ?? { n: 0, ok: 0, consult: 0 }
    bucket.n += 1
    if (good) bucket.ok += 1
    if (consultNow) bucket.consult += 1
    byFamily[item.family] = bucket
    const packet = consultNow ? buildAdvisorPacket(result.context, result.hypotheses, {
      text: item.input,
      analysis: result.analysis,
    }) : null
    if (packet) {
      expect(packet.snippet.length).toBeLessThanOrEqual(160)
      expect(packet.hypotheses.every((hyp) => !('replacement' in hyp) && !('text' in hyp) && !('write' in hyp))).toBe(true)
    }
  }

  const n = cases.length
  return {
    n,
    actionAccuracy: ok / n,
    hypExistence: hypExist / n,
    consultRate: consult / n,
    layoutRecall: layoutGold ? layoutHit / layoutGold : 0,
    layoutFp,
    layoutFn,
    mixLayoutFp,
    protectedLayout,
    meanMs: msSum / n,
    byFamily,
  }
}

describe('architecture audit local baseline (isolated)', () => {
  beforeEach(() => {
    resetHypothesisIdsForTests()
    setHypothesisAdvisor(null)
    stateManager.settings.assistantEnabled = true
    stateManager.settings.helpStyle = 'auto'
    stateManager.settings.layoutAuto = true
    stateManager.settings.correctionEnabled = true
    stateManager.settings.arabicToEnglishMode = false
  })
  afterEach(() => {
    document.body.innerHTML = ''
    setHypothesisAdvisor(null)
  })

  it('scores the unseen 4500+ corpus and writes metrics JSON', () => {
    const all = generateArchitectureCorpus()
    const counts = all.reduce<Record<string, number>>((acc, item) => {
      acc[item.family] = (acc[item.family] ?? 0) + 1
      return acc
    }, {})
    expect(all.length).toBeGreaterThanOrEqual(4500)
    expect(counts.layout).toBe(1000)
    expect(counts.spelling_layout).toBe(750)
    expect(counts.mixed).toBe(750)
    expect(counts.technical).toBe(500)
    expect(counts.short).toBe(500)
    expect(counts.punctuation).toBe(500)
    expect(counts.contextual).toBe(500)

    const holdout = all.filter((item) => item.split === 'holdout')
    const metrics = {
      total: all.length,
      counts,
      all: summarize(all),
      holdout: summarize(holdout),
    }
    Object.assign(ARCH_BASELINE_METRICS, metrics)
    writeFileSync(
      resolve(import.meta.dirname, 'local-baseline-results.json'),
      `${JSON.stringify(metrics, null, 2)}\n`,
    )
    expect(metrics.all.meanMs).toBeLessThan(20)
    expect(metrics.all.protectedLayout).toBe(0)
  })
})
