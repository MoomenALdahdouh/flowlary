import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { BRAND, FREE_DAILY_CREDITS } from '@flowlary/shared'
import { HomeView } from '../../../extension/src/popup/views/HomeView.tsx'
import { getShortcutLabels } from '../../../extension/src/popup/shortcuts.ts'
import { computeDomainState } from '../../../extension/src/ui/domainState.ts'
import type { ExtensionStatus } from '../../../extension/src/messaging/types.ts'

function baseStatus(overrides: Partial<ExtensionStatus> = {}): ExtensionStatus {
  return {
    brand: BRAND,
    active: true,
    features: { correction: true, translation: true, layout: true },
    translation: {
      mode: 'direct',
      liveEnabled: false,
      shortcutEnabled: true,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    },
    correction: {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
      aiReady: true,
    },
    entitlement: {
      status: 'free',
      hasLicenseKey: false,
      isPro: false,
      inTrial: false,
      trialEndsAt: null,
      remainingMs: FREE_DAILY_CREDITS,
      creditsRemaining: FREE_DAILY_CREDITS,
      creditsUsed: 0,
      dailyLimit: FREE_DAILY_CREDITS,
      resetAt: Date.now() + 3_600_000,
      monthlyCreditsUsed: 0,
      monthlySoftCap: null,
      capabilities: [
        'ai.correction',
        'ai.translation',
        'ai.liveTranslation',
        'ai.layoutClassify',
        'keyboard.unlimited',
        'speedbox.unlimited',
      ],
    },
    account: {
      signedIn: true,
      accountId: '11111111-1111-4111-8111-111111111111',
      email: 'user@flowlary.com',
      serverPlan: 'free',
      billingAvailable: false,
      subscriptionStatus: null,
      cancelAtPeriodEnd: false,
      paymentFailed: false,
      currentPeriodEnd: null,
    },
    apiHealth: 'ok',
    layout: {
      mode: 'direct',
      autoEnabled: true,
      manualConversionEnabled: true,
      directShortcutEnabled: true,
      sourceLayout: 'en',
      targetLayouts: ['ar'],
    },
    writingPolicy: {
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
      polishAfterTranslate: true,
      aiAdvisorEnabled: true,
      aiWritingReviewEnabled: true,
      operatingState: 'normal',
    },
    learning: {
      onboardingCompleted: true,
      showFullOnboarding: false,
      showSetupPrompt: false,
      onboardingStep: null,
      summary: null,
    },
    version: '1.0.0',
    ...overrides,
  }
}

async function renderHome(status: ExtensionStatus, handlers?: {
  onDispatchLayout?: () => void
  onDispatchTranslate?: () => void
  onDispatchCorrect?: () => void
}) {
  const domain = computeDomainState(status, false)!
  const container = document.createElement('div')
  document.body.append(container)
  const onDispatchLayout = handlers?.onDispatchLayout ?? vi.fn()
  const onDispatchTranslate = handlers?.onDispatchTranslate ?? vi.fn()
  const onDispatchCorrect = handlers?.onDispatchCorrect ?? vi.fn()

  await act(async () => {
    createRoot(container).render(
      <HomeView
        status={status}
        domain={domain}
        loading={false}
        busy={null}
        onGlobalToggle={vi.fn()}
        onDispatchCorrect={onDispatchCorrect}
        onDispatchTranslate={onDispatchTranslate}
        onDispatchLayout={onDispatchLayout}
        showSignInBanner={false}
      />,
    )
  })

  return {
    container,
    onDispatchLayout,
    onDispatchTranslate,
    onDispatchCorrect,
    cleanup: () => container.remove(),
  }
}

function actionButton(container: HTMLElement, kind: 'layout' | 'translation' | 'correction') {
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button.fl-zip-action'))
  const index = kind === 'layout' ? 0 : kind === 'translation' ? 1 : 2
  return buttons[index]!
}

describe('HomeView tool shortcut rows', () => {
  it('shows Layout, Translate, and Fix shortcuts from getShortcutLabels', async () => {
    const shortcuts = getShortcutLabels()
    const { container, cleanup } = await renderHome(baseStatus())

    const layout = actionButton(container, 'layout')
    const translate = actionButton(container, 'translation')
    const fix = actionButton(container, 'correction')

    expect(layout.querySelector('.fl-kbd')?.textContent).toBe(shortcuts.fixLayout)
    expect(translate.querySelector('.fl-kbd')?.textContent).toBe(shortcuts.translate)
    expect(fix.querySelector('.fl-kbd')?.textContent).toBe(shortcuts.fixWriting)

    expect(layout.textContent).toContain('Layout')
    expect(translate.textContent).toContain('Translate')
    expect(fix.textContent).toContain('Fix')

    // Shortcut is primary right-side content — not a bare Off label.
    expect(layout.querySelector('.fl-kbd')).toBeTruthy()
    expect(layout.textContent).not.toMatch(/^Layout\s*Off$/)

    cleanup()
  })

  it('keeps Layout shortcut visible when Layout is disabled', async () => {
    const shortcuts = getShortcutLabels()
    const { container, cleanup } = await renderHome(
      baseStatus({
        features: { correction: true, translation: true, layout: false },
        writingPolicy: {
          helpStyle: 'shortcuts_only',
          fixWrongTyping: false,
          improveEnglish: true,
          arabicToEnglishMode: false,
          polishAfterTranslate: true,
          aiAdvisorEnabled: true,
          aiWritingReviewEnabled: true,
          operatingState: 'normal',
        },
        layout: {
          mode: 'direct',
          autoEnabled: false,
          manualConversionEnabled: false,
          directShortcutEnabled: false,
          sourceLayout: 'en',
          targetLayouts: ['ar'],
        },
      }),
    )

    const layout = actionButton(container, 'layout')
    expect(layout.classList.contains('is-off')).toBe(true)
    expect(layout.disabled).toBe(true)
    expect(layout.querySelector('.fl-kbd')?.textContent).toBe(shortcuts.fixLayout)
    expect(layout.querySelector('.fl-zip-action-state')?.textContent).toMatch(/off/i)
    expect(layout.getAttribute('aria-label')).toContain(shortcuts.fixLayout)

    cleanup()
  })

  it('dispatches the matching tool command when a row is clicked', async () => {
    const { container, onDispatchLayout, onDispatchTranslate, onDispatchCorrect, cleanup } =
      await renderHome(baseStatus())

    await act(async () => {
      actionButton(container, 'layout').click()
      actionButton(container, 'translation').click()
      actionButton(container, 'correction').click()
    })

    expect(onDispatchLayout).toHaveBeenCalledTimes(1)
    expect(onDispatchTranslate).toHaveBeenCalledTimes(1)
    expect(onDispatchCorrect).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('does not dispatch Layout when the feature is off', async () => {
    const onDispatchLayout = vi.fn()
    const { container, cleanup } = await renderHome(
      baseStatus({
        features: { correction: true, translation: true, layout: false },
        writingPolicy: {
          helpStyle: 'shortcuts_only',
          fixWrongTyping: false,
          improveEnglish: true,
          arabicToEnglishMode: false,
          polishAfterTranslate: true,
          aiAdvisorEnabled: true,
          aiWritingReviewEnabled: true,
          operatingState: 'normal',
        },
      }),
      { onDispatchLayout },
    )

    await act(async () => {
      actionButton(container, 'layout').click()
    })

    expect(onDispatchLayout).not.toHaveBeenCalled()
    cleanup()
  })
})
