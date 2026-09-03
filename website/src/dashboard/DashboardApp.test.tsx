import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/index.tsx'
import { DashboardApp } from './DashboardApp.tsx'
import type { WebAccountView } from '../account/client.ts'
import type { WebLearningBundle } from './services/learningData.ts'
import { createDefaultLearningProfile } from '@flowlary/shared'

const hookState = vi.hoisted(() => ({
  bundle: null as WebLearningBundle | null,
  loading: false,
  error: false,
  refresh: async () => {},
}))

vi.mock('./useWebLearningBundle.ts', () => ({
  useWebLearningBundle: () => hookState,
}))

vi.mock('../account/extensionBridge.ts', () => ({
  probeExtensionBridge: async () => false,
  syncStoredSessionToExtension: () => {},
}))

const account: WebAccountView = {
  id: 'acct-1',
  email: 'user@flowlary.com',
  emailVerified: true,
  plan: 'free',
  status: 'active',
  inTrial: false,
  isPro: false,
  remainingMs: 0,
  billingAvailable: false,
}

const emptyBundle: WebLearningBundle = {
  store: { version: 1, events: [], samples: [] },
  profile: createDefaultLearningProfile(),
  practiceStore: { version: 1, sessions: [] },
}

function renderDashboard(hash = '#overview') {
  window.location.hash = hash
  return renderToString(
    <MemoryRouter>
      <I18nProvider>
        <DashboardApp
        account={account}
        entitlement={null}
        planState="free"
        planLabel="Free"
        isPro={false}
        studentProActive={false}
        inTrial={false}
        trialDays={null}
        checkoutReady={false}
        portalReady={false}
        activating={false}
        billingBusy={null}
        billingMessage={null}
        proPriceLabel={null}
        creditsRemaining={500}
        creditsUsed={0}
        dailyLimit={500}
        usagePercent={0}
        resetIn={null}
        onLogout={() => {}}
        onUpgrade={() => {}}
        onManageBilling={() => {}}
        onRefreshAccount={() => {}}
      />
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe('DashboardApp learning loading', () => {
  beforeEach(() => {
    hookState.bundle = null
    hookState.loading = false
    hookState.error = false
  })

  afterEach(() => {
    window.location.hash = ''
  })

  it('renders Account immediately without waiting on learning', () => {
    hookState.loading = true
    hookState.bundle = null
    const html = renderDashboard('#account')
    expect(html).toContain('user@flowlary.com')
    expect(html).toContain('Profile')
    expect(html).not.toContain('aria-busy="true"')
  })

  it('renders Settings immediately without waiting on learning', () => {
    hookState.loading = true
    hookState.bundle = null
    const html = renderDashboard('#settings')
    expect(html).toContain('Learning settings')
    expect(html).not.toContain('aria-busy="true"')
  })

  it('shows a bounded skeleton on Overview only while loading', () => {
    hookState.loading = true
    hookState.bundle = null
    const html = renderDashboard('#overview')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('wd-skeleton')
  })

  it('does not stay on skeleton when learning fails', () => {
    hookState.loading = false
    hookState.error = true
    hookState.bundle = null
    const html = renderDashboard('#overview')
    expect(html).not.toContain('aria-busy="true"')
    expect(html).toContain('Something went wrong. Try again.')
    expect(html).toContain('Try again')
  })

  it('renders Overview when remote learning succeeds', () => {
    hookState.loading = false
    hookState.bundle = emptyBundle
    const html = renderDashboard('#overview')
    expect(html).toContain('Overview')
    expect(html).not.toContain('wd-skeleton')
  })

  it('shows retry without pretending remote success when data is degraded', () => {
    hookState.loading = false
    hookState.error = true
    hookState.bundle = emptyBundle
    const html = renderDashboard('#overview')
    expect(html).toContain('Something went wrong. Try again.')
    expect(html).toContain('Overview')
  })
})
