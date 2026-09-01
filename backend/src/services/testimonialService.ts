import type { TestimonialDisplayPreference } from '@flowlary/shared'
import { GatewayError } from '../gateway/errors.ts'
import {
  getTestimonialByFeedbackId,
  insertTestimonial,
  listAllTestimonials,
  listPublishedTestimonials,
  updateTestimonial,
  normalizeDisplayPreference,
} from '../db/testimonialStoreSlice.ts'
import { findAccountById, touch } from '../db/store.ts'
import { maskEmail } from './emailService.ts'
import type { AccountRecord } from '../db/store.ts'
import type { FeedbackRecord } from '../db/feedbackStoreSlice.ts'

function buildDisplayName(
  account: AccountRecord,
  preference: TestimonialDisplayPreference,
  override?: string | null,
): string {
  if (preference === 'anonymous') return 'Flowlary writer'
  if (override?.trim()) return override.trim().slice(0, 80)
  const local = account.email.split('@')[0] ?? 'Writer'
  if (preference === 'first_initial') {
    const initial = local.length > 1 ? `${local[0]?.toUpperCase()}.` : local
    return `${initial} ${local.slice(1, 2).toUpperCase()}.`.trim()
  }
  return local.slice(0, 80)
}

export function maybeCreateTestimonialFromFeedback(
  account: AccountRecord,
  feedback: FeedbackRecord,
  body: Record<string, unknown>,
): void {
  const consent = body.testimonialConsent === 'yes' ? 'yes' : body.testimonialConsent === 'no' ? 'no' : null
  if (consent !== 'yes') return
  if (getTestimonialByFeedbackId(feedback.id)) return
  const preference = normalizeDisplayPreference(body.testimonialDisplayPreference) ?? 'first_initial'
  const quote = feedback.message.trim()
  if (!quote) return
  insertTestimonial({
    feedbackId: feedback.id,
    accountId: account.id,
    displayName: buildDisplayName(
      account,
      preference,
      typeof body.testimonialDisplayName === 'string' ? body.testimonialDisplayName : null,
    ),
    role: typeof body.testimonialRole === 'string' ? body.testimonialRole.slice(0, 80) : null,
    country: typeof body.testimonialCountry === 'string' ? body.testimonialCountry.slice(0, 64) : null,
    originalQuote: quote,
    displayQuote: quote,
    feature: feedback.feature,
    consentGiven: true,
    displayPreference: preference,
  })
  touch()
}

export function adminListTestimonials() {
  return listAllTestimonials().map((item) => ({
    ...item,
    accountEmailMasked: maskEmail(findAccountById(item.accountId)?.email ?? 'unknown'),
  }))
}

export function adminUpdateTestimonial(id: string, patch: Record<string, unknown>) {
  const current = listAllTestimonials().find((item) => item.id === id)
  if (!current) throw new GatewayError('AI_INVALID_REQUEST', 'Testimonial not found', 404, 'testimonial-admin')
  const next = updateTestimonial(id, {
    displayName: typeof patch.displayName === 'string' ? patch.displayName.slice(0, 80) : undefined,
    role: typeof patch.role === 'string' ? patch.role.slice(0, 80) : patch.role === null ? null : undefined,
    country: typeof patch.country === 'string' ? patch.country.slice(0, 64) : patch.country === null ? null : undefined,
    displayQuote: typeof patch.displayQuote === 'string' ? patch.displayQuote.slice(0, 4000) : undefined,
    published: typeof patch.published === 'boolean' ? patch.published : undefined,
    approvedAt:
      patch.published === true ? Date.now() : patch.published === false ? null : undefined,
  })
  if (!next) throw new GatewayError('AI_INVALID_REQUEST', 'Could not update testimonial', 400, 'testimonial-admin')
  touch()
  return next
}

export function listPublicTestimonials(limit = 6) {
  return listPublishedTestimonials(limit)
}
