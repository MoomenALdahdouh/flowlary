import { afterEach, describe, expect, it, vi } from 'vitest'
import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import {
  COMPOSE_MID_WORD_IDLE_MS,
  composeCorrectionDelayMs,
  composeCorrectionWaitMs,
  shouldScheduleComposeCorrection,
} from '../../../extension/src/dashboard/composeLiveAssist.ts'
import {
  clearAssistCooldownForTests,
  noteAssistRateLimited,
} from '../../../extension/src/features/correction/assistCooldown.ts'

describe('composeLiveAssist', () => {
  afterEach(() => {
    clearAssistCooldownForTests()
    vi.useRealTimers()
  })

  it('waits longer on mid-word drafts than on a finished word', () => {
    expect(composeCorrectionDelayMs('hell hwo are yuo')).toBe(COMPOSE_MID_WORD_IDLE_MS)
    expect(composeCorrectionDelayMs('hell hwo are ')).toBe(
      CORRECTION_DEFAULTS.LIVE_DIRECT_WORD_BOUNDARY_DEBOUNCE_MS,
    )
  })

  it('does not schedule tiny in-progress typing', () => {
    expect(shouldScheduleComposeCorrection('he', '', 10_000)).toBe(false)
    expect(shouldScheduleComposeCorrection('hell', '', 10_000)).toBe(false)
  })

  it('schedules a real English draft after the min interval', () => {
    expect(shouldScheduleComposeCorrection('hell hwo are yuo', '', 10_000)).toBe(true)
  })

  it('skips repeats and cooldown, and waits out the live interval', () => {
    const text = 'hell hwo are yuo'
    expect(shouldScheduleComposeCorrection(text, text, 10_000)).toBe(false)

    vi.useFakeTimers()
    vi.setSystemTime(20_000)
    noteAssistRateLimited()
    expect(shouldScheduleComposeCorrection(text, '', 20_000)).toBe(false)
  })

  it('adds the remaining live interval onto debounce', () => {
    expect(composeCorrectionWaitMs('hell hwo are ', 9_000, 9_500)).toBe(
      CORRECTION_DEFAULTS.LIVE_DIRECT_WORD_BOUNDARY_DEBOUNCE_MS +
        (CORRECTION_DEFAULTS.LIVE_CORRECTION_MIN_INTERVAL_MS - 500),
    )
  })
})
