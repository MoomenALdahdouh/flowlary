# Flowlary Product Statistics Definitions

This document defines every public and internal statistic used in Phase 2 Trust & Social Proof.

## Registered users (`registeredUsers`)

**Definition:** Count of account records in the Flowlary JSON store.

**Includes:** All accounts created via `/api/auth/register` (any plan/status).

**Excludes:** Anonymous extension-only usage without an account.

**Public label:** “Registered writers” (EN) / “كتّاب مسجلون” (AR)

**Never label as:** “Users” without qualifier when meaning registered accounts.

---

## Active users last 30 days (`activeUsersLast30Days`)

**Definition:** Distinct accounts with either:

1. At least one successful AI usage record (`UsagePersistRecord.status === 'success'`) in the last 30 UTC days, or
2. Feedback preference activity (`activeDayKeys` or `firstWinCompletedAt`) in the last 30 days.

**Public label:** Must include timeframe if shown — not plain “users”.

---

## Writing checks (`writingChecks`)

**Definition:** Count of successful AI gateway usage records across all accounts.

**Operations:** `correction`, `translation`, `layout-classification`.

**Note:** Store caps usage history at 50,000 rows — totals may truncate in long-running single-process deployments.

**Sub-metrics:**

- `corrections` — operation `correction`
- `translations` — operation `translation`
- `layoutChecks` — operation `layout-classification`

---

## Linked installs (`linkedInstalls`)

**Definition:** Count of `InstallLinkRecord` entries (extension install IDs linked to accounts or anonymous).

**Not:** Chrome Web Store download count. Never label as “installs” without source.

---

## Internal rating (`averageInternalRating`, `internalRatingCount`)

**Definition:** Mean of 1–5 ratings stored in feedback records with a non-null `rating`.

**Source label (required when public):** “Flowlary user rating”

**Public threshold:** Minimum 10 ratings (`PRODUCT_STATISTICS_THRESHOLDS.minInternalRatings`).

**Distinct from:** Chrome Web Store rating, Edge Add-ons rating.

---

## Store ratings (`chromeRating`, `edgeRating`)

**Definition:** Manually configured, externally verified values from env:

- `CHROME_STORE_RATING`, `CHROME_STORE_REVIEW_COUNT`
- `EDGE_STORE_RATING`, `EDGE_STORE_REVIEW_COUNT`

**Never scraped or invented.** Hidden when env values are unset.

---

## Testimonials

**Definition:** Feedback with explicit `testimonialConsent: yes`, stored in `testimonialsById`.

**Public display:** Only records with `published: true`.

**Minimum for reviews section:** 3 published testimonials.

**Never auto-publish** support messages or private feedback.

---

## Feature requests (public)

**Definition:** Feature request records with `publicRoadmap: true`.

**Votes:** Server-side `voteCount`; one vote per account.

---

## First Win (`firstWinCompletedAt`)

**Definition:** Server timestamp set when extension calls `POST /api/feedback/first-win` after local First Win completion.

**Not inferred** from extension-local state alone.

---

## Meaningful use (`meaningfulUseCount`)

**Definition:** Incremented when extension reports successful command execution via `POST /api/feedback/meaningful-use`.

---

## Personal account statistics

Returned only via `GET /api/account/statistics` for the authenticated account.

Never mixed with global metrics in UI without clear labeling.

---

## Public vs internal

| Statistic | Public API | Admin dashboard |
|-----------|------------|-----------------|
| Registered users | Yes, if ≥1 & enabled | Yes |
| Writing checks | Yes, if >0 & enabled | Yes |
| Internal rating | Yes, if ≥10 ratings | Yes |
| Store ratings | Yes, if verified env set | N/A |
| Testimonials | Published only | Full list |
| Retention D1/D7/D30 | No | Not instrumented |
| MRR | No | Approximate from active Pro subs × list price |

---

## Trust states

Each public metric uses:

- `AVAILABLE` — real data meets threshold and flag enabled
- `INSUFFICIENT_DATA` — below threshold or zero
- `DISABLED` — admin/env flag off

**Never substitute placeholder numbers for `INSUFFICIENT_DATA`.**
