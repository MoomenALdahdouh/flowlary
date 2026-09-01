# Flowlary Free Plan Limits

Approved acquisition-first limits (single source of truth: `packages/shared/src/credits.ts`).

| Plan | Daily AI writing checks |
|------|-------------------------|
| **Free** | **500** |
| **Trial** | **1,000** (30-day registration trial) |
| **Pro** | **1,000** |

Pro monthly soft cap: **30,000** (`PRO_MONTHLY_SOFT_CAP`) — coherent with 1,000/day × 30 days.

Daily reset: **00:00 UTC**. No rollover. No accumulation.

---

## What is an AI writing check?

One **successful** AI analysis that Flowlary performs on your writing counts as **1 AI writing check**.

- A single check may surface **multiple** corrections — that is still **one** check.
- Checks are **not** word count, character count, or “number of errors.”
- You can write as much as you want; the daily allowance limits **how many times** Flowlary runs AI on your writing.

---

## What consumes a check?

| Action | Uses a check? |
|--------|----------------|
| Successful writing correction (extension or website) | **Yes** (1) |
| Successful layout classification (when AI-backed) | **Yes** (1) |
| Successful practice scoring (AI-backed) | **Yes** (1) |
| Groq-backed translation / live translation fallback | **Yes** (weighted: 2 when Groq is used) |
| Explanation localization (Pro) | **Yes** (1) |

Reservation model: **reserve → provider call → success finalize debit**. Failures, timeouts, and aborts **refund** the reservation.

---

## What does **not** consume a check?

- Failed requests, timeouts, provider errors, aborted requests
- Cache hits (same text already processed)
- Duplicate unchanged segment (deduplication)
- **Google Translation** when Google routing is active (**0 checks**)
- Local-only features (see below)

---

## Local tools (unlimited on Free)

These do **not** use AI writing checks:

- Keyboard Layout Repair (Fix Layout)
- Speed Box
- Local spelling / safety hints
- Privacy controls and Pause
- Local keyboard layout practice

---

## Long fields and segmentation

Flowlary is designed for **everywhere writing** — Gmail, Notion, ChatGPT, long emails, etc.

The extension does **not** disable correction when a field exceeds 250 characters. Instead:

1. **Current writing segment** — last paragraph or a bounded recent window (~480 chars, max 2,000)
2. **Bounded context** — optional previous text, truncated server-side
3. **Hard payload cap** — backend truncates to `MAX_CORRECTION_CHARS` (2,000) before Groq

The AI analyzes the **segment + bounded context**, not the entire document. This protects cost, latency, and privacy.

---

## Exhaustion (Free at 0 checks)

When daily checks reach **0**:

- AI correction and other check-consuming AI features pause until UTC reset
- **Writing continues normally**
- Local tools, Speed Box, Fix Layout, Google translation, settings, and navigation **stay available**
- No extension lockout; no forced upgrade modal

Recommended messaging:

> You've used today's AI writing checks. Your local Flowlary tools and Google translation are still available. AI checks reset tomorrow.

> Upgrade to Pro for more AI checks and advanced learning tools.

Low-credit warning when remaining ≤ **50** (`LOW_CREDITS_THRESHOLD`).

---

## Pro differentiation

Pro wins on **capacity and depth**, not by making Free unusable:

| Free | Pro |
|------|-----|
| 500 checks/day | 1,000 checks/day |
| Basic learning & progress | Full learning, practice, advanced progress |
| — | Learning Coach |
| — | Learning reports & export |
| — | Explanation localization |
| — | AI translation refinement (Groq) where configured |
| — | Recurring-error insights |

---

## Anti-abuse (not credit starvation)

Abuse is controlled separately from generous Free limits:

- Authentication required for managed AI
- Server-side entitlement and credit accounting
- Rate limits (e.g. Free **45 requests/minute** per operation class)
- Account isolation and trial protections

---

## Terminology (EN / AR)

Use **“AI writing checks”** (EN) / **“فحوصات الكتابة بالذكاء الاصطناعي”** (AR).

Do **not** advertise a fixed word limit per day.

---

## Related code

| Area | Location |
|------|----------|
| Constants | `packages/shared/src/credits.ts` |
| Pricing display | `packages/shared/src/pricing.ts` → `FLOWLARY_PRICING` |
| Usage UX copy | `packages/shared/src/usageUx.ts` |
| Segmentation | `extension/src/features/correction/segment.ts` |
| Provider truncate | `backend/src/providers/correctionProvider.ts` |
| Reserve/debit | `backend/src/services/accountService.ts`, `backend/src/gateway/index.ts` |
