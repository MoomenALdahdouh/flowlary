import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LAYOUT_PRACTICE_SESSION_VERSION } from '@flowlary/shared'
import {
  createLayoutPracticeSessionId,
  getLayoutPracticeSessionStore,
  normalizeLayoutPracticeSessionStore,
} from '../../../extension/src/storage/layoutPractice/sessions.ts'
import { buildAccountScopedKey } from '../../../extension/src/storage/accountScopedStorage.ts'
import { flowlaryStorage } from '../../../extension/src/storage/index.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
} from '../../helpers/accountIsolation.ts'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'

describe('layout practice sessions', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    await clearTestAccountContext()
  })

  afterEach(async () => {
    await clearTestAccountContext()
  })

  it('sanitizes malformed stored sessions', () => {
    const normalized = normalizeLayoutPracticeSessionStore({
      version: 1,
      sessions: [{ id: 'bad' }, null, { id: 'ok', startedAt: 1, sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' }],
    })
    expect(normalized.sessions).toHaveLength(1)
    expect(normalized.sessions[0]?.id).toBe('ok')
  })

  it('isolates sessions by account', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    const sessionStore = getLayoutPracticeSessionStore(flowlaryStorage)
    await sessionStore.saveSession({
      id: createLayoutPracticeSessionId(),
      version: LAYOUT_PRACTICE_SESSION_VERSION,
      startedAt: Date.now(),
      completedAt: Date.now(),
      sourceLayout: 'ar-101',
      targetLayout: 'en-US-qwerty',
      itemsAttempted: 10,
      itemsCorrect: 8,
      itemsIncorrect: 2,
      status: 'completed',
    })

    const keyA = buildAccountScopedKey(TEST_ACCOUNT_A, 'layoutPracticeSessions')
    expect(await flowlaryStorage.get(keyA, 'local')).toBeTruthy()

    await activateTestAccount(TEST_ACCOUNT_B)
    const keyB = buildAccountScopedKey(TEST_ACCOUNT_B, 'layoutPracticeSessions')
    expect(await flowlaryStorage.get(keyB, 'local')).toBeUndefined()
  })
})
