import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App.tsx'
import { PAGE_META, resolveMeta, renderHeadTags } from '../seo.ts'

describe('admin panel website', () => {
  it('keeps admin routes noindex', () => {
    for (const path of ['/admin', '/admin/login', '/admin/users', '/admin/subscriptions', '/admin/usage', '/admin/support', '/admin/activity', '/admin/settings', '/admin/feedback'] as const) {
      expect(PAGE_META[path].robots).toBe('noindex, nofollow')
    }
  })

  it('keeps nested admin user URLs noindex', () => {
    const meta = resolveMeta('/admin/users/acct_nested_id')
    expect(meta.robots).toBe('noindex, nofollow')
    expect(meta.path).toBe('/admin/users/acct_nested_id')
    expect(renderHeadTags(meta)).toContain('noindex, nofollow')
  })

  it('renders an admin email and password sign-in form', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/admin/login']}>
        <App />
      </MemoryRouter>,
    )
    expect(html).toContain('<h1')
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain('Admin sign in')
    expect(html).toContain('theme-toggle')
  })

  it('does not render admin data or secrets for signed-out visitors', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )
    expect(html.toLowerCase()).not.toContain('groq_api_key')
    expect(html.toLowerCase()).not.toContain('paddle_api_key')
    expect(html).not.toContain('12,482')
  })
})
