import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AppConfig } from '../../../backend/src/config/env.ts'
import { loadConfig } from '../../../backend/src/config/env.ts'
import { configureStorePath } from '../../../backend/src/db/store.ts'
import { evaluateReadiness } from '../../../backend/src/health/readiness.ts'
import { handleHttpRequest } from '../../../backend/src/routes/http.ts'

function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  return {
    ...loadConfig(),
    env: 'development',
    authDisabled: true,
    authSecret: 'health-test-secret',
    jwtSecret: 'health-test-jwt',
    groqApiKey: 'test-groq-key',
    port: 8787,
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    dataPath: ':memory:',
    ...overrides,
  }
}

async function request(config: AppConfig, path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  let payload = ''
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (chunk: string) => {
      payload = chunk
    },
  } as unknown as ServerResponse
  const req = { method: 'GET', url: path, headers: { host: 'localhost' } } as IncomingMessage
  await handleHttpRequest(config, req, res)
  return { status: res.statusCode, body: JSON.parse(payload) as Record<string, unknown> }
}

describe('health and readiness endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('GET /health returns 200 when process is alive', async () => {
    const result = await request(createTestConfig(), '/health')
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      ok: true,
      service: 'flowlary-ai-gateway',
      groqConfigured: true,
    })
  })

  it('GET / returns the same health payload as /health', async () => {
    const result = await request(createTestConfig(), '/')
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      ok: true,
      service: 'flowlary-ai-gateway',
    })
  })

  it('GET /ready returns 200 when dependencies are satisfied in development', async () => {
    const result = await request(createTestConfig(), '/ready')
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ ok: true, ready: true })
    expect(Array.isArray(result.body.checks)).toBe(true)
  })

  it('GET /ready returns 503 when production secrets are missing', async () => {
    const result = await request(
      createTestConfig({
        env: 'production',
        groqApiKey: '',
        jwtSecret: 'dev-only-change-me',
        authSecret: 'dev-only-change-me',
        corsOrigins: [],
        webOrigin: '',
      }),
      '/ready',
    )
    expect(result.status).toBe(503)
    expect(result.body).toMatchObject({ ok: false, ready: false })
    const checks = result.body.checks as Array<{ name: string; ok: boolean }>
    expect(checks.find((c) => c.name === 'secrets')?.ok).toBe(false)
  })

  it('evaluateReadiness skips secret checks outside production', () => {
    const report = evaluateReadiness(createTestConfig())
    expect(report.ready).toBe(true)
    expect(report.checks.find((c) => c.name === 'secrets')?.detail).toBe('skipped_in_non_production')
  })

  it('GET /health exposes advisor provider configuration and health snapshots', async () => {
    const result = await request(createTestConfig({
      advisorEnabled: true,
      advisorFallbackEnabled: false,
      advisorProviderOrder: ['groq', 'gemini', 'openrouter'],
      groqAdvisorEnabled: true,
      geminiAdvisorEnabled: false,
      openRouterAdvisorEnabled: false,
    }), '/health')
    expect(result.body.advisor).toMatchObject({
      enabled: true,
      fallbackEnabled: false,
      providerOrder: ['groq', 'gemini', 'openrouter'],
      providers: expect.arrayContaining([
        expect.objectContaining({ provider: 'groq', enabled: true }),
        expect.objectContaining({ provider: 'gemini', enabled: false }),
        expect.objectContaining({ provider: 'openrouter', enabled: false }),
      ]),
    })
  })

  it('evaluateReadiness requires fallback provider credentials in production when enabled', () => {
    const report = evaluateReadiness(createTestConfig({
      env: 'production',
      groqApiKey: 'gsk_test',
      jwtSecret: 'prod-jwt-secret',
      authSecret: 'prod-auth-secret',
      corsOrigins: ['https://flowlary.com'],
      webOrigin: 'https://flowlary.com',
      advisorEnabled: true,
      advisorFallbackEnabled: true,
      geminiAdvisorEnabled: true,
      geminiApiKey: '',
      openRouterAdvisorEnabled: true,
      openRouterApiKey: '',
      openRouterAdvisorModel: '',
    }))
    expect(report.ready).toBe(false)
    expect(report.checks.find((c) => c.name === 'advisor_providers')).toMatchObject({
      ok: false,
      detail: expect.stringContaining('GEMINI_API_KEY'),
    })
  })

  it('evaluateReadiness requires secrets in production', () => {
    const report = evaluateReadiness(
      createTestConfig({
        env: 'production',
        groqApiKey: 'gsk_test',
        jwtSecret: 'prod-jwt-secret',
        authSecret: 'prod-auth-secret',
        corsOrigins: ['https://flowlary.com'],
        webOrigin: 'https://flowlary.com',
      }),
    )
    expect(report.ready).toBe(true)
  })
})
