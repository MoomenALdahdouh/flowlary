import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { FLOWLARY_PRICING, formatUsdFromCents } from '@flowlary/shared'
import { PricingShowcase } from './PricingShowcase.tsx'

vi.mock('../../account/billing.ts', () => ({
  loadBillingConfigSafe: async () => ({
    available: true,
    checkoutAvailable: true,
    yearlyCheckoutAvailable: true,
    portalAvailable: true,
    webhookConfigured: true,
    environment: 'sandbox',
    clientToken: 'test',
    priceConfigured: true,
    proPrice: {
      amount: String(FLOWLARY_PRICING.monthly.amountCents),
      currency: 'USD',
      interval: 'month',
      frequency: 1,
    },
    proPriceMonthly: {
      amount: String(FLOWLARY_PRICING.monthly.amountCents),
      currency: 'USD',
      interval: 'month',
      frequency: 1,
    },
    proPriceYearly: {
      amount: String(FLOWLARY_PRICING.yearly.amountCents),
      currency: 'USD',
      interval: 'year',
      frequency: 1,
    },
    trial: null,
  }),
  catalogDisplayPrice: (_live: unknown, fallbackCents: number) => formatUsdFromCents(fallbackCents),
  resolveCommercialPlanState: () => 'anonymous',
  beginProCheckout: async () => ({ ok: false as const, reason: 'billing_unavailable' as const }),
}))

vi.mock('../../account/client.ts', () => ({
  loadWebAccount: async () => ({ ok: false as const }),
}))

function renderPricing() {
  return renderToString(
    <MemoryRouter>
      <PricingShowcase />
    </MemoryRouter>,
  )
}

describe('PricingShowcase', () => {
  it('renders approved pricing and student section without stale $9/$90 copy', () => {
    const html = renderPricing()
    expect(html).toContain(formatUsdFromCents(FLOWLARY_PRICING.monthly.amountCents))
    expect(html).toContain(formatUsdFromCents(FLOWLARY_PRICING.yearly.amountCents))
    expect(html).toContain(formatUsdFromCents(FLOWLARY_PRICING.yearlyEquivalentMonthlyCents))
    expect(html).toContain(formatUsdFromCents(FLOWLARY_PRICING.yearlySavingsCents))
    expect(html).toContain('id="students"')
    expect(html).toContain(`${FLOWLARY_PRICING.freeDailyCredits} AI writing checks/day`)
    expect(html).toContain(`${FLOWLARY_PRICING.proDailyCredits} AI writing checks/day`)
    expect(html).toContain(`${FLOWLARY_PRICING.trialDays} days`)
    expect(html).toContain(`${FLOWLARY_PRICING.trialDailyCredits} AI writing checks per day`)
    expect(html).not.toContain('$9/month')
    expect(html).not.toContain('$90')
    expect(html).not.toContain('1500 AI writing checks')
    expect(html).not.toContain('9000')
    expect(html).not.toContain('Save $18/year')
  })

  it('links student CTA to honest account funnel', () => {
    const html = renderPricing()
    expect(html).toContain('/account?mode=register&amp;intent=student')
  })
})
