# Flowlary VoC — Phase 1 Implementation Report

**Date:** 2026-08-30  
**Scope:** Voice of Customer, feedback, support, feature requests, admin inbox (V1)

---

## 1. Implementation summary

Production-grade **Phase 1 VoC foundation** implemented across backend, website, and extension without modifying protected commercial, auth, AI, or billing systems.

**Delivered:**
- Shared feedback types and limits (`packages/shared/src/feedback.ts`)
- JSON store slice + persistence (`backend/src/db/feedbackStoreSlice.ts`, `store.ts`)
- Feedback service with eligibility, cooldowns, rate limits, admin views (`backend/src/services/feedbackService.ts`)
- Authenticated HTTP APIs + public config route (`backend/src/routes/http.ts`)
- Website feedback hub at `/feedback` (rating, general feedback, feature requests, support tickets)
- Support center hub actions on `/support`
- Admin inbox at `/admin/feedback` (email allowlist gated)
- Extension **Help & Feedback** link + contextual prompt plumbing
- EN/AR copy for website and extension feedback surfaces
- Integration tests (`tests/integration/feedback-voc.test.ts`)

**Not in V1 (deferred):**
- Transactional email for tickets (SMTP exists; not wired)
- AI summarization / clustering
- Full public roadmap UI (architecture supports `publicRoadmap` / `roadmapBucket`)
- Third-party analytics (internal events only)

---

## 2. Database changes

Flowlary uses a **JSON file store**, not SQL. New persisted collections in `store.ts`:

| Collection | Purpose |
|---|---|
| `feedbackById` / `feedbackIdsByAccount` | User feedback, ratings, bug reports |
| `featureRequestsById` / `featureVotes` | Feature requests + one vote per account |
| `supportTicketsById` / messages / ids-by-account | Support tickets |
| `feedbackPreferencesByAccount` | Cooldowns, dismissals, meaningful-use counters |
| `feedbackAnalyticsEvents` | Bounded internal product events (max 10k) |

---

## 3. API changes

| Route | Auth | Description |
|---|---|---|
| `GET /api/feedback/config` | Public | Store URLs, cooldowns, limits |
| `GET /api/feedback/eligibility` | Account | Eligible prompt IDs + preferences |
| `GET /api/feedback/mine` | Account | Own feedback list |
| `POST /api/feedback` | Account | Submit feedback |
| `POST /api/feedback/rating` | Account | 1–5 satisfaction rating |
| `POST /api/feedback/feature-request` | Account | Create/vote duplicate title |
| `POST /api/feedback/feature-request/:id/vote` | Account | Vote (duplicate rejected) |
| `GET /api/feedback/feature-requests` | Account | List + `votedByMe` |
| `POST /api/feedback/dismiss` | Account | Not now / don't ask again |
| `POST /api/feedback/prompt-shown` | Account | Mark prompt shown |
| `POST /api/feedback/meaningful-use` | Account | Increment usage counter |
| `POST /api/feedback/first-win` | Account | Mark first win |
| `POST /api/feedback/survey-response` | Account | Lightweight survey |
| `POST /api/support/ticket` | Account | Create ticket |
| `GET /api/support/tickets` | Account | List own tickets |
| `GET /api/support/tickets/:id` | Account | Ticket + messages |
| `POST /api/support/tickets/:id/message` | Account | Reply |
| `GET /api/feedback/admin/summary` | Admin email | Dashboard stats |
| `GET /api/feedback/admin/items` | Admin email | Filterable inbox |
| `PATCH /api/feedback/admin/items/:id` | Admin email | Status/priority/tags/notes |

**Admin auth:** `FLOWLARY_FEEDBACK_ADMIN_EMAILS` (comma-separated, server-side only).

**Rate limits:** 10 feedback / 5 feature requests / 10 tickets per account per day + operation buckets in `rateLimit.ts`.

---

## 4. Website UX

