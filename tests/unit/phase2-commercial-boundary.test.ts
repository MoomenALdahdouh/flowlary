import { beforeEach, describe, expect, it } from "vitest"
import {
  BRAND,
  FREE_DAILY_CREDITS,
  buildCacheKey,
  capabilitiesForPlan,
  evaluateFeatureAccess,
  resolveUsageUx,
} from "@flowlary/shared"
import { computeFeatureStatus, isAiCreditLocked } from "../../extension/src/popup/status.ts"
import { computeDomainState } from "../../extension/src/ui/domainState.ts"
import { activeAccountContext } from "../../extension/src/storage/activeAccountContext.ts"
import type { ExtensionStatus } from "../../extension/src/messaging/types.ts"
import {
  canAccessTranslation,
  resolveTranslationStrategy,
} from "../../backend/src/providers/translationRouter.ts"
import type { AuthContext } from "../../backend/src/middleware/auth.ts"
import type { AppConfig } from "../../backend/src/config/env.ts"
function baseStatus(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    brand: BRAND,
    active: true,
    features: { correction: true, translation: true, layout: true },
    translation: { mode: "direct", liveEnabled: true, shortcutEnabled: true, sourceLanguage: "ar", targetLanguage: "en" },
    correction: { enabled: true, mode: "direct", highlights: true, consentAccepted: true, aiReady: true },
    entitlement: {
      status: "free",
      hasLicenseKey: false,
      isPro: false,
      inTrial: false,
      trialEndsAt: null,
      remainingMs: 0,
      creditsRemaining: 0,
      creditsUsed: FREE_DAILY_CREDITS,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 3_600_000,
      monthlyCreditsUsed: 0,
      monthlySoftCap: null,
      capabilities: [
        "ai.translation",
        "ai.liveTranslation",
        "keyboard.unlimited",
        "speedbox.unlimited",
        "local.spellAssist",
        "learning.basic",
        "activity.basic",
      ],
    },
    account: {
      signedIn: true,
      accountId: "11111111-1111-4111-8111-111111111111",
      email: "free@flowlary.com",
      serverPlan: "free",
      billingAvailable: false,
      subscriptionStatus: null,
      cancelAtPeriodEnd: false,
      paymentFailed: false,
      currentPeriodEnd: null,
    },
    apiHealth: "ok",
    layout: {
      mode: "direct",
      autoEnabled: true,
      manualConversionEnabled: true,
      directShortcutEnabled: true,
      sourceLayout: "en",
      targetLayouts: ["ar"],
    },
    learning: {
      onboardingCompleted: true,
      showFullOnboarding: false,
      showSetupPrompt: false,
      onboardingStep: null,
      summary: null,
    },
    version: "1.0.0",
    ...overrides,
  }
}

function auth(partial: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    accountId: "acct-1",
    sessionId: "sess-1",
    installId: "install-1",
    rateLimitTier: "free",
    allowed: true,
    clientClaim: null,
    authKind: "account",
    ...partial,
  }
}

const googleConfig = {
  translationForceProvider: "auto",
  googleTranslateEnabled: true,
  googleTranslateApiKey: "test-key",
} as AppConfig

describe("Phase 2 — commercial boundary", () => {
  beforeEach(() => {
    activeAccountContext.resetForTests()
  })

  it("Free @ 0 credits: layout + Google translation ready; AI correction locked", () => {
    const status = baseStatus()
    expect(isAiCreditLocked(status)).toBe(true)
    const features = computeFeatureStatus(status)
    expect(features.layout).toBe("ready")
    expect(features.translation).toBe("ready")
    expect(features.liveTranslation).toBe("ready")
    expect(features.correction).toBe("locked")
    const domain = computeDomainState(status, false)
    expect(domain?.features.layout.kind).toBe("ready")
    expect(domain?.features.translation.kind).toBe("ready")
    expect(domain?.features.correction.kind).toBe("locked")
  })

  it("capabilities keep Google translation when Free credits are exhausted", () => {
    const caps = capabilitiesForPlan("free", { creditsRemaining: 0 })
    expect(caps.has("ai.translation")).toBe(true)
    expect(caps.has("ai.liveTranslation")).toBe(true)
    expect(caps.has("ai.correction")).toBe(false)
    expect(caps.has("keyboard.unlimited")).toBe(true)
  })

  it("evaluateFeatureAccess allows translation at 0 credits; denies correction", () => {
    const caps = [...capabilitiesForPlan("free", { creditsRemaining: 0 })]
    expect(evaluateFeatureAccess("translation", "free", { creditsRemaining: 0, capabilities: caps }).allowed).toBe(true)
    expect(evaluateFeatureAccess("correction", "free", { creditsRemaining: 0, capabilities: caps }).allowed).toBe(false)
    expect(evaluateFeatureAccess("layout_auto", "free", { creditsRemaining: 0, capabilities: caps }).allowed).toBe(true)
  })

  it("backend allows Google when usage_exhausted; denies pure Groq", () => {
    const exhausted = auth({ allowed: false, denyReason: "usage_exhausted", rateLimitTier: "free" })
    expect(canAccessTranslation(exhausted, "google")).toBe(true)
    expect(canAccessTranslation(exhausted, "groq")).toBe(false)
    expect(resolveTranslationStrategy(googleConfig, exhausted, "live")).toBe("google")
    expect(resolveTranslationStrategy(googleConfig, exhausted, "shortcut")).toBe("google")
  })

  it("Pro shortcut and live resolve groq (LLM translator)", () => {
    const pro = auth({ rateLimitTier: "pro", allowed: true })
    expect(resolveTranslationStrategy(googleConfig, pro, "shortcut")).toBe("groq")
    expect(resolveTranslationStrategy(googleConfig, pro, "live")).toBe("groq")
  })

  it("usage UX notes Google Translation remains available when AI exhausted", () => {
    const view = resolveUsageUx({
      signedIn: true,
      apiHealth: "ok",
      isPro: false,
      inTrial: false,
      creditsRemaining: 0,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 3_600_000,
    })
    expect(view.state).toBe("AI_USAGE_EXHAUSTED")
    expect(view.localToolsNote ?? "").toMatch(/Google Translation/i)
  })

  it("active account generation invalidates prior write guards", () => {
    activeAccountContext.activate("acct_aaaaaaa")
    const snapA = activeAccountContext.snapshot()
    expect(activeAccountContext.matches(snapA)).toBe(true)
    activeAccountContext.activate("acct_bbbbbbb")
    expect(activeAccountContext.matches(snapA)).toBe(false)
  })

  it("AI cache keys do not collide across accounts or strategies", () => {
    const a = buildCacheKey({
      operation: "TRANSLATE",
      text: "same",
      sourceLanguage: "en",
      targetLanguage: "ar",
      translationStrategy: "google",
      accountId: "acct_a",
    })
    const b = buildCacheKey({
      operation: "TRANSLATE",
      text: "same",
      sourceLanguage: "en",
      targetLanguage: "ar",
      translationStrategy: "google",
      accountId: "acct_b",
    })
    const refined = buildCacheKey({
      operation: "TRANSLATE",
      text: "same",
      sourceLanguage: "en",
      targetLanguage: "ar",
      translationStrategy: "google_then_groq",
      accountId: "acct_a",
    })
    expect(a).not.toBe(b)
    expect(a).not.toBe(refined)
  })
})
