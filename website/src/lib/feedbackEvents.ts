import type { FeedbackEventName } from '@flowlary/shared'

/** Internal product feedback events — no third-party analytics. */
export function emitFeedbackEvent(_name: FeedbackEventName, _detail?: Record<string, string>): void {
  /* no-op until approved pipeline; backend stores authoritative events on submit */
}
