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
  it('home uses real product previews for write and communicate', () => {
    const html = renderRoute('/')
    expect(html).toContain('Write anywhere.')
    expect(html).toContain('Your writing becomes your English lesson.')
    expect(html).toContain('Corrected in place')
    expect(html).toContain('received')
    expect(html).toContain('How are you today?')
    expect(html).toContain('Illustrative learning flow')
    expect(html).toContain('Writing correction')
    expect(html).toContain('Your AI Writing Companion')
    expect(html).toContain('Extension active')
    expect(html).toContain('Fix Writing')
    expect(html).toContain('Ready')
    expect(html).not.toContain('Writing Intelligence')
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

  it('features page connects real product demos to the learning narrative', () => {
    const html = renderRoute('/features')
    expect(html).toContain('Get help while you write')
    expect(html).toContain('Communicate without breaking your flow.')
    expect(html).toContain('Turn everyday writing into a learning loop.')
    expect(html).toContain('Corrected in place')
    expect(html).toContain('received')
    expect(html).toContain('How are you today?')
    expect(html).toContain('Writing history')
    expect(html).toContain('Less switching. More continuity.')
    expect(html).toContain('Built into the experience')
  })
})

describe('coming soon policy', () => {
  it('does not use coming soon on primary marketing surfaces', () => {
    for (const path of ['/', '/features', '/pricing', '/about', '/support']) {
      const html = renderRoute(path).toLowerCase()
      expect(html).not.toContain('coming soon')
    }
  })
})
