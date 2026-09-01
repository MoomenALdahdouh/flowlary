import { describe, expect, it } from 'vitest'
import { signPaddlePayload, verifyPaddleSignature } from '../../../backend/src/billing/paddleSignature.ts'
import { mapPaddleStatus, subscriptionGrantsPro } from '../../../backend/src/billing/subscriptionMap.ts'
import type { SubscriptionRecord } from '../../../backend/src/db/store.ts'

describe('Paddle signature verification', () => {
  const secret = 'pdl_ntfset_test_secret'
  const body = '{"event_id":"evt_1","event_type":"subscription.created"}'
  const ts = String(Math.floor(Date.now() / 1000))

  it('accepts a valid HMAC of ts:rawBody', () => {
    const h1 = signPaddlePayload(body, secret, ts)
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, secret)).toBe(true)
  })

  it('rejects a missing signature', () => {
    expect(verifyPaddleSignature(body, '', secret)).toBe(false)
  })

  it('rejects a modified body', () => {
    const h1 = signPaddlePayload(body, secret, ts)
    expect(verifyPaddleSignature(body.replace('created', 'updated'), `ts=${ts};h1=${h1}`, secret)).toBe(false)
  })

  it('rejects the wrong secret', () => {
    const h1 = signPaddlePayload(body, secret, ts)
    expect(verifyPaddleSignature(body, `ts=${ts};h1=${h1}`, 'other-secret')).toBe(false)
  })
})

describe('subscription mapping', () => {
  const base: SubscriptionRecord = {
    accountId: 'acc',
    paddleCustomerId: 'ctm_01aaaaaaaaaaaaaaaaaaaaaaaa',
    paddleSubscriptionId: 'sub_01aaaaaaaaaaaaaaaaaaaaaaaa',
    status: 'active',
    priceId: 'pri_test',
    plan: 'pro',
    currentPeriodStart: Date.now() - 1000,
    currentPeriodEnd: Date.now() + 86_400_000,
    cancelAtPeriodEnd: false,
    paymentFailed: false,
    lastWebhookAt: Date.now(),
    lastEventOccurredAt: new Date().toISOString(),
    billingEnvironment: 'sandbox',
  }

  it('maps Paddle statuses without inventing names', () => {
    expect(mapPaddleStatus('active')).toBe('active')
    expect(mapPaddleStatus('past_due')).toBe('past_due')
    expect(mapPaddleStatus('not_a_status')).toBe('none')
  })

  it('keeps Pro for active, trialing, and past_due', () => {
    expect(subscriptionGrantsPro({ ...base, status: 'active' })).toBe(true)
    expect(subscriptionGrantsPro({ ...base, status: 'trialing' })).toBe(true)
    expect(subscriptionGrantsPro({ ...base, status: 'past_due', paymentFailed: true })).toBe(true)
  })

  it('keeps Pro after cancel until period end', () => {
    expect(
      subscriptionGrantsPro({
        ...base,
        status: 'canceled',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: Date.now() + 60_000,
      }),
    ).toBe(true)
    expect(
      subscriptionGrantsPro({
        ...base,
        status: 'canceled',
        currentPeriodEnd: Date.now() - 1,
      }),
    ).toBe(false)
  })

  it('revokes Pro when paused', () => {
    expect(subscriptionGrantsPro({ ...base, status: 'paused' })).toBe(false)
  })
})
