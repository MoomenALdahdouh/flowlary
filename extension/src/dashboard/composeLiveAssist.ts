import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import {
  debounceOptionsForMode,
  endsWithSentenceBoundary,
  endsWithWordBoundary,
  getDebounceDelay,
} from '../features/correction/debounce.ts'
import { isEligibleForCorrection } from '../features/correction/language.ts'
import { isAssistCooldownActive } from '../features/correction/assistCooldown.ts'

/** Extra idle before composing AI on a mid-word draft (`yuo|`). */
export const COMPOSE_MID_WORD_IDLE_MS = 1200

export function composeCorrectionDelayMs(text: string): number {
  const live = debounceOptionsForMode('direct')
  if (!endsWithWordBoundary(text) && !endsWithSentenceBoundary(text)) {
    return Math.max(live.defaultMs ?? COMPOSE_MID_WORD_IDLE_MS, COMPOSE_MID_WORD_IDLE_MS)
  }
  return getDebounceDelay(text, live)
}

export function shouldScheduleComposeCorrection(
  text: string,
  lastSentText: string,
  now = Date.now(),
): boolean {
  if (isAssistCooldownActive(now)) return false
  if (!isEligibleForCorrection(text)) return false
  const trimmed = text.trim()
  if (!trimmed || trimmed === lastSentText) return false
  return true
}

export function composeCorrectionWaitMs(text: string, lastSentAt: number, now = Date.now()): number {
  const remaining = Math.max(0, CORRECTION_DEFAULTS.LIVE_CORRECTION_MIN_INTERVAL_MS - (now - lastSentAt))
  return composeCorrectionDelayMs(text) + remaining
}

export function composeTranslationDelayMs(mode: 'box' | 'direct'): number {
  return mode === 'direct' ? 900 : 1100
}
