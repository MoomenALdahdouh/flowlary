import { STORAGE_KEYS } from '@flowlary/shared'
import {
  activeAccountContext,
  attachActiveAccount,
  flowlaryStorage,
  resetHistoryServiceForTests,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'

/** Stable fake server account ids for tests (UUID-shaped). */
export const TEST_ACCOUNT_A = '11111111-1111-4111-8111-111111111111'
export const TEST_ACCOUNT_B = '22222222-2222-4222-8222-222222222222'

/**
 * Activate an authenticated account context for storage tests.
 * Does not create JWT tokens — only local ownership context.
 */
export async function activateTestAccount(accountId: string = TEST_ACCOUNT_A): Promise<void> {
  await attachActiveAccount(flowlaryStorage, accountId)
}

export async function clearTestAccountContext(): Promise<void> {
  activeAccountContext.resetForTests()
  await flowlaryStorage.remove(STORAGE_KEYS.authAccountId, 'local')
  resetHistoryServiceForTests()
  resetLearningEventServiceForTests()
  resetPracticeSessionStoreForTests()
}
