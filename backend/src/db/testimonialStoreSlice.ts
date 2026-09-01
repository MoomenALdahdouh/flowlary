import { randomUUID } from 'node:crypto'
import type { TestimonialDisplayPreference, TestimonialRecord } from '@flowlary/shared'

type TestimonialSlice = {
  testimonialsById: Record<string, TestimonialRecord>
  publishedIds: string[]
}

const EMPTY: TestimonialSlice = { testimonialsById: {}, publishedIds: [] }
let slice: TestimonialSlice = { ...EMPTY, testimonialsById: {} }

export function loadTestimonialSlice(raw: Partial<TestimonialSlice> | undefined): void {
  slice = {
    testimonialsById: raw?.testimonialsById ?? {},
    publishedIds: Array.isArray(raw?.publishedIds) ? raw!.publishedIds! : [],
  }
}

export function testimonialSliceSnapshot(): TestimonialSlice {
  return {
    testimonialsById: { ...slice.testimonialsById },
    publishedIds: [...slice.publishedIds],
  }
}

export function resetTestimonialSliceForTests(): void {
  slice = { testimonialsById: {}, publishedIds: [] }
}

export function insertTestimonial(
  record: Omit<TestimonialRecord, 'id' | 'createdAt' | 'updatedAt' | 'approvedAt' | 'published'> & {
    id?: string
    approvedAt?: number | null
    published?: boolean
  },
): TestimonialRecord {
  const now = Date.now()
  const item: TestimonialRecord = {
    id: record.id ?? randomUUID(),
    feedbackId: record.feedbackId,
    accountId: record.accountId,
    displayName: record.displayName,
    role: record.role,
    country: record.country,
    originalQuote: record.originalQuote,
    displayQuote: record.displayQuote,
    feature: record.feature,
    consentGiven: record.consentGiven,
    displayPreference: record.displayPreference,
    approvedAt: record.approvedAt ?? null,
    published: record.published ?? false,
    createdAt: now,
    updatedAt: now,
  }
  slice.testimonialsById[item.id] = item
  return item
}

export function getTestimonialById(id: string): TestimonialRecord | null {
  return slice.testimonialsById[id] ?? null
}

export function getTestimonialByFeedbackId(feedbackId: string): TestimonialRecord | null {
  return Object.values(slice.testimonialsById).find((item) => item.feedbackId === feedbackId) ?? null
}

export function listPublishedTestimonials(limit = 12): TestimonialRecord[] {
  return slice.publishedIds
    .map((id) => slice.testimonialsById[id])
    .filter((item): item is TestimonialRecord => Boolean(item?.published))
    .slice(0, limit)
}

export function listAllTestimonials(): TestimonialRecord[] {
  return Object.values(slice.testimonialsById).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function updateTestimonial(id: string, patch: Partial<TestimonialRecord>): TestimonialRecord | null {
  const current = slice.testimonialsById[id]
  if (!current) return null
  const next = { ...current, ...patch, updatedAt: Date.now() }
  slice.testimonialsById[id] = next
  if (next.published && !slice.publishedIds.includes(id)) {
    slice.publishedIds.unshift(id)
  }
  if (!next.published) {
    slice.publishedIds = slice.publishedIds.filter((itemId) => itemId !== id)
  }
  return next
}

export function normalizeDisplayPreference(value: unknown): TestimonialDisplayPreference | null {
  if (value === 'full_name' || value === 'first_initial' || value === 'anonymous') return value
  return null
}
