/**
 * Optional LLM advisor. Ranks locally generated hypotheses.
 * MUST NOT produce replacement text or write commands.
 */
import { HYPOTHESIS_ADVISOR_MAX_HYPOTHESES, HYPOTHESIS_ADVISOR_MAX_SNIPPET } from '@flowlary/shared'
import { layoutSpanConflictsWithMixedIntent } from './mixedLayoutSafety.ts'
import type {
  AdvisorVote,
  FieldContext,
  Hypothesis,
  SharedAnalysis,
  WritingIntent,
} from './types.ts'

const SENSITIVE_SKIP = new Set([
  'jwt',
  'api-key',
  'access-token',
  'private-key',
  'auth-header',
  'password',
  'env-secret',
  'credit-card',
  'hash',
])

export type AdvisorApplyMode = 'shadow' | 'apply'

export type AdvisorPacket = {
  cycleId: string
  generation: number
  policy: {
    helpStyle: FieldContext['helpStyle']
    arabicToEnglishMode: boolean
    layoutAuto: boolean
    correctionEnabled: boolean
  }
  allowedIntents: WritingIntent[]
  snippet: string
  hypotheses: Array<{
    id: string
    intent: WritingIntent
    localScore: number
    risk: Hypothesis['risk']
    needsLLM: boolean
    conflicts: string[]
    evidence: string[]
    mixUnsafe: boolean
    hasReplacement: boolean
  }>
}

export type AdvisorFn = (
  packet: AdvisorPacket,
  options?: { signal?: AbortSignal },
) => Promise<AdvisorVote>

export type ConsultAdvisorOptions = {
  text?: string
  analysis?: SharedAnalysis | null
  generation?: number
  signal?: AbortSignal
}

let advisorImpl: AdvisorFn | null = null
let applyMode: AdvisorApplyMode = 'shadow'

export function setHypothesisAdvisor(fn: AdvisorFn | null): void {
  advisorImpl = fn
}

export function getHypothesisAdvisor(): AdvisorFn | null {
  return advisorImpl
}

export function setAdvisorApplyMode(mode: AdvisorApplyMode): void {
  applyMode = mode
}

export function getAdvisorApplyMode(): AdvisorApplyMode {
  return applyMode
}

export function shouldConsultAdvisor(
  hypotheses: Hypothesis[],
  context?: FieldContext,
  analysis?: SharedAnalysis | null,
): boolean {
  if (context) {
    if (!context.safetyAllowed || context.composing) return false
    if (context.editorTier > 2) return false
    if (context.aiAdvisorEnabled === false) return false
    if (context.inputSource === 'paste' || context.inputSource === 'drop') return false
    if (context.helpStyle === 'shortcuts_only') return false
    if (!context.assistantEnabled) return false
  }
  if (hypotheses.some((item) => item.intent === 'user_override')) return false
  const strongLayout = hypotheses.some((item) => (
    item.intent === 'fix_layout'
    && item.risk === 'low'
    && !item.needsLLM
    && item.evidence.some((entry) => entry.kind === 'sequence_agreement')
  ))
  const rivalWrite = hypotheses.some((item) => (
    item.candidateAction
    && item.candidateAction !== 'layout_fix'
    && item.localScore >= 0.5
  ))
  if (strongLayout && !rivalWrite) return false
  if (analysis && packetWouldLeakSensitive(analysis)) return false
  const translateVsLayout =
    hypotheses.some((item) => item.intent === 'translate')
    && hypotheses.some((item) => item.intent === 'fix_layout')
  const mixedLayoutRisk = Boolean(
    analysis?.hasAmbiguousMixed
    && hypotheses.some((item) => item.intent === 'fix_layout'),
  )
  if (translateVsLayout || mixedLayoutRisk) return true
  if (hypotheses.length < 2) return false
  const needing = hypotheses.filter((item) => item.needsLLM)
  if (needing.length === 0) return false
  const conflicting = hypotheses.filter((item) => item.conflicts.length > 0 && item.candidateAction)
  return conflicting.length >= 2 || needing.length >= 2
}

function packetWouldLeakSensitive(analysis: SharedAnalysis): boolean {
  return analysis.chunks.some((chunk) => chunk.protectedKind != null && SENSITIVE_SKIP.has(chunk.protectedKind))
}

