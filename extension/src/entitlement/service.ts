import {
  evaluateFeatureAccess,
  featureAccessErrorCode,
  type EntitlementFeature,
  type FeatureAccessResult,
} from '@flowlary/shared'
import {
  resolveEntitlementStatus,
  type FlowlaryEntitlement,
} from '../storage/entitlement.ts'
import { getEntitlement, getLicenseKey } from '../storage/facade.ts'
import type { FlowlaryStorage } from '../storage/index.ts'

export type EntitlementSnapshot = {
  tier: ReturnType<typeof resolveEntitlementStatus>
  remainingMs: number
  isPro: boolean
  inTrial: boolean
  hasLicenseKey: boolean
}

export class EntitlementService {
  constructor(private readonly storage: FlowlaryStorage) {}

  async loadEntitlement(now = Date.now()): Promise<FlowlaryEntitlement> {
    return getEntitlement(this.storage, now)
  }

  async getSnapshot(now = Date.now()): Promise<EntitlementSnapshot> {
    const entitlement = await this.loadEntitlement(now)
    const tier = resolveEntitlementStatus(entitlement, now)
    return {
      tier,
      remainingMs: entitlement.usage.usageBalanceMs,
      isPro: tier === 'pro',
      inTrial: tier === 'trial',
      hasLicenseKey: Boolean((await getLicenseKey(this.storage)).trim()),
    }
  }

  async canUseFeature(feature: EntitlementFeature, now = Date.now()): Promise<FeatureAccessResult> {
    const entitlement = await this.loadEntitlement(now)
    const tier = resolveEntitlementStatus(entitlement, now)
    return evaluateFeatureAccess(feature, tier, {
      usageBalanceMs: entitlement.usage.usageBalanceMs,
    })
  }

  async assertFeature(feature: EntitlementFeature, now = Date.now()): Promise<FeatureAccessResult> {
    return this.canUseFeature(feature, now)
  }

  async getPlan(now = Date.now()) {
    return this.getSnapshot(now)
  }

  async isTrial(now = Date.now()): Promise<boolean> {
    const snapshot = await this.getSnapshot(now)
    return snapshot.inTrial
  }

  async isExpired(now = Date.now()): Promise<boolean> {
    const snapshot = await this.getSnapshot(now)
    return snapshot.tier === 'unknown'
  }

  errorCodeFor(result: FeatureAccessResult): string {
    return featureAccessErrorCode(result)
  }
}

let service: EntitlementService | null = null

export function getEntitlementService(storage: FlowlaryStorage): EntitlementService {
  if (!service) service = new EntitlementService(storage)
  return service
}

export function resetEntitlementServiceForTests(): void {
  service = null
}
