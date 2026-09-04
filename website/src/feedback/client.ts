import type {
  FeedbackConfigView,
  FeedbackEligibilityView,
  FeedbackPublicView,
  FeatureRequestPublicView,
  SupportTicketAdminView,
  SupportTicketPublicView,
  SupportTicketMessageView,
} from '@flowlary/shared'
import { resolvePublicApiUrl } from '../config.ts'
import { peekWebSession } from '../account/client.ts'
import { readWebInstallId } from '../account/webInstall.ts'

type Result<T> = { ok: true; body: T } | { ok: false; error: string }

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

async function request<T>(path: string, init: RequestInit = {}, requireAuth = true): Promise<Result<T>> {
  const headers = requireAuth ? authHeaders() : { 'Content-Type': 'application/json', 'X-Flowlary-Client': 'website' }
  if (requireAuth && !headers) return { ok: false, error: 'auth' }
  try {
    const response = await fetch(`${resolvePublicApiUrl()}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    })
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) return { ok: false, error: typeof body.error === 'string' ? body.error : 'network' }
    return { ok: true, body: body as T }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function fetchFeedbackConfigPublic() {
  return request<{ ok: boolean; config: FeedbackConfigView }>('/api/feedback/config', {}, false)
}

export async function fetchFeedbackEligibility() {
  return request<{ ok: boolean; eligiblePrompts: FeedbackEligibilityView['eligiblePrompts']; preferences: FeedbackEligibilityView['preferences'] }>(
    '/api/feedback/eligibility',
  )
}

export async function submitFeedback(input: Record<string, unknown>) {
  return request<{ ok: boolean; item: FeedbackPublicView }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function submitRating(input: Record<string, unknown>) {
  return request<{ ok: boolean; item: FeedbackPublicView }>('/api/feedback/rating', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function dismissFeedbackPrompt(input: { promptId: string; action: 'not_now' | 'dont_ask_again' }) {
  return request<{ ok: boolean; preferences: FeedbackEligibilityView['preferences'] }>('/api/feedback/dismiss', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function fetchFeatureRequests() {
  return request<{ ok: boolean; items: FeatureRequestPublicView[] }>('/api/feedback/feature-requests')
}

export type PublicFeatureRequestStat = {
  id: string
  title: string
  voteCount: number
  status: string
  roadmapBucket?: string
}

export async function fetchPublicFeatureRequests() {
  return request<{ ok: boolean; items: PublicFeatureRequestStat[] }>('/api/public/feature-requests', {}, false)
}

export async function createFeatureRequest(input: Record<string, unknown>) {
  return request<{ ok: boolean; item: FeatureRequestPublicView }>('/api/feedback/feature-request', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function voteFeatureRequest(id: string) {
  return request<{ ok: boolean; item: FeatureRequestPublicView }>(`/api/feedback/feature-request/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function createSupportTicket(input: Record<string, unknown>) {
  return request<{ ok: boolean; ticket: SupportTicketPublicView }>('/api/support/ticket', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function fetchSupportTickets() {
  return request<{ ok: boolean; tickets: SupportTicketPublicView[] }>('/api/support/tickets')
}

export async function fetchSupportTicket(id: string) {
  return request<{ ok: boolean; ticket: SupportTicketPublicView; messages: SupportTicketMessageView[] }>(
    `/api/support/tickets/${encodeURIComponent(id)}`,
  )
}

export async function postSupportTicketMessage(id: string, message: string) {
  return request<{ ok: boolean; message: SupportTicketMessageView }>(
    `/api/support/tickets/${encodeURIComponent(id)}/message`,
    { method: 'POST', body: JSON.stringify({ message }) },
  )
}

export async function resolveSupportTicket(id: string) {
  return request<{ ok: boolean; ticket: SupportTicketPublicView }>(
    `/api/support/tickets/${encodeURIComponent(id)}/resolve`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

export async function fetchAdminSupportTickets(query = '') {
  return request<{ ok: boolean; tickets: SupportTicketAdminView[] }>(`/api/feedback/admin/tickets${query}`)
}

export async function fetchAdminSupportTicket(id: string) {
  return request<{ ok: boolean; ticket: SupportTicketAdminView; messages: SupportTicketMessageView[] }>(
    `/api/feedback/admin/tickets/${encodeURIComponent(id)}`,
  )
}

export async function postAdminSupportReply(id: string, input: { message: string; status?: string }) {
  return request<{ ok: boolean; message: SupportTicketMessageView }>(
    `/api/feedback/admin/tickets/${encodeURIComponent(id)}/reply`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export async function patchAdminSupportTicket(id: string, patch: Record<string, unknown>) {
  return request<{ ok: boolean; ticket: SupportTicketAdminView }>(
    `/api/feedback/admin/tickets/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
}

export async function fetchAdminFeedbackSummary() {
  return request<{ ok: boolean; summary: Record<string, unknown>; events: unknown[] }>('/api/feedback/admin/summary')
}

export async function fetchAdminFeedbackItems(query = '') {
  return request<{ ok: boolean; items: Record<string, unknown>[] }>(`/api/feedback/admin/items${query}`)
}

export async function patchAdminFeedbackItem(id: string, patch: Record<string, unknown>) {
  return request<{ ok: boolean; item: Record<string, unknown> }>(`/api/feedback/admin/items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}
