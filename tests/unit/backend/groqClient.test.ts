import { afterEach, describe, expect, it, vi } from 'vitest'
import { AI_MODELS } from '@flowlary/shared'
import {
  callGroqChat,
  groqModelSupportsIncludeReasoning,
} from '../../../backend/src/providers/groqClient.ts'
import type { AppConfig } from '../../../backend/src/config/env.ts'

function testConfig(): AppConfig {
  return {
    env: 'test',
    port: 8787,
    groqApiKey: 'test-groq-key',
    authDisabled: true,
    authSecret: 'test',
    jwtSecret: 'test',
    dataPath: ':memory:',
    requestTimeoutMs: 5000,
    maxBodyBytes: 64000,
    corsOrigins: [],
    paddleEnvironment: 'sandbox',
    paddleApiKey: '',
    paddleWebhookSecret: '',
    paddleClientToken: '',
    paddlePriceIdPro: '',
    paddlePriceIdProYearly: '',
    googleTranslateEnabled: false,
    googleProjectId: '',
    googleLocation: 'global',
    googleApplicationCredentials: '',
    googleTranslateApiKey: '',
    translationForceProvider: 'auto',
    translationAllowGroqFallback: false,
    smtpHost: '',
    smtpPort: 1025,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    emailFrom: 'test@test.com',
    webOrigin: 'https://flowlary.test',
  } as AppConfig
}

describe('groqClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('omits include_reasoning for layout classifier model', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe(AI_MODELS.LAYOUT_CLASSIFIER)
      expect(body).not.toHaveProperty('include_reasoning')
      return {
        ok: true,
        json: async () => ({
          model: AI_MODELS.LAYOUT_CLASSIFIER,
          choices: [{ message: { content: '{"kind":"VALID"}' } }],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await callGroqChat(testConfig(), {
      model: AI_MODELS.LAYOUT_CLASSIFIER,
      messages: [{ role: 'user', content: 'test' }],
      responseFormat: 'json_object',
    })

    expect(result.content).toContain('VALID')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('sets include_reasoning false for gpt-oss models', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.model).toBe(AI_MODELS.CORRECTION)
      expect(body.include_reasoning).toBe(false)
      return {
        ok: true,
        json: async () => ({
          model: AI_MODELS.CORRECTION,
          choices: [{ message: { content: 'ok' } }],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    await callGroqChat(testConfig(), {
      model: AI_MODELS.CORRECTION,
      messages: [{ role: 'user', content: 'test' }],
    })

    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('classifies reasoning-capable models', () => {
    expect(groqModelSupportsIncludeReasoning(AI_MODELS.CORRECTION)).toBe(true)
    expect(groqModelSupportsIncludeReasoning(AI_MODELS.LAYOUT_CLASSIFIER)).toBe(false)
  })

  it('maps connect timeout to groq_connect_timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_input: RequestInfo, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const promise = callGroqChat(testConfig(), {
      model: AI_MODELS.CORRECTION,
      messages: [{ role: 'user', content: 'test' }],
    })
    const expectation = expect(promise).rejects.toThrow('groq_connect_timeout')
    await vi.advanceTimersByTimeAsync(10_100)
    await expectation
    vi.useRealTimers()
  })
})
