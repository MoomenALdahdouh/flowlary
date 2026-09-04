import { test, expect, type Page } from '@playwright/test'

const PUBLIC_PAGES: { path: string; heading: RegExp }[] = [
  { path: '/', heading: /Write where you are/i },
  { path: '/product', heading: /How Flowlary works as one product/i },
  { path: '/features', heading: /What Flowlary helps with/i },
  { path: '/features/keyboard-layout', heading: /Keyboard layout repair/i },
  { path: '/features/writing-correction', heading: /English writing help/i },
  { path: '/features/translation', heading: /Translation/i },
  { path: '/features/live-translation', heading: /Live translation/i },
  { path: '/features/speed-box', heading: /Speed Box/i },
  { path: '/try', heading: /Try/i },
  { path: '/lab', heading: /Practice with live AI correction/i },
  { path: '/guide', heading: /Get started with Flowlary/i },
  { path: '/pricing', heading: /Choose the way you want to use Flowlary/i },
  { path: '/about', heading: /Writing tools that stay where you work/i },
  { path: '/blog', heading: /Bilingual writing life/i },
  { path: '/support', heading: /How can we help/i },
  { path: '/contact', heading: /Contact Flowlary/i },
  { path: '/feedback', heading: /Tell us what to improve/i },
  { path: '/privacy', heading: /Privacy Policy/i },
  { path: '/terms', heading: /Terms of Service/i },
  { path: '/cookies', heading: /Cookie Policy/i },
  { path: '/account', heading: /Welcome/i },
  { path: '/account/forgot-password', heading: /Reset your password/i },
  { path: '/account/reset-password', heading: /Choose a new password/i },
]

async function acceptCookies(page: Page) {
  const accept = page.locator('.fl-cookie-accept')
  if (await accept.isVisible().catch(() => false)) {
    await accept.click()
    await expect(accept).toHaveCount(0)
  }
}

async function collectPageIssues(page: Page) {
  return page.evaluate(() => {
    const problems: string[] = []
    const buttons = [...document.querySelectorAll('button, a[href], [role="button"]')] as HTMLElement[]
    for (const el of buttons) {
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()
      if (el instanceof HTMLAnchorElement && (el.getAttribute('href') === '#' || el.getAttribute('href') === '')) {
        problems.push(`empty href: ${name || el.className}`)
      }
    }
    const images = [...document.querySelectorAll('img')] as HTMLImageElement[]
    for (const img of images) {
      if (!img.getAttribute('alt') && img.getAttribute('role') !== 'presentation') {
        problems.push(`img missing alt: ${img.src.slice(-40)}`)
      }
    }
    return problems.filter((item) => item.startsWith('empty href') || item.startsWith('img missing alt'))
  })
}

