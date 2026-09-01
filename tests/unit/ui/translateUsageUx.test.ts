import { describe, expect, it } from 'vitest'
import { FREE_DAILY_CREDITS, resolveUsageUx } from '@flowlary/shared'
import { translateUsageUxView } from '../../../extension/src/ui/translateUsageUx.ts'
import { setLocaleForTests } from '../../../extension/src/popup/i18n/I18nProvider.tsx'

describe('usage UX localization', () => {
  it('localizes exhaustion copy in Arabic launch locale', () => {
    setLocaleForTests('ar')
    const view = resolveUsageUx({
      signedIn: true,
      isPro: false,
      inTrial: false,
      creditsRemaining: 0,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 60_000,
    })
    const localized = translateUsageUxView(view)
    expect(localized.title).toMatch(/[\u0600-\u06FF]/)
    expect(localized.title).not.toBe(view.title)
  })

  it('does not look up localTools when shared view has no localToolsNote', () => {
    setLocaleForTests('en')
    const view = resolveUsageUx({
      signedIn: true,
      isPro: false,
      inTrial: true,
      trialEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      creditsRemaining: FREE_DAILY_CREDITS,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 60_000,
    })
    expect(view.state).toBe('AI_TRIAL_ACTIVE')
    expect(view.localToolsNote).toBeNull()
    const localized = translateUsageUxView(view)
    expect(localized.localToolsNote).toBeNull()
  })

  it('keeps English copy for non-launch locales', () => {
    setLocaleForTests('de')
    const view = resolveUsageUx({
      signedIn: true,
      isPro: false,
      inTrial: false,
      creditsRemaining: 0,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 60_000,
    })
    const localized = translateUsageUxView(view)
    expect(localized.title).toBe("You've used today's AI writing checks")
  })
})
