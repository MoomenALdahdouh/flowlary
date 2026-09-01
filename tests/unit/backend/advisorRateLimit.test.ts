import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkAdvisorRateLimit,
  checkRateLimit,
  resetRateLimitsForTests,
} from '../../../backend/src/middleware/rateLimit.ts'

describe('advisor-specific rate limiting', () => {
  beforeEach(() => resetRateLimitsForTests())

  it('uses its configured per-user capacity', () => {
    checkAdvisorRateLimit('user-1', 2)
    checkAdvisorRateLimit('user-1', 2)
    expect(() => checkAdvisorRateLimit('user-1', 2)).toThrow('rate_limited')
  })

  it('does not consume the layout-classifier bucket', () => {
    checkAdvisorRateLimit('user-1', 1)
    expect(() => checkAdvisorRateLimit('user-1', 1)).toThrow('rate_limited')
    expect(() => checkRateLimit('user-1', 'anonymous', 'layout-classification'))
      .not.toThrow()
  })
})
