import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { flowlaryStorage, FlowlaryStorage } from '../../extension/src/storage/index.ts'
import { getHistoryService, resetHistoryServiceForTests } from '../../extension/src/storage/history/index.ts'
import { commitMergedCorrection } from '../../extension/src/features/correction/applyCorrection.ts'
import { createCorrectionMetrics } from '../../extension/src/features/correction/metrics.ts'
import { CorrectionCard } from '../../extension/src/features/correction/ui/CorrectionCard.ts'
import { IntelligentDebouncer } from '../../extension/src/features/correction/debounce.ts'
import { FieldSession } from '../../extension/src/core/session/FieldSession.ts'
import { applyLayoutFix } from '../../extension/src/features/layout/fixCurrentText.ts'
import { STORAGE_KEYS } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { activateTestAccount, clearTestAccountContext } from '../helpers/accountIsolation.ts'

describe('Phase 11 — background history messaging', () => {
  let mockStore: ReturnType<typeof createMockChromeStorage>

  beforeEach(async () => {
    mockStore = createMockChromeStorage()
    mockStore.install()
    resetHistoryServiceForTests()
    resetBackgroundStartupForTests()
    await clearTestAccountContext()
    await activateTestAccount()
    stateManager.settings.enabled = true
    stateManager.settings.excludedDomains = []
    const el = document.createElement('textarea')
    document.body.append(el)
    const service = getHistoryService(flowlaryStorage)
    await service.initialize()
    await service.record({
      operation: 'CORRECT',
      element: el,
      sourceText: 'hello',
      resultText: 'Hello',
      mode: 'automatic',
    })
  })

  afterEach(() => {
    resetHistoryServiceForTests()
    resetBackgroundStartupForTests()
    document.body.innerHTML = ''
  })

  it('GET_HISTORY returns newest-first entries', async () => {
    const response = await handleMessage({ type: 'GET_HISTORY' })
    expect(response.entries).toHaveLength(1)
    expect(response.entries[0]).toMatchObject({ sourceText: 'hello' })
  })

  it('DELETE_HISTORY_ENTRY removes one entry', async () => {
    const listed = await handleMessage({ type: 'GET_HISTORY' })
    const id = listed.entries[0]!.id
    const deleted = await handleMessage({ type: 'DELETE_HISTORY_ENTRY', id })
    expect(deleted.entries).toHaveLength(0)
    const after = await handleMessage({ type: 'GET_HISTORY' })
    expect(after.entries).toHaveLength(0)
  })

  it('CLEAR_HISTORY empties history', async () => {
    const cleared = await handleMessage({ type: 'CLEAR_HISTORY' })
    expect(cleared.entries).toEqual([])
    expect(cleared.stats.total).toBe(0)
  })
})

