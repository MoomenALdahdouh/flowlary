# Phase 2 — Trust, Social Proof & Product Statistics

Implementation report for the Flowlary monorepo Phase 2 deliverable.

**Principle:** Real data only. Metrics hide when insufficient — never replaced with invented numbers.

---

## 1. What was implemented

### P0 (complete)

| Item | Status |
|------|--------|
| Repository audit | Done — reused JSON store, feedback system, usage records |
| `SUPPORTED_PLATFORMS` central config | `packages/shared/src/platforms.ts` |
| `ProductStatisticsService` | `backend/src/services/productStatisticsService.ts` |
| Public stats API + caching | `GET /api/public/stats` (10 min cache) |
| Personal account statistics | `GET /api/account/statistics` |
| Admin growth dashboard | `GET /api/admin/growth/summary` + `/admin/growth` UI |
| Supported platforms section | `SupportedPlatformsSection` |
| First Win server sync | `POST /api/feedback/first-win` from extension |

### P1 (complete)

| Item | Status |
|------|--------|
| Testimonials + consent (backend) | `testimonialStoreSlice`, `testimonialService` |
| Testimonial consent UI | `FeedbackHub` — Yes/No + display preference |
| Admin testimonial publish | `/admin/growth` — publish/unpublish |
| Trust strip | `TrustStrip` — renders only `AVAILABLE` metrics |
| User reviews section | `UserReviewsSection` — ≥3 published testimonials |
| Feature request public proof | `FeatureRequestsProof` — `publicRoadmap` only |
| Built with users CTA | `BuiltWithUsersSection` |
| About page trust layer | `ProductProofSections` on About |
| Pricing trust signals | `pricing.trust[]` cards on Pricing |

### P2 (partial — by design)

| Item | Status |
|------|--------|
| Public roadmap UI | Data model supports `publicRoadmap` / `roadmapBucket`; no dedicated roadmap page yet |
| Store rating config | Env-based verified ratings (`CHROME_STORE_RATING`, etc.); no admin UI |
| Retention D1/D7/D30 | Marked **not instrumented** in growth summary |

---

## 2. Database changes

Persisted in existing JSON store (`backend/src/db/store.ts`):

```text
testimonialsById          — testimonial records keyed by ID
publishedTestimonialIds   — ordered list of published testimonial IDs
```

New slice: `backend/src/db/testimonialStoreSlice.ts`

Reused (no duplication):

- `accountsById` — registered user count
- `usageRecords` — writing checks / corrections / translations
- `feedbackById` — internal ratings
- `featureRequestsById` — public feature voting
- `feedbackPreferencesByAccountId` — First Win, meaningful use, active days
- `installLinksById` — linked installs (not store downloads)
- `subscriptionsById` — monetization segment in growth dashboard

---

## 3. API changes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/public/stats` | Public | Aggregate trust payload (stats, platforms, testimonials, feature requests) |
| GET | `/api/public/feature-requests` | Public | Public roadmap feature requests only |
| GET | `/api/account/statistics` | Bearer | Personal usage stats for authenticated account |
| GET | `/api/admin/growth/summary` | Admin | Internal funnel + acquisition/engagement aggregates |
| GET | `/api/admin/testimonials` | Admin | All testimonials with masked email |
| PATCH | `/api/admin/testimonials/:id` | Admin | Publish/unpublish, edit display fields |
| POST | `/api/feedback/first-win` | Bearer | Server First Win timestamp (extension sync) |

Feedback submit body extended (optional):

```text
testimonialConsent: 'yes' | 'no'
testimonialDisplayPreference: 'full_name' | 'first_initial' | 'anonymous'
testimonialDisplayName, testimonialRole, testimonialCountry
```

---

## 4. Public statistics

Source: `buildPublicTrustPayload()` → cached 10 minutes.

**Included only when real + above threshold + flag enabled:**

| Field | Source | Min threshold |
|-------|--------|---------------|
| `registeredUsers` | Account count | 1 |
| `writingChecks` | Successful usage records | 1 |
| `activeUsersLast30Days` | Usage + preferences | Internal only (not in public strip by default) |
| Internal rating | Feedback ratings average | 10 ratings |
| Store ratings | Verified env config | Both rating + count required |
| Testimonials | Published testimonials | 3 for reviews section |
| Feature requests | `publicRoadmap: true` | Any with votes |

**Trust states:** `AVAILABLE` | `INSUFFICIENT_DATA` | `DISABLED`