- **`/feedback`** — `FeedbackHub`: tabs for feedback, feature requests, support (sign-in required)
- **`/support`** — new hub section with CTAs (Give feedback, Suggest feature, Report problem, Billing/Student help)
- **`/admin/feedback`** — internal inbox (403 unless admin email)
- **Store review CTA** — neutral, optional; hidden when `CHROME_WEB_STORE_URL` unset

---

## 5. Extension UX

- Popup footer: **Help & Feedback** → `flowlary.com/feedback?source=extension`
- **Contextual prompt** when signed in and server eligibility allows (with Not now / Don't ask again)
- Background records **meaningful use** after successful command dispatch (correction, translation, layout)

Extension messages: `FEEDBACK_ELIGIBILITY`, `FEEDBACK_SUBMIT`, `FEEDBACK_DISMISS`, `FEEDBACK_PROMPT_SHOWN`.

---

## 6. Contextual triggers

Server-side eligibility (`getFeedbackEligibility`):

| Prompt | Trigger |
|---|---|
| `general_satisfaction` | ≥4 meaningful uses, cooldowns OK |
| `day7_usefulness` | ≥7 active days |
| `day14_feature_preference` | ≥14 active days |
| `day30_deeper` | ≥30 active days |

Extension increments meaningful use on successful commands. Contextual feature prompts architecture supports per-feature IDs; V1 shows first eligible general/contextual prompt.

---

## 7. Cooldowns

| Setting | Default |
|---|---|
| Dismissed prompt | 14 days |
| Survey completed | 30 days |
| General prompt | 14 days |
| Same contextual prompt | Not shown twice (tracked in preferences) |
| Don't ask again | Global flag respected |

---

## 8. Admin

- Summary: total, open, unresolved, feature requests, bug reports, average rating
- Item list with plan (server-derived), masked email, status
- PATCH: status, priority, tags, internal notes, resolve

---

## 9. Privacy

**Collected (with consent/context):** feedback message, optional diagnostics (browser UA, extension version), rating, feature/surface metadata.

**Not collected:** user writing text (unless explicitly submitted), page contents, passwords, tokens, payment details.

---

## 10. Store integration

- `CHROME_WEB_STORE_URL` / `EDGE_ADDONS_URL` in backend env
- CTA only when URL configured; otherwise placeholder copy
- No forced reviews, incentives, or automation

---

## 11. Tests

| Suite | Result |
|---|---|
| `feedback-voc.test.ts` | **7/7 passed** |
| Backend full (`npm run test -w @flowlary/backend`) | **134/134 passed** |
| Website (`npm run test:web`) | **137/137 passed** |

---

## 12. Build

| Command | Result |
|---|---|
| `npm run build:web` | **Passed** (17 prerendered routes) |
| `npm run build:release` | **Passed** |

---

## 13. Protected systems verification

| System | Status |
|---|---|
| AI / Groq gateway | **Unchanged** |
| Credits (500/1000/1000 daily, 30k cap) | **Unchanged** |
| Pricing ($4.99/mo, $39/yr) | **Unchanged** |
| Paddle / billing | **Unchanged** |
| Auth / JWT | **Unchanged** |
| Entitlement / student | **Unchanged** |
| Extension security bridge | **Unchanged** |

---

## 14. Remaining risks

1. **`FLOWLARY_FEEDBACK_ADMIN_EMAILS`** must be set in production for admin inbox access.
2. **Store URLs** unset until real listings exist — store CTA hidden (by design).
3. **Support ticket email** notifications not wired — users see in-app success only until SMTP templates added.
4. **Admin PATCH UI** is minimal (resolve button); full tag/note editor can be expanded in Phase 2.
5. JSON store is single-process — acceptable for current architecture; plan migration if multi-instance.

---

**Verdict:** Phase 1 VoC foundation is **engineering complete** for internal dogfooding. Production rollout requires admin email config and optional store URLs.
