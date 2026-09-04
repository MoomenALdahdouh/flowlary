import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/index.tsx'
import { AccountPage } from '../pages/Account.tsx'

vi.mock('../account/client.ts', async () => {
  const actual = await vi.importActual<typeof import('../account/client.ts')>('../account/client.ts')
  return {
    ...actual,
    loadWebAccount: vi.fn(async () => ({ ok: false, error: null })),
    fetchBillingConfig: vi.fn(async () => null),
    loginWebAccount: vi.fn(),
    registerWebAccount: vi.fn(),
    logoutWebAccount: vi.fn(),
    hasStoredWebSession: vi.fn(() => false),
  }
})

function renderAccount(path = '/account') {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <AccountPage />
      </I18nProvider>
    </MemoryRouter>,
  )
}

describe('Account auth UI', () => {
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('does not show a service-unavailable alert before a failed request', () => {
    const html = renderAccount('/account?mode=register')
    expect(html).toContain('Create your')
    expect(html).toContain('account')
    expect(html).toContain('Free to start. No credit card required.')
    expect(html).toContain('Free to start')
    expect(html).not.toContain('temporarily unavailable')
    expect(html).not.toContain('We couldn’t connect')
    expect(html).not.toMatch(/role="alert"/)
  })

  it('requires matching passwords on registration', () => {
    const html = renderAccount('/account?mode=register')
    expect(html).toContain('Confirm password')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('id="ac-email" disabled')
    expect(html).not.toContain('id="ac-password" disabled')
  })

  it('renders a focused login form with password toggle', () => {
    const html = renderAccount('/account')
    expect(html).toContain('Welcome ')
    expect(html).toContain('xp-gradient-text')
    expect(html).toContain('back</span>')
    expect(html).toContain('type="password"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('Create account')
    expect(html).toContain('Sign in')
    expect(html).toContain('href="/guide"')
    expect(html).toContain('href="/pricing"')
    expect(html).not.toContain('Chrome extension')
  })

  it('keeps registration usable without a companion card', () => {
    const html = renderAccount('/account?mode=register')
    expect(html).toContain('type="submit"')
    expect(html).toContain('Already have an account? Sign in')
    expect(html).toContain('No credit card required')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('href="/terms"')
    expect(html).toContain('What this account unlocks')
    expect(html).toContain('Repeat your password')
    expect(html).toContain('Tick the box above to create your account.')
    expect(html).not.toContain('oversized')
    expect(html).not.toContain('>or<')
  })
})
