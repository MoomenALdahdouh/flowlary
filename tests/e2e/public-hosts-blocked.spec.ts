import { test, chromium } from '@playwright/test'

/**
 * Public host probes without accounts. Login walls are BLOCKED (skipped), not PASS.
 */
const HOSTS = [
  { id: 'chatgpt', url: 'https://chatgpt.com/', name: 'ChatGPT' },
  { id: 'gmail', url: 'https://mail.google.com/', name: 'Gmail' },
  { id: 'notion', url: 'https://www.notion.so/', name: 'Notion' },
  { id: 'linkedin', url: 'https://www.linkedin.com/', name: 'LinkedIn' },
] as const

test.describe.configure({ timeout: 45_000 })

test.describe('public hosts without accounts', () => {
  for (const host of HOSTS) {
    test(`${host.name} compose is not exercised without an account`, async () => {
      const browser = await chromium.launch({ headless: false })
      const page = await browser.newPage()
      try {
        try {
          await page.goto(host.url, { waitUntil: 'domcontentloaded', timeout: 25_000 })
        } catch {
          test.skip(true, `BLOCKED: ${host.name} navigation failed`)
        }

        const editable = page.locator('textarea, [contenteditable="true"], [role="textbox"]')
        const editableCount = await editable.count().catch(() => 0)
        const loginish = page.getByRole('button', { name: /log in|sign in|sign up|get started/i })
        const loginVisible = (await loginish.count().catch(() => 0)) > 0
        const firstVisible = editableCount > 0 && (await editable.first().isVisible().catch(() => false))
        const hasUsableComposer = firstVisible && !loginVisible

        test.info().annotations.push({
          type: hasUsableComposer ? 'available' : 'blocked',
          description: `${host.name} editable=${editableCount} loginish=${loginVisible}`,
        })

        if (!hasUsableComposer) {
          test.skip(
            true,
            `BLOCKED: ${host.name} has no public composer without an account (editable=${editableCount}, loginish=${loginVisible})`,
          )
        }

        await editable.first().click({ timeout: 5_000 })
        await page.keyboard.type('hello ', { delay: 20 })
      } finally {
        await browser.close()
      }
    })
  }
})
