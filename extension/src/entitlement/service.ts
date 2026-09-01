import {
  evaluateFeatureAccess,
  featureAccessErrorCode,
  hasProProductExperience,
  type EntitlementFeature,
  type FeatureAccessResult,
} from '@flowlary/shared'
import {
  resolveEntitlementStatus,
  type FlowlaryEntitlement,
} from '../storage/entitlement.ts'
import { getEntitlement, getLicenseKey } from '../storage/facade.ts'
import type { FlowlaryStorage } from '../storage/index.ts'
import { readAccountSession, readServerEntitlementCache } from '../config/accountAuth.ts'

export type EntitlementSnapshot = {
  tier: ReturnType<typeof resolveEntitlementStatus>
  remainingMs: number
  creditsRemaining: number
  dailyLimit: number
  resetAt: number
  capabilities: string[]
  isPro: boolean
  inTrial: boolean
  studentProActive: boolean
  hasLicenseKey: boolean
  signedIn: boolean
}

export class EntitlementService {
  constructor(private readonly storage: FlowlaryStorage) {}

  async loadEntitlement(now = Date.now()): Promise<FlowlaryEntitlement> {
    return getEntitlement(this.storage, now)
  }

  async getSnapshot(now = Date.now()): Promise<EntitlementSnapshot> {
    const entitlement = await this.loadEntitlement(now)
    const account = await readAccountSession(this.storage)
    const server = account ? await readServerEntitlementCache(this.storage) : null
    if (account) {
      if (server) {
        const tier = (server.isPro || server.studentProActive
          ? 'pro'
          : server.inTrial
            ? 'trial'
            : server.plan === 'free' || server.plan === 'trial' || server.plan === 'pro'
              ? server.plan
              : 'unknown') as ReturnType<typeof resolveEntitlementStatus>
        return {
          tier,
          remainingMs: server.remainingMs,
          creditsRemaining: server.creditsRemaining,
          dailyLimit: server.dailyLimit,
          resetAt: server.resetAt,
          capabilities: server.capabilities,
          isPro: server.isPro,
          inTrial: server.inTrial && !server.isPro,
          studentProActive: server.studentProActive,
          hasLicenseKey: false,
          signedIn: true,
        }
      }
      const tier = resolveEntitlementStatus(entitlement, now)
      return {
        tier: tier === 'unknown' ? 'trial' : tier,
        remainingMs: 0,
        creditsRemaining: 0,
        dailyLimit: 0,
        resetAt: 0,
        capabilities: [],
        isPro: false,
        inTrial: true,
        studentProActive: false,
        hasLicenseKey: Boolean((await getLicenseKey(this.storage)).trim()),
        signedIn: true,
      }
    }
    const tier = resolveEntitlementStatus(entitlement, now)
    return {
      tier,
      remainingMs: 0,
      creditsRemaining: 0,
      dailyLimit: 0,
      resetAt: 0,
      capabilities: [],
      isPro: false,
      inTrial: false,
      studentProActive: false,
      hasLicenseKey: Boolean((await getLicenseKey(this.storage)).trim()),
      signedIn: false,
    }
  }

  async canUseFeature(feature: EntitlementFeature, now = Date.now()): Promise<FeatureAccessResult> {
    const snapshot = await this.getSnapshot(now)
    if (
      feature === 'correction' ||
      feature === 'translation' ||
      feature === 'live_translation' ||
      feature === 'layout_ai' ||
      feature === 'practice'
    ) {
      if (!snapshot.signedIn) {
        return { allowed: false, tier: 'unknown', reason: 'account_required' }
      }
    }
    return evaluateFeatureAccess(feature, snapshot.tier, {
      creditsRemaining: snapshot.creditsRemaining,
      capabilities: snapshot.capabilities as never,
      signedIn: snapshot.signedIn,
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

  async hasProExperience(now = Date.now()): Promise<boolean> {
    const snapshot = await this.getSnapshot(now)
    return hasProProductExperience(snapshot)
  }

  async isExpired(now = Date.now()): Promise<boolean> {
    const snapshot = await this.getSnapshot(now)
    return snapshot.tier === 'unknown' || (!snapshot.signedIn && snapshot.tier !== 'pro')
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