Env flags (`backend/src/config/env.ts`):

```text
FLOWLARY_PUBLIC_STATS_ENABLED
FLOWLARY_PUBLIC_SHOW_REGISTERED_USERS
FLOWLARY_PUBLIC_SHOW_WRITING_CHECKS
FLOWLARY_PUBLIC_SHOW_RATING
FLOWLARY_PUBLIC_SHOW_REVIEWS
FLOWLARY_PUBLIC_SHOW_TESTIMONIALS
FLOWLARY_PUBLIC_SHOW_PLATFORMS
CHROME_STORE_RATING / CHROME_STORE_REVIEW_COUNT / CHROME_STORE_RATING_VERIFIED_AT
EDGE_STORE_RATING / EDGE_STORE_REVIEW_COUNT / EDGE_STORE_RATING_VERIFIED_AT
```

---

## 5. Account statistics

`GET /api/account/statistics` returns per-account:

- Writing checks used, corrections, translations, layout checks
- Learning events, practice sessions
- Active days, meaningful use count
- First Win completed (boolean + timestamp)
- Credits used today

Rendered in dashboard `PersonalStatsCard` (`OverviewPanel`).

---

## 6. Admin dashboard

Route: `/admin/growth`

Sections:

- **Acquisition:** registered users, linked installs, student applications, trial starts
- **Activation:** First Win started/completed counts
- **Engagement:** DAU/WAU/MAU (from usage), feature usage breakdown
- **Monetization:** active Pro subs, approximate MRR (monthly list price × count)
- **Funnel:** visitor → signup → install → First Win → meaningful use → trial → Pro (stages without data show "not instrumented")
- **Testimonials:** publish/unpublish workflow

Access: `FLOWLARY_FEEDBACK_ADMIN_EMAILS` (same as feedback admin).

---

## 7. Testimonials

Flow:

1. User submits feedback with `testimonialConsent: 'yes'`
2. `maybeCreateTestimonialFromFeedback()` creates draft (unpublished)
3. Admin reviews at `/admin/growth`
4. Admin publishes → appears in `UserReviewsSection` when ≥3 published

Fields stored: `originalQuote`, `displayQuote`, `displayName`, `role`, `country`, `displayPreference`, `consentGiven`, `published`, `approvedAt`.

Never auto-publishes. Email never exposed publicly (masked in admin only).

---

## 8. Feature requests

Public exposure: only records with `publicRoadmap: true`.

`FeatureRequestsProof` shows title + vote count + status. Voting remains authenticated via existing feedback API.

---

## 9. Supported platforms

Central config: `packages/shared/src/platforms.ts` → `SUPPORTED_PLATFORMS`.

Conservative list:

- Chrome (architecture)
- Web forms / textareas (field-type)
- Contenteditable (field-type)
- Same-origin iframes (architecture)
- Code editors marked **unsupported**

No per-site logos (Gmail, Notion, etc.) unless individually verified — avoids false marketing claims.

---

## 10. Analytics events

Extended feedback event taxonomy:

```text
testimonial_consent_given
first_win_started / first_win_completed (extension local + server sync)
```

Existing VoC events reused: `feedback_submitted`, `rating_submitted`, `feature_request_created`, `feature_request_voted`.

No third-party analytics installed. Client event helpers remain no-op stubs for future vendor connection.

---

## 11. Privacy model

Public API returns **aggregate counts only**. Never exposes:

- User IDs, emails, account details
- Private feedback or support messages (unless published testimonial)
- Writing content, page URLs, payment data

Personal stats require Bearer auth and are scoped to the authenticated account.

Admin views mask emails (`maskEmail`).

---

## 12. Store integration

Chrome/Edge install counts are **not scraped**.

Optional verified ratings via env (manual admin verification with `verifiedAt` timestamp).

Store review CTA in FeedbackHub only when `CHROME_WEB_STORE_URL` is configured — no rating manipulation.

---

## 13. EN / AR implementation

New `trust` i18n namespace in `website/src/i18n/en.ts` and `ar.ts`:

- Trust strip labels with source attribution
- Platform names/descriptions
- Reviews, feature requests, built-with-users CTAs
- Personal stats labels
- Admin growth + testimonial admin copy
- Testimonial consent form (natural Arabic — "كتّاب مسجلون", not awkward literal translations)

RTL: existing site RTL layout applies; trust grids use responsive CSS in `global.css`.

---

## 14. Responsive QA

Trust components use:

- `.trust-strip-grid` — collapses to single column on narrow viewports
- `.platform-grid` — 2→1 column
- `.reviews-grid` — stacked cards on mobile

No fixed-width stat walls. Verified via existing design foundation breakpoints (360–1440).

---

## 15. Accessibility QA

- Semantic headings (`h2`, `dl`/`dt`/`dd` for stats)
- `aria-labelledby` on trust strip
- Screen-reader-only title where visual lead suffices
- Rating source labels visible (not color-only)
- Testimonial consent uses `fieldset`/`legend` + radiogroup
- Keyboard-accessible chips and publish buttons

---

## 16. Tests

| Suite | Result |
|-------|--------|
| `tests/integration/phase2-trust-stats.test.ts` | 9/9 pass |
| Backend (`npm test -w @flowlary/backend`) | 143/143 pass |
| Website (`npm run test:web`) | 137/137 pass |
| `npm run build:web` | Pass |
| `npm run build:release` | Pass |

Phase 2 tests cover:

- Public stats omit unavailable metrics
- Registered users appear only when accounts exist
- Store ratings hidden without verified config
- Personal stats account isolation
- Growth admin 403 for non-admin
- Testimonial requires explicit consent
- Protected commercial constants unchanged

**Note:** Root `npm test` includes extension workspace; 9 extension integration tests timed out (pre-existing flaky timers in `wl4d-daily-brief` and related suites — unrelated to Phase 2 changes).

---

## 17. Builds

```bash
npm run test:web          # 137 passed
npm run build:web         # tsc + vite + prerender — pass
npm run build:release     # extension + website — pass
npm test -w @flowlary/backend  # 143 passed
```

---

## 18. Protected systems verification

**Commercial constants — unchanged:**

```text
FREE_DAILY_CREDITS === 500
PRO_DAILY_CREDITS === 1000
TRIAL_DAILY_CREDITS === 1000
PRO_MONTHLY_SOFT_CAP === 30000
PRO_MONTHLY_PRICE_CENTS === 499
PRO_YEARLY_PRICE_CENTS === 3900
```

**Protected systems — not modified:**

Authentication, JWT, AI gateway, Groq routing, credits enforcement, Paddle billing, student verification/entitlement, extension auth bridge, correction/translation/layout/learning engines, security boundaries.

---

## 19. Remaining limitations

1. **Usage cap:** Store retains max 50,000 usage rows — global writing-check totals may truncate in long-running deployments.
2. **MRR approximation:** Growth dashboard uses `activeProSubs × PRO_MONTHLY_PRICE_CENTS`; yearly billing not fully reflected.
3. **Retention / visitors:** D1/D7/D30 and website visitor funnel marked "not instrumented".
4. **Linked installs ≠ store downloads:** `linkedInstalls` counts install-ID links, not Chrome Web Store numbers.
5. **Public roadmap page:** P2 — data model ready, dedicated UI deferred.
6. **Store rating admin UI:** P2 — env-only configuration.
7. **Growth dashboard UI:** JSON summary + testimonial list; charts/filters deferred.

---

## 20. Data sources for every public statistic

| Public display | Data source | Hidden when |
|----------------|-------------|-------------|
| Registered writers | `listAllAccounts().length` | 0 accounts or flag off |
| Writing checks | Successful `usageRecords` | 0 usage or flag off |
| Flowlary user rating | Mean of feedback `rating` fields | <10 ratings |
| Chrome/Edge rating | Env verified config | Env unset |
| Testimonials | `publishedTestimonialIds` | <3 published |
| Feature votes | `publicRoadmap` feature requests | None public |
| Platforms | `SUPPORTED_PLATFORMS` where `supported: true` | Flag off |

---

## Final audit (repository search)

Searched for fake marketing numbers (`10,000+`, `4.9/5`, `1M+`, `trusted by`, hardcoded user counts):

- **No fake public statistics** in website/extension source.
- **No `aggregateRating` JSON-LD** added (`seo.test.tsx` asserts absence).
- About page copy explicitly states stats appear only when backed by data.
- Pricing trust cards are qualitative (secure checkout, free stays useful) — not numeric vanity metrics.

---

## Related documentation

- Definitions: `docs/product/PRODUCT_STATISTICS_DEFINITIONS.md`
- Phase 1 VoC: `docs/product/FLOWLARY_VOC_PHASE1_REPORT.md`

---

*Phase 2 complete. The infrastructure earns social proof as real usage grows — it never fabricates it.*
