import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { ROUTES } from '../routes.ts'

const AUTH_GATED_ROUTES = new Set(['/dashboard', '/dashboard/support', '/lab'])

function renderRoute(path: string) {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('marketing routes', () => {
  it.each([...ROUTES].filter((path) => !AUTH_GATED_ROUTES.has(path)))('renders %s with a heading', (path) => {
    const html = renderRoute(path)
    expect(html).toContain('<h1')
    expect(html.toLowerCase()).not.toContain('flowlary-api.zaixos.com')
    expect(html.toLowerCase()).not.toContain('lingo-api.zaixos.com')
  })

  it('dashboard routes redirect signed-out users to account', () => {
    const dashboard = renderRoute('/dashboard')
    const support = renderRoute('/dashboard/support')
    const lab = renderRoute('/lab')
    expect(dashboard).not.toContain('flowlary-api.zaixos.com')
    expect(support).not.toContain('flowlary-api.zaixos.com')
    expect(lab).not.toContain('flowlary-api.zaixos.com')
  })

  it('home communicates the product experience story', () => {
    const html = renderRoute('/')
    expect(html).toContain('Write where you are.')
    expect(html).toContain('Help stays in the field.')
    expect(html).toContain('Three problems.')
    expect(html).toContain('One field.')
    expect(html).toContain('Help stays where you type')
    expect(html).toContain('hp-proof-rail')
    expect(html).toContain('Keyboard layout repair')
    expect(html).toContain('One companion.')
    expect(html).toContain('Simulated')
    expect(html).toContain('Live')
    expect(html).toContain('Add to Chrome')
    expect(html).not.toContain('اكتب حيث أنت')
    expect(html).toContain('Stop switching.')
    expect(html).toContain('Start flowing.')
    expect(html).not.toContain('Your writing becomes your English lesson.')
    expect(html.toLowerCase()).not.toContain('coming soon')
    expect(html).toContain('theme-toggle')
    expect(html).toContain('fl-nav-seg')
    expect(html).toContain('fl-nav-cta')
    expect(html).toContain('fl-nav-icon-link')
    expect(html).toContain('fl-section')
    expect(html).toContain('fl-scroll-progress')
    expect(html).toContain('reveal-clip')
    expect(html).toContain('reveal-start')
    expect(html).toMatch(/System theme|Color theme|Light theme|Dark theme/)
  })

  it('legacy home hashes redirect to canonical routes', () => {
    const tryHtml = renderRoute('/try')
    expect(tryHtml).toContain('Try ')
    expect(tryHtml).toContain('Flowlary</span>')
    expect(tryHtml).toContain('fl-fidelity-simulated')
  })

  it('404 renders for unknown paths', () => {
    const html = renderRoute('/not-a-real-page')
    expect(html).toContain('Page not found')
  })

  it('account page is honest and does not expose raw API URLs in copy', () => {
    const html = renderRoute('/account')
    expect(html).toContain('<h1')
    expect(html).toContain('Welcome ')
    expect(html).toContain('Sign in to access Writing Lab, progress, and your dashboard.')
    expect(html).not.toContain('temporarily unavailable')
    expect(html).not.toContain('api.flowlary.com')
    expect(html).not.toContain('Pro activated')
    expect(html).not.toContain('Paddle')
    expect(html).not.toContain('ZAIXOS')
  })

  it('register page is a real create-account form', () => {
    const html = renderRoute('/account?mode=register')
    expect(html).toContain('Create your')
    expect(html).toContain('account</span>')
    expect(html).toContain('Free to start. No credit card required.')
    expect(html).toContain('href="/terms"')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('What this account unlocks')
    expect(html).toContain('Confirm password')
    expect(html).not.toContain('temporarily unavailable')
  })

  it('blog publishes product stories', () => {
    const html = renderRoute('/blog')
    expect(html).toContain('Bilingual writing life')
    expect(html).toContain('wrong-keyboard-gibberish')
    expect(html).toContain('/blog/wrong-keyboard.jpg')
    expect(html).toContain('stay-in-the-inbox')
    expect(html).not.toContain('No articles have been published yet')
    expect(html).not.toContain('Lorem ipsum')
  })

  it('about states the product without invented claims', () => {
    const html = renderRoute('/about')
    expect(html).toContain('Writing tools that stay ')
    expect(html).toContain('where you work.')
    expect(html).toContain('flowlary.com')
    expect(html).not.toContain('ZAIXOS')
    expect(html).not.toContain('https://zaixos.com')
    expect(html).not.toContain('https://api.flowlary.com')
    expect(html).toContain('What Flowlary does not claim')
    expect(html).not.toMatch(/Series [A-Z]/)
  })

  it('pricing presents Free and Pro plans as the primary decision', () => {
    const html = renderRoute('/pricing')
    expect(html).toContain('Choose the way you want to use')
    expect(html).toContain('Flowlary')
    expect(html).toContain('pr-card is-pro')
    expect(html).toContain('$0')
    expect(html).toContain('forever')
    expect(html).toContain('Compare Free and Pro')
    expect(html).toContain('id="students"')
    expect(html).toContain('intent=student')
    expect(html).toContain('Verify your school email')
    expect(html).toContain('pr-billing-toggle')
    expect(html).toContain('$4.99')
    expect(html).toContain('$39')
    expect(html).not.toMatch(/BYOK|Paddle/i)
  })

  it('guide page is a step-by-step tutorial for new users', () => {
    const html = renderRoute('/guide')
    expect(html).toContain('Get started with')
    expect(html).toContain('Flowlary')
    expect(html).toContain('Enable Flowlary AI')
    expect(html).toContain('Step-by-step')
    expect(html).not.toMatch(/BYOK|Groq/i)
    expect(html).toContain('You do not add an API key')
  })

  it('support is a help center without a fake inbox', () => {
    const html = renderRoute('/support')
    expect(html).toContain('How can we')
    expect(html).toContain('help?')
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
    expect(cookies).toContain('Cookie')
    expect(cookies).toContain('Policy')
    expect(cookies).toContain('dateTime="2026-08-30"')
  })

  it('contact page routes help by topic', () => {
    const html = renderRoute('/contact')
    expect(html).toContain('Contact')
    expect(html).toContain('Flowlary')
    expect(html).toContain('href="/privacy"')
    expect(html).toContain('href="/support#troubleshooting"')
  })

  it('feedback is a real hub, not a fake form', () => {
    const html = renderRoute('/feedback')
    expect(html).toContain('Tell us what to ')
    expect(html).toContain('improve')
    expect(html).toContain('How we use what you send')
    expect(html).toContain('How is Flowlary working')
    expect(html).toContain('Send feedback')
    expect(html).toContain('Create account')
    expect(html).toContain('href="/feedback?tab=features"')
    expect(html).toContain('href="/feedback?tab=support"')
    expect(html).toContain('What happens next')
    expect(html).toContain('Do I need an account?')
    expect(html).not.toContain('coming later')
  })

  it('product page explains surfaces', () => {
    const html = renderRoute('/product')
    expect(html).toContain('How Flowlary works as')
    expect(html).toContain('one product')
    expect(html).toContain('id="control"')
    expect(html).toContain('id="actions"')
  })

  it('try page is clearly simulated', () => {
    const html = renderRoute('/try')
    expect(html).toContain('fl-fidelity-simulated')
    expect(html).toContain('Simulated experience')
  })

  it('lab route sends people into the dashboard writing lab', () => {
    const html = renderRoute('/lab')
    expect(html).not.toContain('flowlary-api.zaixos.com')
    expect(html.toLowerCase()).not.toContain('postpond')
  })
})
