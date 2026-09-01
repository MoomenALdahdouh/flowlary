import { describe, expect, it } from 'vitest'
import {
  AI_CREDIT_WEIGHTS,
  FREE_DAILY_CREDITS,
  PRO_DAILY_CREDITS,
  PRO_MONTHLY_SOFT_CAP,
  ACCOUNT_TRIAL_DURATION_MS,
  capabilitiesForPlan,
  creditWeightForOperation,
  dailyLimitForPlan,
  formatResetCountdown,
  nextUtcMidnightMs,
  utcDayKey,
} from '@flowlary/shared'

describe('Phase 27 — credits and capabilities', () => {
  it('uses Phase 26 weights', () => {
    expect(AI_CREDIT_WEIGHTS.correction).toBe(1)
    expect(AI_CREDIT_WEIGHTS.practice).toBe(1)
    expect(AI_CREDIT_WEIGHTS['layout-classification']).toBe(1)
    expect(AI_CREDIT_WEIGHTS['hypothesis-advisor']).toBe(1)
    expect(AI_CREDIT_WEIGHTS['writing-review']).toBe(1)
    expect(creditWeightForOperation('writing-review')).toBe(1)
    expect(AI_CREDIT_WEIGHTS.translation).toBe(2)
    expect(AI_CREDIT_WEIGHTS['live-translation']).toBe(2)
    expect(creditWeightForOperation('translation', 'live')).toBe(2)
    expect(creditWeightForOperation('translation', 'explanation-localize')).toBe(1)
    expect(creditWeightForOperation('correction', 'practice')).toBe(1)
  })

  it('uses acquisition daily limits and 30-day trial', () => {
    expect(FREE_DAILY_CREDITS).toBe(500)
    expect(PRO_DAILY_CREDITS).toBe(1000)
    expect(PRO_MONTHLY_SOFT_CAP).toBe(30_000)
    expect(dailyLimitForPlan('free')).toBe(FREE_DAILY_CREDITS)
    expect(dailyLimitForPlan('trial')).toBe(PRO_DAILY_CREDITS)
    expect(dailyLimitForPlan('pro')).toBe(PRO_DAILY_CREDITS)
    expect(ACCOUNT_TRIAL_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it('grants full product caps for trial/pro and AI caps for free with credits', () => {
    const free = capabilitiesForPlan('free', { creditsRemaining: 10 })
    expect(free.has('ai.correction')).toBe(true)
    expect(free.has('learning.export')).toBe(false)
    expect(free.has('keyboard.unlimited')).toBe(true)

    const freeExhausted = capabilitiesForPlan('free', { creditsRemaining: 0 })
    expect(freeExhausted.has('ai.correction')).toBe(false)
    expect(freeExhausted.has('ai.translation')).toBe(true)
    expect(freeExhausted.has('ai.liveTranslation')).toBe(true)
    expect(freeExhausted.has('speedbox.unlimited')).toBe(true)

    const trial = capabilitiesForPlan('trial')
    expect(trial.has('practice.full')).toBe(true)
    expect(trial.has('learning.export')).toBe(true)
    expect(trial.has('progress.advanced')).toBe(true)
  })

  it('formats reset countdown and day keys in UTC', () => {
    const now = Date.UTC(2026, 7, 26, 12, 0, 0)
    expect(utcDayKey(now)).toBe('2026-08-26')
    expect(nextUtcMidnightMs(now)).toBe(Date.UTC(2026, 7, 27, 0, 0, 0, 0))
    expect(formatResetCountdown(now + 4 * 3600_000 + 12 * 60_000, now)).toBe('4h 12m')
  })
})
