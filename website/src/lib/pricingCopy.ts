import {
  FLOWLARY_PRICING,
  STUDENT_PROGRAM_DURATION_MONTHS,
  formatUsdFromCents,
} from '@flowlary/shared'

export function pricingIntervalSaveLabel(locale = 'en-US'): string {
  const savings = FLOWLARY_PRICING.yearlySavingsCents
  if (savings <= 0) return ''
  return `Save ${formatUsdFromCents(savings, locale)}/year`
}

export function pricingEquivalentMonthlyLabel(locale = 'en-US'): string {
  return `Equivalent to ${formatUsdFromCents(FLOWLARY_PRICING.yearlyEquivalentMonthlyCents, locale)} / month`
}

export function pricingBillingSummary(locale = 'en-US'): string {
  return `Pro is ${formatUsdFromCents(FLOWLARY_PRICING.monthly.amountCents, locale)}/month or ${formatUsdFromCents(FLOWLARY_PRICING.yearly.amountCents, locale)}/year.`
}

export function freeDailyChecksLabel(): string {
  return `${FLOWLARY_PRICING.freeDailyCredits} AI writing checks/day`
}

export function proDailyChecksLabel(): string {
  return `${FLOWLARY_PRICING.proDailyCredits} AI writing checks/day`
}

export { FLOWLARY_PRICING, STUDENT_PROGRAM_DURATION_MONTHS, formatUsdFromCents }
