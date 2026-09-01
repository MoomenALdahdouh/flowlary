import type { HistoryOperation } from './history.ts'

/**
 * Product event domains — semantic boundaries.
 * Activity → flowlary.history
 * Learning → flowlary.learning.events
 * System → settings / onboarding (future optional diagnostics)
 */

/** Successful product operations recorded in flowlary.history (activity log). */
export type ActivityEventKind = HistoryOperation

/** @deprecated Use LearningEvent from learningEvents.ts */
export type LearningEventKind =
  | 'spelling_applied'
  | 'grammar_applied'
  | 'wording_applied'
  | 'correction_rejected'
  | 'practice_started'
  | 'practice_completed'

/** Extension lifecycle and settings — future optional diagnostics. */
export type SystemEventKind =
  | 'extension_enabled'
  | 'extension_disabled'
  | 'settings_changed'
  | 'onboarding_completed'

export type { LearningEvent, LearningEventAction, LearningEventCategory, LearningEventSource } from './learningEvents.ts'
