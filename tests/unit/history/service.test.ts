import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, MAX_HISTORY_ENTRIES } from '@flowlary/shared'
import { FlowlaryStorage } from '../../../extension/src/storage/index.ts'
import {
  clearHistory,
  getHistory,
  getHistoryStats,
  getUnifiedHistoryStore,
  removeHistoryEntry,
} from '../../../extension/src/storage/facade.ts'
import {
  getHistoryService,
  resetHistoryServiceForTests,
} from '../../../extension/src/storage/history/index.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'
import { activateTestAccount, clearTestAccountContext, TEST_ACCOUNT_A } from '../../helpers/accountIsolation.ts'
import { buildAccountScopedKey } from '../../../extension/src/storage/accountScopedStorage.ts'

function textarea(): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  document.body.append(el)
  return el
}

describe('HistoryService', () => {
  let mockStore: ReturnType<typeof createMockChromeStorage>
  let storage: FlowlaryStorage

  beforeEach(async () => {
    document.body.innerHTML = ''
    mockStore = createMockChromeStorage()
    mockStore.install()
    resetHistoryServiceForTests()
    storage = new FlowlaryStorage()
    stateManager.settings.excludedDomains = []
    await clearTestAccountContext()
    await activateTestAccount()
  })

  afterEach(() => {
    resetHistoryServiceForTests()
  })

  async function record(
    overrides: Partial<{
      operation: 'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT'
      sourceText: string
      resultText: string
      mode: 'manual' | 'automatic' | 'live'
      timestamp: number
    }> = {},
  ) {
    const service = getHistoryService(storage)
    await service.initialize()
    const el = textarea()
    return service.record({
      operation: overrides.operation ?? 'CORRECT',
      element: el,
      sourceText: overrides.sourceText ?? 'hello',
      resultText: overrides.resultText ?? 'Hello',
      mode: overrides.mode ?? 'automatic',
      timestamp: overrides.timestamp,
    })
  }

  it('adds and reads valid history entries', async () => {
    expect(await record()).toBe(true)
    const entries = await getHistory(storage)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.sourceText).toBe('hello')
  })

  it('returns newest entries first', async () => {
    await record({ sourceText: 'one', resultText: 'One', timestamp: 100 })
    await record({ sourceText: 'two', resultText: 'Two', timestamp: 200 })
    const entries = await getHistory(storage)
    expect(entries.map((entry) => entry.sourceText)).toEqual(['two', 'one'])
  })

  it('deletes one entry', async () => {
    await record()
    const [entry] = await getHistory(storage)
    expect(await removeHistoryEntry(storage, entry!.id)).toBe(true)
    expect(await getHistory(storage)).toHaveLength(0)
  })

  it('clears all history', async () => {
    await record()
    await record({ sourceText: 'a', resultText: 'A' })
    await clearHistory(storage)
    expect(await getHistory(storage)).toEqual([])
  })

  it('handles empty history', async () => {
    const service = getHistoryService(storage)
    await service.initialize()
    expect(await service.list()).toEqual([])
    expect(await getHistoryStats(storage)).toEqual({
      total: 0,
      byOperation: { CORRECT: 0, TRANSLATE: 0, FIX_LAYOUT: 0 },
    })
  })

  it('does not duplicate rapid identical entries', async () => {
    await record({ operation: 'TRANSLATE', sourceText: 'hi', resultText: 'Hola' })
    await record({ operation: 'TRANSLATE', sourceText: 'hi', resultText: 'Hola' })
    expect(await getHistory(storage)).toHaveLength(1)
  })

  it('prunes oldest entries beyond MAX_HISTORY_ENTRIES', async () => {
    const service = getHistoryService(storage)
    await service.initialize()
    const el = textarea()
    for (let index = 0; index < MAX_HISTORY_ENTRIES + 5; index += 1) {
      const marker = String.fromCodePoint(0x4000 + index)
      const ok = await service.record({
        operation: 'CORRECT',
        element: el,
        sourceText: `Line ${marker} original`,
        resultText: `Line ${marker} corrected`,
        timestamp: Date.now() + index * 10_000,
      })
      expect(ok).toBe(true)
    }
    const entries = await getHistory(storage)
    expect(entries.length).toBe(MAX_HISTORY_ENTRIES)
    const newestMarker = String.fromCodePoint(0x4000 + MAX_HISTORY_ENTRIES + 4)
    const oldestKeptMarker = String.fromCodePoint(0x4000 + 5)
    expect(entries[0]?.sourceText).toContain(newestMarker)
    expect(entries.at(-1)?.sourceText).toContain(oldestKeptMarker)
  })

  it('preserves legacy arrays after unified import', async () => {
    mockStore.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'history')] = {
      _v: 1,
      ewa: [{ id: '1', timestamp: 1, original: 'a', corrected: 'b' }],
      layfix: [{ token: 'x', replacement: 'y', ts: 2 }],
    }
    const service = getHistoryService(storage)
    await service.initialize()
    const raw = mockStore.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'history')] as {
      ewa?: unknown[]
      layfix?: unknown[]
      entries?: unknown[]
    }
    expect(raw.ewa?.length).toBe(1)
    expect(raw.layfix?.length).toBe(1)
    expect(raw.entries?.length).toBe(2)
  })

  it('migration is idempotent', async () => {
    mockStore.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'history')] = {
      _v: 1,
      ewa: [{ id: '1', timestamp: 1, original: 'a', corrected: 'b' }],
    }
    const service = getHistoryService(storage)
    await service.initialize()
    await service.initialize()
    expect(await getHistory(storage)).toHaveLength(1)
  })

  it('handles concurrent writes without losing entries', async () => {
    const service = getHistoryService(storage)
    await service.initialize()
    const el = textarea()
    await Promise.all([
      service.record({ operation: 'CORRECT', element: el, sourceText: 'a', resultText: 'A' }),
      service.record({ operation: 'TRANSLATE', element: el, sourceText: 'b', resultText: 'B' }),
      service.record({ operation: 'FIX_LAYOUT', element: el, sourceText: 'c', resultText: 'C' }),
    ])
    expect(await getHistory(storage)).toHaveLength(3)
  })

  it('delete + add race keeps storage consistent', async () => {
    await record({ sourceText: 'keep', resultText: 'Keep' })
    const [first] = await getHistory(storage)
    const service = getHistoryService(storage)
    await Promise.all([
      service.remove(first!.id),
      service.record({
        operation: 'CORRECT',
        element: textarea(),
        sourceText: 'new',
        resultText: 'New',
      }),
    ])
    const entries = await getUnifiedHistoryStore(storage)
    expect(entries.entries.some((entry) => entry.sourceText === 'new')).toBe(true)
  })

  it('never throws on storage failure', async () => {
    const service = getHistoryService(storage)
    await service.initialize()
    vi.mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error('disk full'))
    await expect(
      service.record({
        operation: 'CORRECT',
        element: textarea(),
        sourceText: 'x',
        resultText: 'X',
      }),
    ).resolves.toBe(false)
  })
})