describe('Phase 11 — feature history integration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHistoryServiceForTests()
    const mockStore = createMockChromeStorage()
    mockStore.install()
    stateManager.settings.excludedDomains = []
  })

  afterEach(() => {
    resetHistoryServiceForTests()
    document.body.innerHTML = ''
  })

  it('successful correction creates history after commit', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello world'
    document.body.append(ta)
    const session = new FieldSession(ta)
    const debouncer = new IntelligentDebouncer(() => undefined)
    const fieldState = {
      debouncer,
      lastSentText: '',
      lastCorrectedFor: '',
      pendingRequestId: null,
      card: null as CorrectionCard | null,
      cardMounted: false,
    }
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    fieldState.card = card

    const result = await commitMergedCorrection(ta, session, 'hello', 'Hello', {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard: () => card,
    })

    expect(result).toBe('committed')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const storage = new FlowlaryStorage()
    const entries = await (await import('../../extension/src/storage/facade.ts')).getHistory(storage)
    expect(entries.some((entry) => entry.operation === 'CORRECT')).toBe(true)
  })

  it('stale correction creates no history', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello world'
    document.body.append(ta)
    const session = new FieldSession(ta)
    const debouncer = new IntelligentDebouncer(() => undefined)
    const fieldState = {
      debouncer,
      lastSentText: '',
      lastCorrectedFor: '',
      pendingRequestId: null,
      card: null as CorrectionCard | null,
      cardMounted: false,
    }
    const card = new CorrectionCard({ highlights: true, onApply: () => undefined, onDismiss: () => undefined })
    fieldState.card = card

    ta.value = 'changed while waiting'
    const result = await commitMergedCorrection(ta, session, 'hello', 'Hello', {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard: () => card,
    })

    expect(result).toBe('stale')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const storage = new FlowlaryStorage()
    const entries = await (await import('../../extension/src/storage/facade.ts')).getHistory(storage)
    expect(entries).toHaveLength(0)
  })

  it('blocked fields do not create history', async () => {
    const input = document.createElement('input')
    input.type = 'password'
    document.body.append(input)
    const service = getHistoryService(new FlowlaryStorage())
    await service.initialize()
    const ok = await service.record({
      operation: 'CORRECT',
      element: input,
      sourceText: 'secret',
      resultText: 'Secret',
    })
    expect(ok).toBe(false)
    const entries = await (await import('../../extension/src/storage/facade.ts')).getHistory(new FlowlaryStorage())
    expect(entries).toHaveLength(0)
  })

  it('successful manual layout fix creates history', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    const session = new FieldSession(ta)
    const acquired = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return

    const written = applyLayoutFix(
      ta,
      session,
      {
        word: 'lvpfh',
        corrected: 'مرحبا',
        start: 0,
        end: 5,
        sourceLayout: 'en-US-qwerty',
        targetLayout: 'ar-101',
      },
      acquired.generation,
      acquired.requestId,
      { historyMode: 'manual' },
    )
    expect(written).toBe(true)
    session.releaseWrite('FIX_LAYOUT', acquired.requestId)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const storage = new FlowlaryStorage()
    const entries = await (await import('../../extension/src/storage/facade.ts')).getHistory(storage)
    expect(entries.some((entry) => entry.operation === 'FIX_LAYOUT')).toBe(true)
  })

  it('failed layout fix creates no history', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    const session = new FieldSession(ta)
    const written = applyLayoutFix(
      ta,
      session,
      {
        word: 'lvpfh',
        corrected: 'مرحبا',
        start: 0,
        end: 5,
        sourceLayout: 'en-US-qwerty',
        targetLayout: 'ar-101',
      },
      999,
      1,
      { historyMode: 'manual' },
    )
    expect(written).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const storage = new FlowlaryStorage()
    const entries = await (await import('../../extension/src/storage/facade.ts')).getHistory(storage)
    expect(entries).toHaveLength(0)
  })
})

describe('Phase 11 — popup history UI', () => {
  it('GET_HISTORY serves data for the history panel', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    resetHistoryServiceForTests()
    resetBackgroundStartupForTests()
    await clearTestAccountContext()
    await activateTestAccount()
    const { buildAccountScopedKey } = await import('../../extension/src/storage/accountScopedStorage.ts')
    const { TEST_ACCOUNT_A } = await import('../helpers/accountIsolation.ts')
    mockStore.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'history')] = {
      version: 1,
      entries: [
        {
          id: '1',
          operation: 'TRANSLATE',
          timestamp: Date.now(),
          sourceText: 'hello',
          resultText: 'مرحبا',
          metadata: { mode: 'manual', sourceLanguage: 'en', targetLanguage: 'ar' },
        },
      ],
      legacyImported: true,
      _v: 1,
    }
    const response = await handleMessage({ type: 'GET_HISTORY' })
    expect(response.entries).toHaveLength(1)
    expect(response.entries[0]?.sourceText).toBe('hello')
    expect(response.entries[0]?.resultText).toBe('مرحبا')
  })
})
