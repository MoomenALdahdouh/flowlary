import { afterEach, beforeEach, vi } from 'vitest'
import { fetch as undiciFetch } from 'undici'
import { resetFlowlaryCacheForTests } from './src/storage/cache/index.ts'

const LIVE_API_PATTERN =
  /^https?:\/\/(127\.0\.0\.1|localhost):8787\b|^https:\/\/writing-api\.test\b/

function normalizeTestApiUrl(url: string): string {
  if (url.startsWith('https://writing-api.test')) {
    return url.replace('https://writing-api.test', 'http://127.0.0.1:8787')
  }
  return url
}

/** Route local gateway calls through Node fetch (happy-dom blocks CORS / self-signed TLS). */
const happyDomFetch = globalThis.fetch.bind(globalThis)
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (LIVE_API_PATTERN.test(url)) {
    const normalized = normalizeTestApiUrl(url)
    return undiciFetch(normalized, init as Parameters<typeof undiciFetch>[1])
  }
  return happyDomFetch(input, init)
})

vi.stubGlobal('chrome', {
  runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    sendMessage: vi.fn(),
  },
  commands: {
    onCommand: { addListener: vi.fn() },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
})

afterEach(() => {
  resetFlowlaryCacheForTests()
})

/** Shared in-memory API state is process-global; reset between integration tests to avoid cross-file races. */
beforeEach(async (ctx) => {
  const file = ctx.task?.file?.filepath ?? ''
  if (!file.includes('/tests/integration/')) return
  try {
    const { resetTestApiDatastore } = await import('../tests/helpers/testApiServer.ts')
    await resetTestApiDatastore()
  } catch {
    // Test API not running (startup race); integration tests will fail clearly if needed.
  }
})
