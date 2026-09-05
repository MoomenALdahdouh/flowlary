import type {
  AdminActivityView,
  AdminOverviewView,
  AdminSearchView,
  AdminSettingsView,
  AdminSubscriptionListItem,
  AdminSubscriptionListView,
  AdminUsageView,
  AdminUserDetailView,
  AdminUserListView,
} from '@flowlary/shared'
import { resolvePublicApiUrl } from '../config.ts'
import { peekWebSession } from '../account/client.ts'
import { readWebInstallId } from '../account/webInstall.ts'

type Result<T> = { ok: true; body: T } | { ok: false; status: number; error: string }

export function asAdminList<T>(body: {
  items?: T[] | null
  users?: T[] | null
  page?: number
  pageSize?: number
  total?: number
}): { items: T[]; page: number; pageSize: number; total: number } {
  const items = Array.isArray(body.items) ? body.items : Array.isArray(body.users) ? body.users : []
  const pageSize = body.pageSize && body.pageSize > 0 ? body.pageSize : 25
  const total = typeof body.total === 'number' ? body.total : items.length
  const page = body.page && body.page > 0 ? body.page : 1
  return { items, page, pageSize, total }
}

function authHeaders(): Record<string, string> | null {
  const session = peekWebSession()
  if (!session?.accessToken) return null
  const installId = readWebInstallId()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.accessToken}`,
    ...(installId ? { 'X-Flowlary-Install-Id': installId } : {}),
    'X-Flowlary-Client': 'website',
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const headers = authHeaders()
  if (!headers) return { ok: false, status: 401, error: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: typeof (body.error as { message?: string } | undefined)?.message === 'string'
          ? String((body.error as { message: string }).message)
          : 'request_failed',
      }
    }
    return { ok: true, body: body as T }
  } catch {
    return { ok: false, status: 0, error: 'network' }
  }
}

export async function fetchAdminSession() {
  return request<{ ok: boolean; admin: { id: string; email: string } }>('/api/admin/session')
}

export async function fetchAdminOverview(rangeDays: number) {
  return request<{ ok: boolean; overview: AdminOverviewView }>(`/api/admin/overview?rangeDays=${rangeDays}`)
}

export async function fetchAdminUsers(query: string) {
  return request<{ ok: boolean } & AdminUserListView>(`/api/admin/users${query}`)
}

export async function fetchAdminUser(id: string) {
  return request<{ ok: boolean; user: AdminUserDetailView }>(`/api/admin/users/${encodeURIComponent(id)}`)
}

export async function postAdminUserAction(id: string, action: 'suspend' | 'restore' | 'revoke-sessions', confirm = true) {
  return request<{ ok: boolean; user?: AdminUserDetailView; revoked?: number }>(
    `/api/admin/users/${encodeURIComponent(id)}/${action}`,
    { method: 'POST', body: JSON.stringify({ confirm }) },
  )
}

export async function fetchAdminSubscriptions(query: string) {
  return request<{ ok: boolean } & AdminSubscriptionListView>(`/api/admin/subscriptions${query}`)
}

export async function fetchAdminSubscription(id: string) {
  return request<{ ok: boolean; subscription: AdminSubscriptionListItem }>(
    `/api/admin/subscriptions/${encodeURIComponent(id)}`,
  )
}

export async function fetchAdminUsage(query: string) {
  return request<{ ok: boolean; usage: AdminUsageView }>(`/api/admin/usage${query}`)
}

export async function fetchAdminActivity(query: string) {
  return request<{ ok: boolean } & AdminActivityView>(`/api/admin/activity${query}`)
}

export async function fetchAdminSettings() {
  return request<{ ok: boolean; settings: AdminSettingsView }>('/api/admin/settings')
}

export async function fetchAdminSearch(q: string) {
  return request<{ ok: boolean } & AdminSearchView>(`/api/admin/search?q=${encodeURIComponent(q)}`)
}
