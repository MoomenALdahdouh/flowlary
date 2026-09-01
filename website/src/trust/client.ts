import type { AccountPersonalStatsView, PublicTrustPayload } from '@flowlary/shared'
import { resolvePublicApiUrl } from '../config.ts'
import { peekWebSession } from '../account/client.ts'

export async function fetchPublicTrust(): Promise<PublicTrustPayload | null> {
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/public/stats`, {
      headers: { 'X-Flowlary-Client': 'website' },
    })
    if (!response.ok) return null
    const body = (await response.json()) as PublicTrustPayload & { ok?: boolean }
    return body
  } catch {
    return null
  }
}

export async function fetchAccountStatistics(): Promise<AccountPersonalStatsView | null> {
  const session = peekWebSession()
  if (!session?.accessToken) return null
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/account/statistics`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Flowlary-Client': 'website',
      },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok: boolean; statistics: AccountPersonalStatsView }
    return body.statistics
  } catch {
    return null
  }
}

export async function fetchAdminGrowthSummary(): Promise<Record<string, unknown> | null> {
  const session = peekWebSession()
  if (!session?.accessToken) return null
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/admin/growth/summary`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Flowlary-Client': 'website',
      },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok: boolean; summary: Record<string, unknown> }
    return body.summary
  } catch {
    return null
  }
}

export type AdminTestimonialRow = {
  id: string
  displayName: string
  role: string | null
  country: string | null
  displayQuote: string
  published: boolean
  approvedAt: number | null
  accountEmailMasked: string
}

export async function fetchAdminTestimonials(): Promise<AdminTestimonialRow[] | null> {
  const session = peekWebSession()
  if (!session?.accessToken) return null
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/admin/testimonials`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Flowlary-Client': 'website',
      },
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok: boolean; items: AdminTestimonialRow[] }
    return body.items
  } catch {
    return null
  }
}

export async function patchAdminTestimonial(
  id: string,
  patch: Partial<Pick<AdminTestimonialRow, 'displayName' | 'role' | 'country' | 'displayQuote' | 'published'>>,
): Promise<boolean> {
  const session = peekWebSession()
  if (!session?.accessToken) return false
  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/admin/testimonials/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        'X-Flowlary-Client': 'website',
      },
      body: JSON.stringify(patch),
    })
    return response.ok
  } catch {
    return false
  }
}
