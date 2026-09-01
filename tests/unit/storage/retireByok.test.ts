import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { retireByokIfNeeded } from '../../../extension/src/storage/retireByok.ts'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'
import { flowlaryStorage } from '../../../extension/src/storage/index.ts'
import { getCorrectionSettings } from '../../../extension/src/storage/facade.ts'
import { stateManager, DEFAULT_CORRECTION } from '../../../extension/src/core/state/StateManager.ts'

describe('retireByokIfNeeded', () => {
  let mockStore: ReturnType<typeof createMockChromeStorage>

  beforeEach(() => {
    mockStore = createMockChromeStorage()
    mockStore.install()
    Object.assign(stateManager.correction, DEFAULT_CORRECTION)
  })

  afterEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        sendMessage: vi.fn(),
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
  })

  it('removes stored groq key without logging it', async () => {
    mockStore.local[STORAGE_KEYS.correctionGroqKey] = 'gsk_secret_never_log'
    await retireByokIfNeeded(flowlaryStorage)
    expect(mockStore.local[STORAGE_KEYS.correctionGroqKey]).toBeUndefined()
    const correction = await getCorrectionSettings(flowlaryStorage)
    expect(correction).not.toHaveProperty('groqApiKey')
    expect(correction).not.toHaveProperty('aiProvider')
  })

  it('strips legacy byok fields from stored correction settings', async () => {
    mockStore.local[STORAGE_KEYS.correction] = {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
      aiProvider: 'byok',
      groqApiKey: 'gsk_secret_never_log',
    }
    await retireByokIfNeeded(flowlaryStorage)
    const raw = mockStore.local[STORAGE_KEYS.correction] as Record<string, unknown>
    expect(raw.aiProvider).toBeUndefined()
    expect(raw.groqApiKey).toBeUndefined()
    expect(raw.consentAccepted).toBe(true)
  })
})
