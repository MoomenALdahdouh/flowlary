/**
 * Local Decision Engine inspect helper for model-selection eval.
 * Evaluation-only.
 */
import { FieldSession } from '../../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildAdvisorPacket,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  extractReviewIsland,
  ingestReviewEdits,
  shouldConsultAdvisor,
  validateAdvisorVote,
} from '../../../../extension/src/core/engine/index.ts'
import type { AdvisorVote, Hypothesis, WritingDecision } from '../../../../extension/src/core/engine/types.ts'
import type { WritingReviewEdit } from '@flowlary/shared'
import type { LocalAiCase } from './dataset.ts'

export type InspectResult = {
  context: ReturnType<typeof buildFieldContext>
  analysis: ReturnType<typeof analyzeFieldText>
  hypotheses: Hypothesis[]
  candidates: ReturnType<typeof candidatesFromHypotheses>
  baseline: WritingDecision
  consult: boolean
  packet: ReturnType<typeof buildAdvisorPacket> | null
  island: ReturnType<typeof extractReviewIsland>
  ms: number
}

export function configurePolicy(): void {
  stateManager.settings.assistantEnabled = true
  stateManager.settings.helpStyle = 'auto'
  stateManager.settings.layoutAuto = true
  stateManager.settings.correctionEnabled = true
  stateManager.settings.arabicToEnglishMode = false
  stateManager.settings.aiAdvisorEnabled = true
  stateManager.settings.aiWritingReviewEnabled = true
}

export function inspectLocal(text: string, inputSource: 'typing' | 'paste' = 'typing'): InspectResult {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: `lai-${Math.random().toString(36).slice(2, 10)}`,
    composing: false,
    textLength: text.length,
    inputSource,
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
  const consult = shouldConsultAdvisor(hypotheses, context, analysis)
  const packet = consult || hypotheses.length > 0
    ? buildAdvisorPacket(context, hypotheses, { text, analysis })
    : null
  const island = extractReviewIsland(text, text.length, analysis)
  document.body.innerHTML = ''
  return { context, analysis, hypotheses, candidates, baseline, consult, packet, island, ms }
}

export function localIntervened(action: string): boolean {
  return action === 'layout_fix' || action === 'english_correction' || action === 'translation'
}

export function isHarmful(item: LocalAiCase, action: string): boolean {
  if (!item.mustPreserve && !item.protectedContent) return false
  return localIntervened(action)
}

export function isUseful(item: LocalAiCase, action: string): boolean {
  if (!item.shouldIntervene) return false
  if (item.goldAction === 'layout_fix') return action === 'layout_fix'
  if (item.goldAction === 'english_correction') {
    return action === 'english_correction' || action === 'suggestion'
  }
  return false
}

export function redecideWithVote(inspect: InspectResult, vote: AdvisorVote | null): WritingDecision {
  return decideWriting(inspect.context, inspect.analysis, inspect.candidates, {
    observeOnly: false,
    hypotheses: inspect.hypotheses,
    advisorVote: vote,
    advisorResult: vote ? 'ranked' : 'invalid',
  })
}

export function redecideWithReviewEdits(inspect: InspectResult, edits: WritingReviewEdit[]): WritingDecision {
  if (!inspect.island) {
    return inspect.baseline
  }
  const extra = ingestReviewEdits(
    edits,
    inspect.island,
    inspect.analysis,
    inspect.context,
    inspect.hypotheses,
  )
  const hypotheses = [...inspect.hypotheses, ...extra]
  const candidates = candidatesFromHypotheses(hypotheses, inspect.context)
  return decideWriting(inspect.context, inspect.analysis, candidates, {
    observeOnly: false,
    hypotheses,
    advisorResult: extra.length ? 'ranked' : 'unused',
  })
}

export function parseRankerVote(parsed: unknown, hypotheses: Hypothesis[]): AdvisorVote | null {
  const checked = validateAdvisorVote(parsed, hypotheses)
  return checked.ok ? checked.vote : null
}

export function detectorToReviewEdits(parsed: unknown, snippet: string): {
  edits: WritingReviewEdit[]
  verdict: string
  schemaValid: boolean
  spanOk: boolean
} {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { edits: [], verdict: 'invalid', schemaValid: false, spanOk: false }
  }
  const value = parsed as Record<string, unknown>
  const verdict = typeof value.verdict === 'string' ? value.verdict : 'invalid'
  const issues = Array.isArray(value.issues) ? value.issues : []
  if (!['preserve', 'issue', 'uncertain'].includes(verdict)) {
    return { edits: [], verdict, schemaValid: false, spanOk: false }
  }
  const edits: WritingReviewEdit[] = []
  let spanOk = true
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') {
      spanOk = false
      continue
    }
    const row = issue as Record<string, unknown>
    const start = row.start
    const end = row.end
    const original = row.original
    const proposed = row.proposed
    const kind = row.kind
    const confidence = row.confidence
    if (typeof start !== 'number' || typeof end !== 'number' || typeof original !== 'string' || typeof proposed !== 'string') {
      spanOk = false
      continue
    }
    if (original !== snippet.slice(start, end)) {
      spanOk = false
      continue
    }
    const mappedKind =
      kind === 'layout' ? 'layout_suspect'
        : kind === 'spelling' || kind === 'grammar' || kind === 'punctuation' ? kind
          : 'wording'
    const mappedConf = typeof confidence === 'number' && confidence >= 0.8 ? 'high' : typeof confidence === 'number' && confidence >= 0.5 ? 'medium' : 'low'
    if (proposed && proposed !== original && mappedKind !== 'wording') {
      edits.push({
        start,
        end,
        original,
        proposed,
        kind: mappedKind,
        confidence: mappedConf,
      })
    }
  }
  return { edits, verdict, schemaValid: true, spanOk }
}
