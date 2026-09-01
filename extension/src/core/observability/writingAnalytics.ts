/**
 * Honest writing-path analytics (spec §17). No raw user text.
 */
import type {
  DecisionAction,
  DecisionTrigger,
  HypothesisRisk,
  LlmAdvisorResult,
  TextOrigin,
  WritingIntent,
} from '../engine/types.ts'

export type WritingAnalyticsName =
  | 'writing.decision'
  | 'writing.write'
  | 'writing.suggestion'
  | 'writing.shadow_compare'
  | 'writing.advisor_shadow'
  | 'writing.advisor_consult'
  | 'writing.review_consult'
  | 'writing.review_result'

export type WritingAnalyticsEvent = {
  name: WritingAnalyticsName
  action: DecisionAction
  trigger: DecisionTrigger | 'suggestion_accept' | 'suggestion_dismiss'
  outcome: 'applied' | 'noop' | 'shadow_only' | 'suggestion' | 'dismissed' | 'stale' | 'failed'
  textOrigin: TextOrigin
  reasonCodes: string[]
  shadowOnly: boolean
  timestamp: number
  decisionId?: string
  selectedIntent?: WritingIntent | null
  winnerHypothesisId?: string | null
  risk?: HypothesisRisk
  llmUsed?: boolean
  llmResult?: LlmAdvisorResult
  durationMs?: number
}

const MAX = 80
const events: WritingAnalyticsEvent[] = []

export function recordWritingAnalytics(
  input: Omit<WritingAnalyticsEvent, 'timestamp' | 'reasonCodes'> & { reasonCodes?: string[] },
): WritingAnalyticsEvent {
  const event: WritingAnalyticsEvent = {
    name: input.name,
    action: input.action,
    trigger: input.trigger,
    outcome: input.outcome,
    textOrigin: input.textOrigin,
    reasonCodes: input.reasonCodes ?? [],
    shadowOnly: input.shadowOnly,
    timestamp: Date.now(),
    decisionId: input.decisionId,
    selectedIntent: input.selectedIntent,
    winnerHypothesisId: input.winnerHypothesisId,
    risk: input.risk,
    llmUsed: input.llmUsed,
    llmResult: input.llmResult,
    durationMs: input.durationMs,
  }
  events.push(event)
  if (events.length > MAX) events.splice(0, events.length - MAX)
  return event
}

export function getWritingAnalyticsSnapshot(): readonly WritingAnalyticsEvent[] {
  return events.slice()
}

export function clearWritingAnalytics(): void {
  events.length = 0
}
