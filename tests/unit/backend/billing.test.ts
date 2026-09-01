import { describe, expect, it } from 'vitest'
import { getBillingStatus, isBillingConfigured } from '../../../backend/src/billing/index.ts'
import { loadConfig } from '../../../backend/src/config/env.ts'

describe('billing boundary', () => {
  it('is unconfigured without Paddle secrets and does not invent checkout', () => {
    const config = {
      ...loadConfig(),
      paddleApiKey: '',
      paddleWebhookSecret: '',
      paddleClientToken: '',
      paddlePriceIdPro: '',
      paddlePriceIdProYearly: '',
    }
    expect(isBillingConfigured(config)).toBe(false)
    expect(getBillingStatus(config)).toMatchObject({
      id: 'none',
      configured: false,
      checkoutAvailable: false,
    })
  })
})
