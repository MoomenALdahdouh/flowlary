import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { PAGE_META, canonicalUrl, resolveMeta, renderHeadTags } from '../seo.ts'
import { ROUTES } from '../routes.ts'
import { CHROME_WEB_STORE_URL } from '../config.ts'

describe('SEO metadata', () => {
  it('defines unique titles and descriptions for every route', () => {
    const titles = new Set<string>()
    for (const path of ROUTES) {
      const meta = PAGE_META[path]
      expect(meta.title.length).toBeGreaterThan(10)
      expect(meta.description.length).toBeGreaterThan(40)
      expect(canonicalUrl(path).startsWith('https://flowlary.com')).toBe(true)
      expect(titles.has(meta.title)).toBe(false)
      titles.add(meta.title)
    }
  })

  it('account is noindex', () => {
    const meta = PAGE_META['/account']
    expect(meta.robots).toBe('noindex, nofollow')
    expect(renderHeadTags(meta)).toContain('noindex, nofollow')
  })

  it('includes SoftwareApplication, Organization, and WebSite structured data without reviews', () => {
    const head = renderHeadTags(PAGE_META['/'])
    expect(head).toContain('application/ld+json')
    expect(head).toContain('SoftwareApplication')
    expect(head).toContain('Organization')
    expect(head).toContain('WebSite')
    expect(head).toContain('https://flowlary.com')
    expect(head).not.toContain('https://zaixos.com')
    expect(head).not.toContain('aggregateRating')
    expect(head).not.toContain('reviewRating')
    expect(head).toContain('twitter:image:alt')
    expect(head).toContain('og:locale')
  })

  it('resolves home canonical with trailing slash', () => {
    expect(canonicalUrl('/')).toBe('https://flowlary.com/')
    expect(resolveMeta('/').path).toBe('/')
  })
})

describe('CTAs', () => {
  it('Get Flowlary points at support while the store URL is unpublished', () => {
    expect(CHROME_WEB_STORE_URL).toBeNull()
    const html = renderToString(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('/support#get-flowlary')
    expect(html).not.toContain('Coming soon')
    expect(html).not.toContain('chromewebstore')
  })
})

describe('pricing honesty', () => {
  it('does not present fake Pro activation or Paddle checkout language', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/pricing']}>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('Choose the way you want to use Flowlary.')
    expect(html).toContain('$0')
    expect(html).toContain('$4.99')
    expect(html).toContain('Try Pro free for 30 days')
    expect(html).toContain('Real writing help, every day.')
    expect(html).toContain('AI writing checks/day')
    expect(html).toContain('payment partner')
    expect(html).not.toContain('Lemon Squeezy')
    expect(html).not.toContain('Unlimited')
    expect(html).not.toContain('1 month free')
    expect(html).not.toContain('Pro activated')
    expect(html).not.toContain('You are Pro')
    expect(html).not.toMatch(/Coming soon/i)
    expect(html).not.toMatch(/stripe/i)
    expect(html).not.toMatch(/webhook/i)
    expect(html.toLowerCase()).not.toContain('buy now')
    expect(html).not.toMatch(/BYOK/i)
  })
})

describe('privacy honesty', () => {
  it('does not claim zero processing and names the production API', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/privacy']}>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('https://api.flowlary.com')
    expect(html).toContain('processes the text you type')
    expect(html).toContain('On Flowlary servers when signed in')
    expect(html).not.toMatch(/we never process text/i)
    expect(html).not.toMatch(/not uploaded to a cloud learning database/i)
  })
})
