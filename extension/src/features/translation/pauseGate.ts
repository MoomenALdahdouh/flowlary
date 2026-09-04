import type { FieldSession } from '../../core/session/FieldSession.ts'

/** Lingo live translation debounce — verified from ai-writing-translator content_script.ts */
export const LIVE_PAUSE_MS = 750

export function translationPauseElapsed(session: FieldSession, now = Date.now()): boolean {
  const lastInputAt = session.getLastInputAt()
  if (lastInputAt <= 0) return false
  return now - lastInputAt >= LIVE_PAUSE_MS
}

export function shouldEmitTranslationHypothesis(
  session: FieldSession,
  liveTranslationEnabled: boolean,
  options: { bypassPause?: boolean } = {},
): boolean {
  if (!liveTranslationEnabled) return false
  if (options.bypassPause) return true
  return translationPauseElapsed(session)
}
