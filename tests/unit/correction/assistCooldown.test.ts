import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  ASSIST_RATE_LIMIT_COOLDOWN_MS,
  assistCooldownRemainingMs,
  clearAssistCooldownForTests,
  isAssistCooldownActive,
  noteAssistRateLimited,
} from '../../../extension/src/features/correction/assistCooldown.ts'

describe('assistCooldown', () => {
  afterEach(() => {
    clearAssistCooldownForTests()
    vi.useRealTimers()
  })

  it('activates after a rate limit and expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    noteAssistRateLimited()
    expect(isAssistCooldownActive()).toBe(true)
    expect(assistCooldownRemainingMs()).toBe(ASSIST_RATE_LIMIT_COOLDOWN_MS)
    vi.advanceTimersByTime(ASSIST_RATE_LIMIT_COOLDOWN_MS - 1)
    expect(isAssistCooldownActive()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(isAssistCooldownActive()).toBe(false)
  })

  it('extends cooldown when multiple rate limits arrive', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    noteAssistRateLimited(30_000)
    vi.setSystemTime(20_000)
    noteAssistRateLimited(80_000)
    expect(isAssistCooldownActive(50_000)).toBe(true)
    expect(isAssistCooldownActive(80_000)).toBe(false)
  })
})
