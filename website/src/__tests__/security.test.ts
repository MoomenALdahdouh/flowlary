import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHROME_WEB_STORE_URL, API_URL, SITE_URL } from '../config.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXT = new Set(['.ts', '.tsx', '.css', '.html', '.xml', '.txt', '.svg', '.mjs'])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (EXT.has(extname(name))) out.push(full)
  }
  return out
}

describe('website security and honesty', () => {
  const files = walk(ROOT)
  const combined = files.map((file) => `${file}\n${readFileSync(file, 'utf8')}`).join('\n')

  it('does not embed GROQ_API_KEY', () => {
    expect(combined).not.toMatch(/GROQ_API_KEY/)
  })

  it('does not embed Paddle server secrets', () => {
    expect(combined).not.toMatch(/PADDLE_API_KEY/)
    expect(combined).not.toMatch(/PADDLE_WEBHOOK_SECRET/)
    expect(combined).not.toMatch(/PADDLE_NOTIFICATION_WEBHOOK_SECRET/)
  })

  it('does not use legacy ZAIXOS API hosts', () => {
    expect(combined).not.toMatch(/flowlary-api\.zaixos\.com/)
    expect(combined).not.toMatch(/lingo-api\.zaixos\.com/)
  })

  it('does not hardcode development API hosts in website source', () => {
    expect(combined).not.toMatch(/127\.0\.0\.1/)
    expect(combined).not.toMatch(/localhost/)
  })

  it('uses canonical production domains', () => {
    expect(SITE_URL).toBe('https://flowlary.com')
    expect(API_URL).toBe('https://api.flowlary.com')
    expect(combined).toContain('https://flowlary.com')
    expect(combined).toContain('https://api.flowlary.com')
  })

  it('does not invent a Chrome Web Store URL', () => {
    expect(CHROME_WEB_STORE_URL).toBeNull()
    expect(combined).not.toMatch(/chrome\.google\.com\/webstore/)
    expect(combined).not.toMatch(/chromewebstore\.google\.com/)
  })
})
