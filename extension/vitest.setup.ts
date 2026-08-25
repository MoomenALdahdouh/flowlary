import { afterEach, vi } from 'vitest'
import { resetFlowlaryCacheForTests } from './src/storage/cache/index.ts'

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
  },
})

afterEach(() => {
  resetFlowlaryCacheForTests()
})
