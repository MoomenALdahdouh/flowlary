import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { ar } from '../i18n/ar.ts'

function renderRoute(path: string) {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('product demonstrations', () => {
  it('home hero uses a real popup preview and product experience', () => {
    const html = renderRoute('/')
    expect(html).toContain('Keep writing.')
    expect(html).toContain('switch tools.')
    expect(html).toContain('Three problems.')
    expect(html).toContain('One field.')
    expect(html).toContain('fl-fidelity-simulated')
    expect(html).toContain('Simulated experience')
    expect(html).not.toContain('1,000,000 users')
  })

  it('Arabic playground catalog is fully localized', () => {
    expect(ar.playground.tabs.correction).toMatch(/[\u0600-\u06FF]/)
    expect(ar.playground.speedbox.convertButton).toBe('حوّل')
    expect(ar.playground.shellBadge).toMatch(/[\u0600-\u06FF]/)
    expect(ar.playground.capabilities[0].title).toMatch(/[\u0600-\u06FF]/)
    expect(ar.home.playgroundTitle).toMatch(/[\u0600-\u06FF]/)
    expect(ar.popupPreview.masterTitle).toMatch(/[\u0600-\u06FF]/)
    expect(ar.popupPreview.features.correction).toMatch(/[\u0600-\u06FF]/)
    expect(ar.safetyGate.title).toMatch(/[\u0600-\u06FF]/)
    expect(ar.safetyGate.status).toMatch(/[\u0600-\u06FF]/)
    expect(ar.demos.where.tabs.email).toMatch(/[\u0600-\u06FF]/)
    expect(ar.demos.where.frameTitle).toMatch(/[\u0600-\u06FF]/)
    expect(ar.demos.browser.pageUrl).toMatch(/[\u0600-\u06FF]/)
  })

  it('try page hosts the interactive playground demo', () => {
    const html = renderRoute('/try')
    expect(html).toContain('fl-fidelity-simulated')
    expect(html).toContain('Simulated experience')
    expect(html).toContain('Try ')
    expect(html).toContain('xp-gradient-text">Flowlary</span>')
  })

  it('features index links to capability detail pages', () => {
    const html = renderRoute('/features')
    expect(html).toContain('What ')
    expect(html).toContain('helps with')
    expect(html).toContain('Keyboard layout')
    expect(html).toContain('href="/features/writing-correction"')
    expect(html).toContain('href="/product"')
  })
})

describe('coming soon policy', () => {
  it('does not use coming soon on primary marketing surfaces', () => {
    for (const path of ['/', '/features', '/pricing', '/about', '/support', '/try', '/product']) {
      const html = renderRoute(path).toLowerCase()
      expect(html).not.toContain('coming soon')
    }
  })
})
