import { STORAGE_KEYS } from '@flowlary/shared'
import type { MockChromeStorage } from './mockChromeStorage.ts'

const TEST_INSTALL_ID = '11111111-1111-1111-1111-111111111111'
const TEST_INSTALL_TOKEN = 'a'.repeat(64)

export function seedFlowlaryInstallAuth(store: MockChromeStorage): void {
  store.local[STORAGE_KEYS.authInstallId] = { value: TEST_INSTALL_ID, _v: 1 }
  store.local[STORAGE_KEYS.authInstallToken] = { value: TEST_INSTALL_TOKEN, _v: 1 }
}