export function maskAdvisorSnippet(text: string, hypotheses: Hypothesis[], analysis?: SharedAnalysis | null): string {
  if (!text) return ''
  const spans = hypotheses.filter((item) => item.needsLLM || item.conflicts.length > 0)
  const start = Math.max(0, Math.min(...spans.map((item) => item.span.start), text.length) - 24)
  const end = Math.min(text.length, Math.max(...spans.map((item) => item.span.end), 0) + 24)
  let slice = text.slice(start, end)
  if (analysis) {
    for (const chunk of analysis.chunks) {
      if (!chunk.protectedKind || !SENSITIVE_SKIP.has(chunk.protectedKind)) continue
      const token = text.slice(chunk.range.start, chunk.range.end)
      if (token) slice = slice.split(token).join('[protected]')
    }
  }
  if (slice.length > HYPOTHESIS_ADVISOR_MAX_SNIPPET) {
    slice = slice.slice(0, HYPOTHESIS_ADVISOR_MAX_SNIPPET)
  }
  return slice
}

export function buildAdvisorPacket(
  context: FieldContext,
  hypotheses: Hypothesis[],
  options: ConsultAdvisorOptions = {},
): AdvisorPacket {
  const limited = hypotheses.slice(0, HYPOTHESIS_ADVISOR_MAX_HYPOTHESES)
  const text = options.text ?? ''
  const analysis = options.analysis ?? null
  return {
    cycleId: context.cycleId,
    generation: options.generation ?? context.generation,
    policy: {
      helpStyle: context.helpStyle,
      arabicToEnglishMode: context.arabicToEnglishMode,
      layoutAuto: context.layoutAuto,
      correctionEnabled: context.correctionEnabled,
    },
    allowedIntents: [
      'write_as_is',
      'fix_layout',
      'fix_english',
      'translate',
      'preserve',
      'unknown',
      'user_override',
    ],
    snippet: maskAdvisorSnippet(text, limited, analysis),
    hypotheses: limited.map((item) => ({
      id: item.id,
      intent: item.intent,
      localScore: item.localScore,
      risk: item.risk,
      needsLLM: item.needsLLM,
      conflicts: item.conflicts,
      evidence: item.evidence.map((entry) => entry.kind),
      mixUnsafe: Boolean(
        analysis && item.intent === 'fix_layout' && layoutSpanConflictsWithMixedIntent(item.span, analysis.chunks),
      ),
      hasReplacement: Boolean(item.replacement),
    })),
  }
}

export function validateAdvisorVote(
  vote: unknown,
  hypotheses: Hypothesis[],
): { ok: true; vote: AdvisorVote } | { ok: false; reason: 'malformed' | 'unknown_id' } {
  if (!vote || typeof vote !== 'object') return { ok: false, reason: 'malformed' }
  const value = vote as Partial<AdvisorVote>
  if (!Array.isArray(value.rankedHypothesisIds) || value.rankedHypothesisIds.length === 0) {
    return { ok: false, reason: 'malformed' }
  }
  if (typeof value.reasonCode !== 'string' || typeof value.ambiguityClass !== 'string') {
    return { ok: false, reason: 'malformed' }
  }
  const known = new Set(hypotheses.map((item) => item.id))
  if (value.rankedHypothesisIds.some((id) => typeof id !== 'string' || !known.has(id))) {
    return { ok: false, reason: 'unknown_id' }
  }
  if ('replacement' in value || 'text' in value || 'write' in value) {
    return { ok: false, reason: 'malformed' }
  }
  return {
    ok: true,
    vote: {
      rankedHypothesisIds: value.rankedHypothesisIds,
      reasonCode: value.reasonCode,
      ambiguityClass: value.ambiguityClass,
    },
  }
}

export async function consultAdvisor(
  context: FieldContext,
  hypotheses: Hypothesis[],
  options: ConsultAdvisorOptions = {},
): Promise<{ vote: AdvisorVote | null; result: 'ranked' | 'invalid' | 'unavailable' | 'abstain' | 'unused' | 'stale' }> {
  if (!shouldConsultAdvisor(hypotheses, context, options.analysis)) {
    return { vote: null, result: 'unused' }
  }
  const fn = getHypothesisAdvisor()
  if (!fn) return { vote: null, result: 'unavailable' }
  if (options.generation !== undefined && options.generation !== context.generation) {
    return { vote: null, result: 'stale' }
  }
  try {
    const raw = await fn(buildAdvisorPacket(context, hypotheses, options), {
      signal: options.signal,
    })
    const checked = validateAdvisorVote(raw, hypotheses)
    if (!checked.ok) return { vote: null, result: 'invalid' }
    return { vote: checked.vote, result: 'ranked' }
  } catch {
    return { vote: null, result: 'unavailable' }
  }
}
