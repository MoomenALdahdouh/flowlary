import type { AppConfig } from '../config/env.ts'

const PADDLE_VERSION = '1'

export function paddleApiBase(environment: AppConfig['paddleEnvironment']): string {
  return environment === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'
}

export type PaddleApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

async function paddleRequest<T>(
  config: AppConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<PaddleApiResult<T>> {
  if (!config.paddleApiKey) {
    return { ok: false, status: 503, message: 'Paddle API key is not configured' }
  }
  try {
    const response = await fetch(`${paddleApiBase(config.paddleEnvironment)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.paddleApiKey}`,
        'Paddle-Version': PADDLE_VERSION,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = (await response.json().catch(() => ({}))) as { data?: T; error?: { detail?: string } }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: typeof json.error?.detail === 'string' ? json.error.detail : 'Paddle request failed',
      }
    }
    return { ok: true, data: json.data as T }
  } catch {
    return { ok: false, status: 503, message: 'Paddle is unavailable' }
  }
}

export type PaddleTransaction = {
  id: string
  status?: string
  customer_id?: string | null
  custom_data?: Record<string, unknown> | null
}

export async function createCheckoutTransaction(
  config: AppConfig,
  input: { accountId: string; customerId?: string | null; priceId?: string },
): Promise<PaddleApiResult<PaddleTransaction>> {
  const priceId = input.priceId || config.paddlePriceIdPro
  if (!priceId) {
    return { ok: false, status: 503, message: 'Paddle price is not configured' }
  }
  const payload: Record<string, unknown> = {
    items: [{ price_id: priceId, quantity: 1 }],
    collection_mode: 'automatic',
    custom_data: { flowlary_account_id: input.accountId },
  }
  if (input.customerId) payload.customer_id = input.customerId
  return paddleRequest<PaddleTransaction>(config, 'POST', '/transactions', payload)
}

export type PaddlePortalSession = {
  id: string
  urls?: {
    general?: { overview?: string }
    subscriptions?: Array<{ id?: string; subscription_id?: string; cancel_subscription?: string }>
  }
}

export async function createCustomerPortalSession(
  config: AppConfig,
  customerId: string,
  subscriptionIds: string[],
): Promise<PaddleApiResult<PaddlePortalSession>> {
  const body: Record<string, unknown> = {}
  if (subscriptionIds.length > 0) body.subscription_ids = subscriptionIds
  return paddleRequest<PaddlePortalSession>(
    config,
    'POST',
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    body,
  )
}

export type PaddlePrice = {
  id: string
  description?: string | null
  unit_price?: { amount?: string; currency_code?: string }
  billing_cycle?: { interval?: string; frequency?: number } | null
  trial_period?: { interval?: string; frequency?: number } | null
}

export async function readProPrice(config: AppConfig, priceId?: string): Promise<PaddlePrice | null> {
  const id = priceId || config.paddlePriceIdPro
  if (!config.paddleApiKey || !id) return null
  const result = await paddleRequest<PaddlePrice>(
    config,
    'GET',
    `/prices/${encodeURIComponent(id)}`,
  )
  return result.ok ? result.data : null
}

export function configuredProPriceIds(config: AppConfig): string[] {
  return [config.paddlePriceIdPro, config.paddlePriceIdProYearly].filter(Boolean)
}
