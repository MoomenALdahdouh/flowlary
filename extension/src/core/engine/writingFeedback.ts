/**
 * Extension point for future daily learning.
 * Stores action / outcome metadata and hashed tokens only — never raw field text.
 */
export type WritingOutcomeKind =
  | 'accept'
  | 'dismiss'
  | 'undo'
  | 'manual_correction'
  | 'override'
  | 'layout_applied'
  | 'translation_edit'

export type WritingFeedbackEvent = {
  tokenHash: string
  action: string
  outcome: WritingOutcomeKind
  at: number
}

const RING_MAX = 200
const events: WritingFeedbackEvent[] = []

export function recordWritingFeedback(event: Omit<WritingFeedbackEvent, 'at'> & { at?: number }): void {
  events.push({ ...event, at: event.at ?? Date.now() })
  if (events.length > RING_MAX) events.splice(0, events.length - RING_MAX)
}

export function getWritingFeedbackSnapshot(): readonly WritingFeedbackEvent[] {
  return events.slice()
}

export function clearWritingFeedbackForTests(): void {
  events.length = 0
}
