import { beforeEach, describe, expect, it } from 'vitest'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'
import {
  EntitlementService,
  resetEntitlementServiceForTests,
} from '../../../extension/src/entitlement/service.ts'
import { FlowlaryStorage } from '../../../extension/src/storage/index.ts'
import { createDefaultEntitlement } from '../../../extension/src/storage/entitlement.ts'

describe('EntitlementService', () => {
  beforeEach(() => {
    resetEntitlementServiceForTests()
  })

  it('denies translation when plan is unknown', async () => {
    const mock = createMockChromeStorage()
    mock.install()
    const storage = new FlowlaryStorage()
    const entitlement = createDefaultEntitlement()
    entitlement.usage.usageBalanceMs = 0
    entitlement.usage.firstActivatedAt = Date.now() - 30 * 24 * 60 * 60 * 1000
    entitlement.usage.trialEndsAt = entitlement.usage.firstActivatedAt + 7 * 24 * 60 * 60 * 1000
    await storage.set(storage.keys.entitlement, entitlement, 'local')

    const service = new EntitlementService(storage)
    const access = await service.canUseFeature('translation')
    expect(access.allowed).toBe(false)
  })

  it('allows translation during trial', async () => {
    const mock = createMockChromeStorage()
    mock.install()
    const storage = new FlowlaryStorage()
    await storage.set(storage.keys.entitlement, createDefaultEntitlement(), 'local')

    const service = new EntitlementService(storage)
    const access = await service.canUseFeature('translation')
    expect(access.allowed).toBe(true)
  })
})
