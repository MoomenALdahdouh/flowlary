import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_TRIAL_DURATION_MS,
  FLOWLARY_PRICING,
  PRO_MONTHLY_PRICE_CENTS,
  PRO_YEARLY_PRICE_CENTS,
  annualSavingsCents,
  catalogAmountMatchesApproved,
  yearlyEquivalentMonthlyCents,
} from '@flowlary/shared'

describe('FLOWLARY_PRICING Phase 29C', () => {
  it('matches approved $4.99 monthly and $39 yearly', () => {
    expect(PRO_MONTHLY_PRICE_CENTS).toBe(499)
    expect(PRO_YEARLY_PRICE_CENTS).toBe(3900)
    expect(FLOWLARY_PRICING.monthly.display).toBe('$4.99')
    expect(FLOWLARY_PRICING.yearly.display).toBe('$39')
  })

  it('computes annual savings and equivalent monthly correctly', () => {
    expect(annualSavingsCents()).toBe(2088)
    expect(FLOWLARY_PRICING.yearlySavingsCents).toBe(2088)
    expect(yearlyEquivalentMonthlyCents()).toBe(325)
  })

  it('derives trial days from canonical ACCOUNT_TRIAL_DURATION_MS', () => {
    expect(FLOWLARY_PRICING.trialDays).toBe(30)
    expect(ACCOUNT_TRIAL_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  it('validates catalog amounts against approved pricing', () => {
    expect(catalogAmountMatchesApproved(499, 'month')).toBe(true)
    expect(catalogAmountMatchesApproved(3900, 'year')).toBe(true)
    expect(catalogAmountMatchesApproved(999, 'month')).toBe(false)
  })
})
