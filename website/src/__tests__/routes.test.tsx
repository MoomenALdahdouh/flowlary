import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { ROUTES } from '../routes.ts'

function renderRoute(path: string) {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('marketing routes', () => {
  it.each([...ROUTES])('renders %s with a heading', (path) => {
    const html = renderRoute(path)
    expect(html).toContain('<h1')
    expect(html.toLowerCase()).not.toContain('flowlary-api.zaixos.com')
    expect(html.toLowerCase()).not.toContain('lingo-api.zaixos.com')
  })

  it('home communicates the flow-first write, communicate, and learn narrative', () => {
    const html = renderRoute('/')
    expect(html).toContain('Write anywhere.')
    expect(html).toContain('Stay in the flow.')
    expect(html).toContain('Too many tools for one writing task.')
    expect(html).toContain('Get writing help where you already write.')
    expect(html).toContain('Switch languages, not tools.')
    expect(html).toContain('Your writing becomes your English lesson.')
    expect(html).toContain('Help when you need it. Learning that continues.')
    expect(html).toContain('Built with boundaries')
    expect(html).toContain('Get Flowlary')
    expect(html).toContain('Bring writing help, communication, and learning into one companion.')
    expect(html.toLowerCase()).not.toContain('coming soon')
    expect(html).toContain('Color theme')
    expect(html).toContain('theme-toggle')
  })

  it('404 renders for unknown paths', () => {
    const html = renderRoute('/not-a-real-page')
    expect(html).toContain('Page not found')
  })

  it('account page is honest and does not expose raw API URLs in copy', () => {
    const html = renderRoute('/account')
    expect(html).toContain('<h1')
    expect(html).toContain('Welcome back')
    expect(html).toContain('Sign in to continue learning with Flowlary.')
    expect(html).not.toContain('temporarily unavailable')
    expect(html).not.toContain('api.flowlary.com')
    expect(html).not.toContain('Pro activated')
    expect(html).not.toContain('Paddle')
    expect(html).not.toContain('ZAIXOS')
  })

  it('blog is an honest empty state', () => {
    const html = renderRoute('/blog')
    expect(html).toContain('No articles have been published yet')
    expect(html).not.toContain('Lorem ipsum')
  })

  it('about states the product without invented claims', () => {
    const html = renderRoute('/about')
    expect(html).toContain('Writing tools that stay where you work.')
    expect(html).toContain('flowlary.com')
    expect(html).not.toContain('ZAIXOS')
    expect(html).not.toContain('https://zaixos.com')
    expect(html).not.toContain('https://api.flowlary.com')
    expect(html).toContain('What Flowlary does not claim')
    expect(html).not.toMatch(/Series [A-Z]/)
  })

  it('pricing presents Free and Pro plans as the primary decision', () => {
    const html = renderRoute('/pricing')
    expect(html).toContain('Choose the way you want to use Flowlary.')
    expect(html).toContain('pr-card is-pro')
    expect(html).toContain('$0')
    expect(html).toContain('forever')
    expect(html).toContain('Compare Free and Pro')
    expect(html).toContain('id="students"')
    expect(html).toContain('$4.99')
    expect(html).not.toMatch(/BYOK|Paddle/i)
  })

  it('guide page is a step-by-step tutorial for new users', () => {
    const html = renderRoute('/guide')
    expect(html).toContain('Get started with Flowlary')
    expect(html).toContain('Enable Flowlary AI')
    expect(html).toContain('Step-by-step')
    expect(html).not.toMatch(/BYOK|Groq/i)
    expect(html).toContain('You do not add an API key')
  })

  it('support is a help center without a fake inbox', () => {
    const html = renderRoute('/support')
    expect(html).toContain('How can we help?')
    expect(html).toContain('id="get-flowlary"')
    expect(html).toContain('Writing correction')
    expect(html).toContain('Live translation')
    expect(html).toContain('Keyboard layout')
    expect(html).toContain('Speed Box')
    expect(html).toContain('AI usage')
    expect(html).not.toContain('BYOK')
    expect(html).toContain('Open contact page')
    expect(html).not.toContain('Support contact will be available here')
    expect(html).not.toContain('Support email is not published')
  })

  it('legal pages have an effective date and related links', () => {
    const privacy = renderRoute('/privacy')
    const terms = renderRoute('/terms')
    const cookies = renderRoute('/cookies')
    expect(privacy).toContain('dateTime="2026-08-30"')
    expect(privacy).toContain('/terms')
    expect(privacy).toContain('/cookies')
    expect(terms).toContain('dateTime="2026-08-30"')
    expect(terms).toContain('/privacy')
    expect(terms).toContain('23. Changes')
    expect(cookies).toContain('Cookie Policy')
  })

  it('contact page routes help by topic', () => {
    const html = renderRoute('/contact')
    expect(html).toContain('Contact Flowlary')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('href="/support#troubleshooting"')
  })
})
