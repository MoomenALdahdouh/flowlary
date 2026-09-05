import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { API_URL, SITE_URL } from '../config.ts'
import { en } from '../i18n/en.ts'
import { ROUTES } from '../routes.ts'
import { BLOG_POSTS } from '../bolt/data/site.tsx'

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
const BLOG_POST_PATHS = new Set(BLOG_POSTS.map((post) => `/blog/${post.slug}`))
const SUPPORT_HASHES = new Set(['contact', 'troubleshooting', 'get-flowlary', ...en.support.topics.map((topic) => topic.id)])
const PRODUCT_HASHES = new Set(['control', 'actions', 'repair', 'learn'])
const EXTERNAL = new Set([SITE_URL, API_URL])

function assertInternalHref(href: string, html: string) {
  if (href.startsWith('#')) {
    const id = href.slice(1)
    expect(html, `missing id for ${href}`).toContain(`id="${id}"`)
    return
  }

  const url = new URL(href, SITE_URL)
  if (BLOG_POST_PATHS.has(url.pathname)) return
  if (/\.(svg|png|jpe?g|webp|gif|ico)$/i.test(url.pathname)) return
  expect(INTERNAL.has(url.pathname), `unknown path ${href}`).toBe(true)

  const id = url.hash.replace(/^#/, '')
  if (!id) return
  if (url.pathname === '/product') expect(PRODUCT_HASHES.has(id)).toBe(true)
  else if (url.pathname === '/features') expect(false, `features no longer uses hash ${href}`).toBe(true)
  else if (url.pathname === '/support') expect(SUPPORT_HASHES.has(id)).toBe(true)
  else if (url.pathname === '/contact') expect(id === '').toBe(true)
  else if (url.pathname === '/pricing') expect(['students', 'pr-compare'].includes(id)).toBe(true)
  else if (url.pathname === '/dashboard') expect(['lab', 'overview'].includes(id)).toBe(true)
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

  it('sends Add to Chrome as an install action and Try the demo to /try', () => {
    const html = renderRoute('/')
    expect(html).toContain('href="/try"')
    expect(html).toContain('Add to Chrome')
    expect(html).toContain('aria-haspopup="dialog"')
  })

  it('features final CTA links to Try', () => {
    const html = renderRoute('/features')
    expect(html).toContain('What ')
    expect(html).toContain('helps with')
    expect(html).toContain('href="/try"')
    expect(html).not.toMatch(/class="btn btn-secondary"[^>]*href="\/features"/)
  })

  it('redirects legacy homepage hash destinations', () => {
    const playground = renderRoute('/#try-flowlary')
    const writingLab = renderRoute('/#writing-lab')
    expect(playground).toContain('fl-fidelity-simulated')
    expect(writingLab).toContain('fl-fidelity-live')
  })

  it('wires account create as a mode switch and sign-in as form submit', () => {
    const html = renderRoute('/account')
    expect(html).toContain('type="submit"')
    expect(html).toContain('Create account')
    expect(html).toContain('Sign in')
    expect(html).toContain('href="/guide"')
  })

  it('keeps pricing CTAs honest while billing is prepared', () => {
    const html = renderRoute('/pricing')
    expect(html).toContain('href="/account?mode=register"')
    expect(html).toContain('Try Pro Free')
    expect(html).toContain('Paid checkout when billing is enabled')
    expect(html).toContain('href="/guide"')
    expect(html).not.toMatch(/Unlimited|BYOK/i)
  })

  it('404 returns home', () => {
    const html = renderRoute('/missing-page')
    expect(html).toContain('href="/"')
    expect(html).toContain('Back to home')
  })
})
