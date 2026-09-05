import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { I18nProvider } from '../i18n/index.tsx'
import { AdminUsersPage } from '../admin/AdminUsersPage.tsx'
import { AdminTable, AdminTableLink } from '../admin/AdminTable.tsx'
import { asAdminList } from '../admin/client.ts'

vi.mock('../admin/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../admin/client.ts')>()
  return {
    ...actual,
    fetchAdminUsers: vi.fn(),
    fetchAdminUser: vi.fn(),
    postAdminUserAction: vi.fn(),
  }
})

import { fetchAdminUsers } from '../admin/client.ts'

describe('admin users list', () => {
  let root: Root | null = null
  let host: HTMLDivElement | null = null

  beforeEach(() => {
    vi.mocked(fetchAdminUsers).mockReset()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    host?.remove()
    root = null
    host = null
  })

  it('normalizes list payloads even when items is missing', () => {
    expect(asAdminList({ users: [{ id: '1' }] }).items).toEqual([{ id: '1' }])
    expect(asAdminList({}).items).toEqual([])
    expect(asAdminList({ items: [{ id: '2' }], total: 9 }).total).toBe(9)
  })

  it('renders visible row cells for provided rows', () => {
    const html = renderToString(
      <MemoryRouter>
        <AdminTable
          columns={[
            {
              key: 'email',
              header: 'Account',
              cell: (row: { email: string }) => <AdminTableLink to="/admin/users/1">{row.email}</AdminTableLink>,
            },
          ]}
          rows={[{ email: 'ops@flowlary.com' }]}
          rowKey={(row) => row.email}
          empty="Nothing"
          countLabel="1 results"
        />
      </MemoryRouter>,
    )
    expect(html).toContain('ops@flowlary.com')
    expect(html).toContain('ad-data-row')
    expect(html).toContain('1 results')
  })

  it('shows user emails from the users API', async () => {
    vi.mocked(fetchAdminUsers).mockResolvedValue({
      ok: true,
      body: {
        ok: true,
        items: [
          {
            id: 'acct_writer',
            email: 'writer@flowlary.com',
            plan: 'pro',
            status: 'active',
            emailVerified: true,
            inTrial: false,
            isPro: true,
            joinedAt: Date.UTC(2026, 0, 2),
            lastActivityAt: Date.UTC(2026, 8, 1),
            creditsUsedToday: 0,
            requestCount: 12,
          },
        ],
        page: 1,
        pageSize: 25,
        total: 154,
      },
    } as never)

    await act(async () => {
      root!.render(
        <I18nProvider>
          <MemoryRouter initialEntries={['/admin/users']}>
            <AdminUsersPage />
          </MemoryRouter>
        </I18nProvider>,
      )
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(host!.textContent).toContain('writer@flowlary.com')
    expect(host!.textContent).toContain('154 results')
    expect(host!.querySelectorAll('.ad-users-row').length).toBe(1)
  })
})
