import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { API_URL, SITE_URL } from '../config.ts'
import { en } from '../i18n/en.ts'
import { ROUTES } from '../routes.ts'

function renderRoute(path: string) {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1])
}

const INTERNAL = new Set<string>(ROUTES)
const SUPPORT_HASHES = new Set(['contact', 'troubleshooting', ...en.support.topics.map((topic) => topic.id)])
const EXTERNAL = new Set([SITE_URL, API_URL])

function assertInternalHref(href: string, html: string) {
  if (href.startsWith('#')) {
    const id = href.slice(1)
    expect(html, `missing id for ${href}`).toContain(`id="${id}"`)
    return
  }

  const url = new URL(href, SITE_URL)
  expect(INTERNAL.has(url.pathname), `unknown path ${href}`).toBe(true)

  const id = url.hash.replace(/^#/, '')
  if (!id) return
  if (url.pathname === '/') expect(['write', 'communicate', 'learn', 'how', 'try-flowlary', 'writing-lab'].includes(id)).toBe(true)
  else if (url.pathname === '/features') expect(['feat-write', 'feat-communicate', 'feat-learn', 'feat-connected'].includes(id)).toBe(true)
  else if (url.pathname === '/support') expect(SUPPORT_HASHES.has(id)).toBe(true)
  else if (url.pathname === '/contact') expect(id === '').toBe(true)
  else if (url.pathname === '/pricing') expect(['students', 'pr-compare'].includes(id)).toBe(true)
  else expect.fail(`unexpected hash ${href}`)
}

describe('website buttons and links', () => {
  it.each([...ROUTES])('uses real destinations on %s', (path) => {
    const html = renderRoute(path)
    for (const href of hrefs(html)) {
      if (EXTERNAL.has(href) || href.startsWith(`${SITE_URL}/`)) continue
      expect(href.startsWith('mailto:')).toBe(false)
      expect(href).not.toBe('#')
      expect(href).not.toMatch(/^javascript:/i)
      assertInternalHref(href, html)
    }
  })

  it('sends Get Flowlary to install and See how it works to the home workflow', () => {
    const html = renderRoute('/')
    expect(html).toContain('href="/support#get-flowlary"')
    expect(html).toContain('href="/#how"')
    expect(html).toContain('id="how"')
    expect(html).toContain('href="/pricing#students"')
  })

  it('features final CTA links to the home playground demo', () => {
    const html = renderRoute('/features')
    expect(html).toContain('Try the interactive demo')
    expect(html).toContain('href="/#try-flowlary"')
    expect(html).toContain('One companion for writing, communication, and learning.')
    const featureCtas = hrefs(html).filter((href) => href === '/features')
    expect(featureCtas.length).toBeGreaterThan(0)
    expect(html).not.toMatch(/class="btn btn-secondary"[^>]*href="\/features"/)
  })

  it('preserves focused homepage destinations outside the default narrative', () => {
    const playground = renderRoute('/#try-flowlary')
    const writingLab = renderRoute('/#writing-lab')
    expect(playground).toContain('id="try-flowlary"')
    expect(writingLab).toContain('id="writing-lab"')
    expect(playground).toContain('aria-busy="true"')
    expect(writingLab).toContain('aria-busy="true"')
  })

  it('wires account create as a mode switch and sign-in as form submit', () => {
    const html = renderRoute('/account')
    expect(html).toContain('type="submit"')
    expect(html).toContain('Create account')
    expect(html).toContain('Sign in')
    expect(html).toContain('href="/support#get-flowlary"')
  })

  it('keeps pricing CTAs honest while billing is prepared', () => {
    const html = renderRoute('/pricing')
    expect(html).toContain('href="/account?mode=register"')
    expect(html).toContain('Try Pro Free')
    expect(html).toContain('Paid checkout when billing is enabled')
    expect(html).toContain('href="/support#get-flowlary"')
    expect(html).not.toMatch(/Unlimited|BYOK/i)
  })

  it('404 returns home', () => {
    const html = renderRoute('/missing-page')
    expect(html).toContain('href="/"')
    expect(html).toContain('Back to home')
  })
})