test.describe('website user journey', () => {
  test('a first-time visitor can understand and use every public page', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: /Skip to content/i })).toBeAttached()
    await acceptCookies(page)

    await expect(page.getByRole('link', { name: /Add to Chrome/i }).first()).toBeVisible()
    await expect(page.getByRole('navigation', { name: /Primary/i })).toBeVisible()

    await page.getByRole('button', { name: /Color theme|System theme|Light theme|Dark theme/i }).click()
    await page.getByRole('option', { name: /Light theme/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: /Light theme/i }).click()
    await page.getByRole('option', { name: /Dark theme/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('group', { name: /Language/i }).getByRole('button', { name: 'AR' }).click()
    await expect(page.locator('#content')).toBeVisible()
    await expect(page.locator('body')).toContainText(/اكتب|فلو|كروم|المساعدة/)
    await page.getByRole('group', { name: /Language|اللغة/ }).getByRole('button', { name: 'EN' }).click()

    const nav = page.getByRole('navigation', { name: /Primary/i })
    await nav.getByRole('link', { name: /^Features$/ }).hover()
    await expect(nav.getByRole('link', { name: /Keyboard layout repair/i })).toBeVisible()
    await nav.getByRole('link', { name: /Keyboard layout repair/i }).click()
    await expect(page).toHaveURL(/\/features\/keyboard-layout/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Keyboard layout/i)

    for (const { path, heading } of PUBLIC_PAGES) {
      await page.goto(path)
      await acceptCookies(page)
      await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 }), path).toHaveText(heading)
      const issues = await collectPageIssues(page)
      expect(issues, `${path}: ${issues.join('; ')}`).toEqual([])
    }

    await page.goto('/try')
    await page.getByRole('button', { name: 'Keyboard repair' }).click()
    await page.getByPlaceholder('e.g. sfj thlk').fill('lvpfh')
    await page.getByRole('button', { name: 'Repair layout' }).click()
    await expect(page.getByText(/Repaired to Arabic/i)).toBeVisible()
    await page.getByRole('button', { name: 'English help' }).click()
    await page.getByRole('button', { name: 'postpond → postponed' }).click()
    await expect(page.getByText(/1 of /)).toBeVisible()
    await page.getByRole('button', { name: 'Translation' }).click()
    await page.getByRole('button', { name: /^Translate$/ }).click()
    await expect(page.getByText(/Thank you very much/i)).toBeVisible()
    await page.locator('.cta-ink').getByRole('link', { name: /Writing Lab/i }).click()
    await expect(page).toHaveURL(/\/lab/)
    await expect(page.getByRole('link', { name: /^Sign in$/ }).first()).toBeVisible()

    await page.goto('/guide')
    await page.locator('.cta-ink').getByRole('link', { name: /Try the demos/i }).click()
    await expect(page).toHaveURL(/\/try/)

    await page.goto('/pricing')
    const faqButton = page.getByRole('button').filter({ hasText: /\?/ }).nth(1)
    await faqButton.click()
    await expect(faqButton).toHaveAttribute('aria-expanded', 'true')
    await page.locator('#students').getByRole('link', { name: /student program/i }).click()
    await expect(page).toHaveURL(/\/account/)

    await page.goto('/support')
    await page.locator('#support-search').fill('shortcut')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('/blog')
    const firstPost = page.locator('a[href^="/blog/"]').nth(1)
    await firstPost.click()
    await expect(page).toHaveURL(/\/blog\/.+/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('/contact')
    await expect(page.getByText(/Support requests are tied to your account/i)).toBeVisible()
    await page.getByRole('link', { name: /^Sign in$/ }).first().click()
    await expect(page).toHaveURL(/\/account/)

    await page.goto('/feedback')
    await expect(page.getByText(/Sign in to send feedback|tied to your account/i).first()).toBeVisible()

    await page.goto('/account')
    await page.locator('#ac-email').fill('not-an-email')
    await page.locator('#ac-password').fill('short')
    await page.getByRole('button', { name: /^Sign in$/ }).click()
    await expect(page.locator('#ac-email')).toBeVisible()
    await page.getByRole('tab', { name: /Create account/i }).click()
    await expect(page.getByLabel(/Confirm password/i)).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/>or</)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/account/)

    await page.goto('/')
    await page.getByRole('contentinfo').getByRole('button', { name: /Cookie settings/i }).click()
    await expect(page.getByRole('dialog', { name: /Cookies and site storage/i })).toBeVisible()
    await page.getByRole('button', { name: /Save choices/i }).click()
    await expect(page.getByRole('dialog', { name: /Cookies and site storage/i })).toHaveCount(0)

    await page.goto('/not-a-real-page')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/not found/i)
    await page.getByRole('link', { name: /Back to home/i }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByRole('group', { name: /Language/i })).toBeVisible()
    await page.getByRole('button', { name: /Open menu/i }).click()
    const mobileNav = page.locator('#site-mobile-nav')
    await expect(mobileNav.getByRole('link', { name: /Writing Lab/i })).toBeVisible()
    await mobileNav.getByRole('link', { name: /^Pricing$/ }).click()
    await expect(page).toHaveURL(/\/pricing/)

    const ignored = [/Failed to load resource/, /net::ERR/, /favicon/, /Download the React DevTools/]
    const realErrors = consoleErrors.filter((message) => !ignored.some((pattern) => pattern.test(message)))
    expect(realErrors, realErrors.join('\n')).toEqual([])
  })
})
