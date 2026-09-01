import type { Server } from 'node:http'
import { fetch as undiciFetch } from 'undici'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 8787

let activeServer: Server | null = null

async function isApiHealthy(baseUrl: string): Promise<boolean> {
  try {
    const response = await undiciFetch(`${baseUrl}/health`, { method: 'GET' })
    if (!response.ok) return false
    const body = (await response.json()) as { ok?: boolean }
    return body.ok === true
  } catch {
    return false
  }
}

async function waitForApiHealthy(baseUrl: string, attempts = 30, delayMs = 100): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    if (await isApiHealthy(baseUrl)) return true
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return false
}

/** Start an in-memory Flowlary API for extension integration tests (idempotent). */
export async function ensureTestApiServer(): Promise<{ started: boolean; baseUrl: string }> {
  const baseUrl = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`
  if (await isApiHealthy(baseUrl)) {
    return { started: false, baseUrl }
  }

  if (activeServer) {
    return { started: false, baseUrl }
  }

  const { createFlowlaryServer } = await import('../../backend/src/index.ts')
  const { loadConfig } = await import('../../backend/src/config/env.ts')
  const { configureStorePath, resetStoreForTests } = await import('../../backend/src/db/store.ts')
  const { resetRoutesForTests } = await import('../../backend/src/routes/http.ts')
  const { resetRateLimitsForTests } = await import('../../backend/src/middleware/rateLimit.ts')

  resetRoutesForTests()
  resetRateLimitsForTests()
  resetStoreForTests()
  configureStorePath(':memory:')

  const config = {
    ...loadConfig(),
    env: 'test' as const,
    port: DEFAULT_PORT,
    dataPath: ':memory:',
    authSecret: 'extension-test-auth-secret',
    jwtSecret: 'extension-test-jwt-secret',
    groqApiKey: 'test-groq-key-not-real',
    requestTimeoutMs: 5_000,
    maxBodyBytes: 64_000,
    webOrigin: 'https://flowlary.test',
  }

  const server = createFlowlaryServer(config)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(DEFAULT_PORT, DEFAULT_HOST, () => resolve())
  })
  activeServer = server

  if (!(await waitForApiHealthy(baseUrl))) {
    throw new Error('Failed to start Flowlary test API server')
  }

  return { started: true, baseUrl }
}

export async function resetTestApiDatastore(): Promise<void> {
  const baseUrl = `http://${DEFAULT_HOST}:${DEFAULT_PORT}`
  if (!(await isApiHealthy(baseUrl))) return
  const response = await undiciFetch(`${baseUrl}/__test/reset`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Test API reset failed (${response.status})`)
  }
}

export async function stopTestApiServer(): Promise<void> {
  if (!activeServer) return
  await new Promise<void>((resolve, reject) => {
    activeServer?.close((err) => (err ? reject(err) : resolve()))
  })
  activeServer = null
}
