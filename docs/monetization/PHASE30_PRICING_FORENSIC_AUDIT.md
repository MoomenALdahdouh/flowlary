# PHASE 30 — Pricing & Monetization Forensic Audit

**Mode:** AUDIT ONLY — no implementation, no refactors, no product changes.  
**Date:** 2026-08-26  
**Authority:** Repository code + automated tests + live probes. Prior phase reports are context only.

---

# Executive Summary

Flowlary’s **runtime monetization model is coherent and largely server-authoritative**:

| Concern | Canonical source |
| --- | --- |
| List prices | `packages/shared/src/pricing.ts` — **$9 / $90** |
| Trial length | `ACCOUNT_TRIAL_DURATION_MS` — **30 days** |
| AI credits | `packages/shared/src/credits.ts` — Free **40**/day, Trial/Pro **200**/day, Pro soft **1500**/month |
| Weights | Correction / Layout AI / Practice = **1**; Translation / Live = **2** |
| Capabilities | `packages/shared/src/capabilities.ts` |
| Pro grant | Verified Paddle webhook → subscription → `subscriptionGrantsPro` → entitlement |
| Managed AI auth | Account JWT required; **install tokens denied** |

**Live production billing/DNS could not be verified** (`flowlary.com` / `api.flowlary.com` do not resolve from this environment). Checkout is **code-complete but env-gated** (`checkoutAvailable`).

No client path was found that grants managed Pro or unlimited AI. Remaining risks are mostly **ops/scale**, **product soft-gates** (Free practice), **docs drift**, and **UX consistency**.

---

# Current Architecture

## Monetization map (request flow)

```
USER
  ↓
EXTENSION (popup / content / dashboard)  OR  WEBSITE (pricing / account)
  ↓
AUTH
  · Install: Bearer install token + X-Flowlary-Install-Id  → allowed:false for AI
  · Account: JWT (sub=accountId)                          → resolveServerEntitlementForAccount
  · Client header X-Flowlary-Entitlement                  → telemetry only (not authority)
  ↓
ACCOUNT  (JSON store AccountRecord)
  ↓
ENTITLEMENT  resolveServerEntitlementForAccount()
  · suspended → local-only
  · subscription GrantsPro → pro
  · trialEndsAt > now → trial
  · else free
  ↓
FEATURE GATE
  · Client: EntitlementService.canUseFeature (UX / preflight)
  · Server: assertEntitlementAllowed + capabilities in gateway
  ↓
USAGE CHECK + CREDIT RESERVATION  reserveManagedUsage()
  · dailyCreditsUsed += weight (sync, single-process)
  · optional monthly soft-cap for trial/pro
  ↓
RATE LIMIT  checkRateLimit(userId, tier, operation)  [separate from credits]
  ↓
AI PROVIDER  (server-side Groq; not exposed to users)
  ↓
FINALIZE / RELEASE
  · success → finalizeManagedUsageReservation (keep debit)
  · failure → releaseManagedUsageReservation (refund weight)
  ↓
RESPONSE → CLIENT
  · Extension syncs /api/account/entitlement → chrome.storage cache
  · Website sessionStorage web session + entitlement fetch
```

### Key files

| Layer | Files |
| --- | --- |
| Shared SoT | `packages/shared/src/{pricing,credits,capabilities,usageUx,account/types,entitlement/index}.ts` |
| Backend auth | `backend/src/middleware/{auth,entitlement,rateLimit}.ts` |
| Credits | `backend/src/services/accountService.ts` (`reserve*` / `finalize*` / `release*`) |
| Gateway | `backend/src/gateway/index.ts` |
| Billing | `backend/src/billing/{index,webhook,paddleApi,paddleSignature,subscriptionMap}.ts` |
| Store | `backend/src/db/store.ts` |
| Extension AI | `extension/src/background/{correct,translate,classify}.ts` |
| Extension mirror | `extension/src/config/accountAuth.ts`, `entitlement/service.ts` |
| Website | `website/src/account/billing.ts`, `pages/{Account,Pricing*}.tsx`, `i18n/en.ts` |

---

# Pricing Definitions

## Inventory (active runtime)

| Location | Definition | Value | Used by | Active | SoT | Duplicate | Conflict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `packages/shared/src/pricing.ts` | Monthly/yearly cents + display | 900 / 9000 → $9 / $90; savings $18; equiv $7.50 | PricingShowcase, billing helpers, tests | YES | **YES (display)** | i18n strings | No vs code |
| `packages/shared/src/credits.ts` | Weights + daily/monthly | 1/1/1/2/2; 40; 200; 1500 | Backend + UX | YES | **YES (quota)** | Docs | Docs stale |
| `packages/shared/src/account/types.ts` | `AccountPlan`, trial ms | free\|trial\|pro; 30d | Register, pricing.trialDays | YES | **YES (trial)** | Old docs 7d | Docs only |
| `packages/shared/src/account/types.ts` | `ACCOUNT_FREE_BALANCE_MS` | **0** (deprecated) | Legacy fields | LEGACY | No | — | — |
| `packages/shared/src/capabilities.ts` | Cap sets + dailyLimitForPlan | ALWAYS_FREE / FREE_WITH_AI / FULL_PRODUCT | Server entitlement | YES | YES | — | — |
| `backend/src/config/env.ts` | Paddle price **IDs** | env | Checkout | YES | Catalog IDs | Amounts in shared | — |
| `website/src/i18n/en.ts` (+ ar) | Marketing copy | $9/$90, 30-day trial | Site | YES | No | Mirrors shared | Aligns |
| `extension/src/popup/i18n/*` | Trial/usage copy | 30-day; no $ prices | Popup | YES | No | — | OK |
| Historical PHASE24–26 docs | 7d trial, 2h, Lemon | Various | Humans reading docs | DOCS | No | **Conflicts runtime** | YES |

**VERIFIED:** One commercial SoT for amounts + credits + trial length in `packages/shared`.

---

# Free Audit

| Feature | Free | Evidence | Status |
| --- | --- | --- | --- |
| Keyboard Layout Repair (local) | Allowed always | `isLocalOnlyFeature('layout_auto')`; `keyboard.unlimited` in ALWAYS_FREE | VERIFIED |
| Speed Box | Allowed (capability declared; no UI gate) | `speedbox.unlimited` ALWAYS_FREE | PARTIALLY (effectively free) |
| Instant local spelling | Allowed | Local correction path | VERIFIED |
| Privacy / Pause / Reset | Allowed | ALWAYS_FREE caps; settings | PARTIALLY (declared, not capability-checked) |
| Activity / basic learning / basic progress | Allowed | ALWAYS_FREE | VERIFIED |
| Correction / Translation / Live / Layout AI | Conditional on account + daily credits | Gateway + `FREE_WITH_AI` when credits > 0 | VERIFIED |
| Practice | **Allowed as “basic”** — sessions not hard-blocked; Practice Check consumes AI credits | `evaluateFeatureAccess` practice.basic branch; PracticePanel Start still enabled | VERIFIED — soft product gate |
| Export / Import | Denied | Caps only on FULL_PRODUCT; SW requires capabilities | VERIFIED |
| Advanced progress / recurring | Teaser / gated | `progress.advanced` OR isPro/inTrial in dashboard | VERIFIED |

When Free AI exhausted → `LOCAL_ONLY` capabilities; local tools remain.

---

# Trial Audit

| Question | Answer | Evidence |
| --- | --- | --- |
| Duration | **30 days** | `ACCOUNT_TRIAL_DURATION_MS` in `account/types.ts` |
| Starts | On **register** | `accountService` sets `plan:'trial'`, `trialEndsAt = now + duration` |
| Ends | Lazy on entitlement resolve when `trialEndsAt <= now` → `plan='free'` | `accountService` |
| Persists | Account row in JSON store | `store.ts` |
| Server authority | **YES** for AI | Local extension trial does not unlock managed AI (`EntitlementService` requires signed-in + server cache) |
| Logout | Does **not** reset trial | Sessions cleared; account.trialEndsAt unchanged |
| Reinstall / new install token | Does **not** reset trial of existing account | New **account** = new trial (abuse surface) |
| Client clock | Cannot extend server trial | Server `Date.now()` |
| Advertised | Website/extension: 30 days | i18n MATCH |

**SERVER AUTHORITY: YES**

---

# Pro Audit

```
Paddle Checkout (server creates transaction with env price IDs)
  → User pays in Paddle overlay
  → Webhook (signed) processVerifiedPaddleEvent
  → upsert subscription + applyPlanFromSubscription
  → resolveServerEntitlementForAccount (subscriptionGrantsPro)
  → Extension/Website refresh entitlement → isPro
```

| Attack | Result |
| --- | --- |
| localStorage / extension state | No managed Pro | VERIFIED |
| Fake `X-Flowlary-Entitlement: pro` | Telemetry only | VERIFIED (`auth.ts`) |
| Checkout success URL / poll | Waits for server `isPro`; does not set Pro | VERIFIED |
| Client amount/plan on checkout body | Ignored; env price IDs used | VERIFIED |

**Caveat (server-internal):** `account.plan === 'pro'` without subscription still resolves Pro in `accountService` / reserve path. Not HTTP self-service; reachable via server-only helpers / leftover rows — **PARTIAL** authority edge, not a frontend forge path.

**Pro for managed AI: server-authoritative — YES** (with noted leftover-plan edge).

---

# AI Credit Audit

| Item | Actual | Location |
| --- | --- | --- |
| Free daily | 40 | `FREE_DAILY_CREDITS` |
| Trial/Pro daily | 200 | `PRO_DAILY_CREDITS` |
| Pro/Trial monthly soft | 1500 | `PRO_MONTHLY_SOFT_CAP` |
| Storage fields | `dailyCreditsUsed`, day key, `monthlyCreditsUsed`, month key | Account record |
| Exposed API | `creditsRemaining`, `creditsUsed`, `dailyLimit`, `resetAt` (+ transitional `remainingMs` = credit count) | Entitlement payload |
| Model | **Weighted daily credits** (not latency budget) | — |

### Weights

| Operation | Actual | Expected (approved) | Server | Client preflight | Consistent |
| --- | --- | --- | --- | --- | --- |
| Correction | 1 | 1 | YES | YES | YES |
| Layout classification | 1 | 1 | YES | YES | YES |
| Practice Check | 1 (`mode=practice`) | 1 | YES | YES | YES |
| Translation | 2 | 2 | YES | YES | YES |
| Live Translation | 2 | 2 | YES | YES | YES |

### Consumption lifecycle (all AI routes)

1. Auth + entitlement assert  
2. Rate limit  
3. **`reserveManagedUsage`** — debit weight immediately  
4. Provider call  
5. Success → **`finalize`** (drop reservation, keep debit)  
6. Failure / throw → **`release`** (refund weight)

**VERIFIED** in `gateway/index.ts` + `accountService.ts`.

---

# Usage Audit

| Concern | Behavior | Status |
| --- | --- | --- |
| Reset | Lazy UTC midnight via `refreshCreditWindows` / `resetAt` | VERIFIED |
| Client reset forge | Client cannot increase server credits | VERIFIED |
| Failed AI | Refund via release | VERIFIED |
| Timeout / 500 | Gateway catch → release | VERIFIED |
| `remainingMs` | Transitional alias of credit remaining (not ms) | ACTIVE transitional |
| `usageBalanceMs` | Seeded 0; ignored for quota | LEGACY |
| `formatRemainingUsage` | If value ≥10000 formats as **time** | LEGACY footgun if misused |

---

# Rate Limit Audit

| Tier | Window | Max | Key |
| --- | --- | --- | --- |
| anonymous | 60s | 10 | `userId:operation:tier` |
| free | 60s | 30 | same |
| trial | 60s | 60 | same |
| pro | 60s | 120 | same |

- Storage: **in-memory Map** (lost on restart; not shared across processes).  
- Separate from credits: YES (429 `AI_RATE_LIMITED` vs 403 `AI_ENTITLEMENT_DENIED`).  
- Bypass: new accounts get new userIds (expected); install tokens are rate-limited as anonymous but **AI denied first**.

---

# Install Auth Audit

| Question | Answer | Evidence |
| --- | --- | --- |
| Install token → managed AI? | **NO** (`allowed:false`, `account_required`) | `auth.ts` `resolveInstallAuth` |
| Charged against Free? | **NO** (`reserveManagedUsage` null without accountId) | `accountService.ts` |
| Client claim changes plan? | **NO** | Claim parsed; does not set tier |
| Dev escape | `authDisabled` → allowed true (dev) | `auth.ts` / env |

**No P0 install-token AI bypass found.**

---

# Entitlement Audit

### Client vs server

| Feature | Client gate | Server gate | Authority | Bypass? |
| --- | --- | --- | --- | --- |
| Correction | EntitlementService + consent | Auth + reserve | **SERVER** | Client-only no |
| Translation / Live | Same + consent | Same | SERVER | No |
| Layout AI | canUseFeature | Same | SERVER | Local heuristic free |
| Practice Check | practice.basic/full + credits | Correction/practice mode credits | SERVER for AI | Free teaser allows Check |
| Export/Import | UI soft OR | SW hard capabilities | **SW local** (no server export API) | Free cannot export via SW |
| Local layout/Speed Box | Ungated | N/A | Local | N/A |

`EntitlementLifecycle` in `capabilities.ts` (expired/cancelled/…) is a **type**, not a runtime plan model. Competing local license “pro” label does not unlock managed AI.

---

# Paddle Audit

| Piece | Status |
| --- | --- |
| Env: API key, webhook secret, client token, price IDs | Configured via env; example documents sandbox |
| Checkout create | LIVE in code when `isCheckoutConfigured` |
| Price preview / yearly | LIVE in code when yearly price ID set |
| Portal | LIVE when `paddleCustomerId` present |
| Production connection | **BLOCKED_EXTERNAL** — DNS down; secrets not verified live |
| Fake IDs in repo | No hardcoded production secrets found |

**Classification:** Code = **PARTIAL/READY**; Production = **UNCONFIGURED / BLOCKED_EXTERNAL** from this environment.

---

# Webhook Audit

| Control | Status |
| --- | --- |
| Signature HMAC + timing-safe + ±5 min | VERIFIED |
| Idempotency by `event_id` | VERIFIED |
| Stale event skip | VERIFIED |
| Cross-account rebind blocked | VERIFIED |
| Unknown customer → no Pro | VERIFIED |
| Empty `event_id` skips idempotency store | PARTIAL weakness (P2) |
| Arbitrary POST without sig | Rejected | VERIFIED |

---

# Checkout Audit

```
Upgrade CTA → /pricing → beginProCheckout(interval)
  → POST /api/billing/checkout (website session)
  → openPaddleCheckout(transactionId)
  → /account?checkout=complete → poll isPro ≤60s
  → Webhook must have set Pro
```

**Dead ends:** `checkoutAvailable=false`; extension login ≠ website login; poll timeout; portal without `paddleCustomerId`.

---

# Account Audit

`resolveCommercialPlanState`: signed_out | free | trial | pro | cancel_at_period_end | past_due | payment_failed | expired.

UI branches exist in `Account.tsx`. Some Trial labels hardcoded English.

---

# Extension Audit

- Plan/credits from **server entitlement cache** (TTL 5 min + reset boundary force sync).  
- Unsigned → AI account_required; local tools OK.  
- Upgrade → `{SITE}/pricing`.  
- No Groq/BYOK UI.

---

# Dashboard Audit

| Panel | Behavior |
| --- | --- |
| Overview | UsageStatusCard + conditional upgrade |
| Progress | Advanced gated by capability OR trial/pro |
| Practice | Teaser copy; **Start not hard-disabled** on Free |
| Data | Export/import gated |
| Settings Account | Plan/credits; billing prepared vs upgrade |

---

# Website Audit

| Claim | Code | Match |
| --- | --- | --- |
| $9 / $90 / $18 save / $7.50 equiv | `pricing.ts` | YES |
| 30-day trial | `ACCOUNT_TRIAL_DURATION_MS` | YES |
| No Unlimited AI | Soft caps exist | YES |
| No Groq/BYOK/Lemon in UI | Absent | YES |
| No 2h / 7-day in active i18n | Absent | YES |
| Free forever local tools | ALWAYS_FREE | YES |
| Practice Free “Limited” | Soft gate only | **PARTIAL** |

---

# Pricing Page Audit

**Hybrid:** i18n static copy + `FLOWLARY_PRICING` fallback + live Paddle catalog when available.  
Math VERIFIED. Checkout disabled when billing not configured.

---

# Learning / Practice Audit

- Progress uses LearningEvents (correction/practice), not translation/layout.  
- Free: basic learning/progress; advanced recurring gated.  
- Free Practice: **can run sessions and spend AI credits** via `practice.basic` + `ai.correction`.  
- Marketing “Limited” ≠ hard session quota.

---

# Export / Import Audit

| Actor | Export | Import |
| --- | --- | --- |
| Free | UI blocked; SW `capability_denied` | Same |
| Trial/Pro | Allowed if cache has capabilities | Same |
| UI OR isPro/inTrial vs SW capabilities-only | Can diverge if cache stale | P2 inconsistency |

Secrets stripped on export; leak check exists.

---

# Security Audit

| Topic | Finding | Sev |
| --- | --- | --- |
| Client entitlement trust | Not billing authority | OK |
| Install token AI | Denied | OK |
| Webhook forgery | Signature required | OK |
| Cross-account webhook rebind | Blocked | OK |
| Multi-account Free AI / trials | By creating new accounts | Abuse surface (expected) |
| Multi-process credit races | JSON store + in-memory reservations **unsafe if horizontally scaled** | P1 **ops** if scaled |
| `authDisabled` | Dev AI without account | Dev-only |
| Release secrets | No JWT/Paddle secrets; `ewa_groq_api_key` migration string only; no `api.groq.com` | OK |

---

# Storage Audit

| Data | Persistence |
| --- | --- |
| Accounts, usage, subscriptions, webhook events | In-memory snapshot + **JSON file** (`FLOWLARY_DATA_PATH`) |
| Rate limits / credit reservations | **In-memory only** |
| Real SQL DB | **None** |
| Multi-instance | Explicitly unsupported (`store.ts` comment) |

Restart: JSON persists accounts/usage; in-flight reservations lost (possible unreimbursed debit until release path N/A — reservation map gone; debit already written — **stuck debit** if crash between reserve and release without finalize). PARTIAL risk on crash mid-request (user already paid; no double free AI).

---

# Multi-device Audit

Same account JWT → shared server credits / trial / subscription.  
Learning/activity local to extension account-scoped storage — **not** server-synced across devices.  
Credits: **account-level server** — VERIFIED.  
Learning: **device/extension local** — VERIFIED.

---

# Abuse Scenarios

| Scenario | Extra Free AI? | Notes |
| --- | --- | --- |
| Multiple accounts | **YES** | Each gets 40/day + new 30-day trial |
| New install tokens | No AI without account | — |
| Clear extension data | No server credit reset | Re-login same account |
| Client clock | No | — |
| Concurrent requests (1 credit left), single Node | **SAFE** (sync reserve) | No dedicated race test |
| Concurrent multi-instance | **UNSAFE** | Documented |
| Spoof Pro header | No | — |

---

# Test Coverage

| Area | Tests? | Meaningful? | Gaps |
| --- | --- | --- | --- |
| Free/Trial/Pro caps | YES (`credits-capabilities`, phase17/28) | YES | — |
| Credits reserve/weights | YES (gateway/account) | YES | Explicit dual-request remaining=1 race |
| Reset boundary | Partial (UX sync) | Partial | Clock edge cases |
| Paddle webhook sig/idempotency | YES (`paddle-webhook`) | YES | Empty event_id |
| Checkout E2E live | NO | — | BLOCKED_EXTERNAL |
| Install auth deny AI | YES (auth/gateway) | YES | — |
| Billing failure UX | Partial | Partial | — |
| Cancellation matrix | Partial | Partial | — |
| Export capability SW | Indirect | Weak | Direct Free deny test |

**Automated this session:** `npm test` **684 pass**; website **73 pass**; `build:release` pass; DNS **fail**.

---

# Contradictions

| # | Statement A | Statement B | Evidence | Action |
| --- | --- | --- | --- | --- |
| 1 | Pricing: Practice Free “Limited” | Free can Start + spend practice AI | i18n vs `evaluateFeatureAccess` / PracticePanel | Clarify product or hard-gate |
| 2 | Docs PHASE24–26: 7-day / 2h / Lemon / “not implemented” | Code: 30d / credits / Paddle / implemented | Historical docs | Treat as historical |
| 3 | UI export enabled via isPro OR | SW requires capabilities array | DataControl vs background | Align gates |
| 4 | Field name `remainingMs` | Value is credits | accountService | Naming debt |
| 5 | Extension signed-in | Website checkout needs separate web session | accountAuth vs web client | UX friction |

---

# P0 Findings

**None verified** for: unauthorized Pro from client, install-token unlimited AI, unsigned webhook Pro grant, user-facing secret exposure in release bundle.

---

# P1 Findings

1. **Horizontal scale / multi-process deployment** would make credit accounting and rate limits **UNSAFE** (explicit store warning + in-memory reservations). Single-process assumption is load-bearing.  
2. **Production billing reliability NOT VERIFIED** (DNS + live Paddle) — blocks claiming users can pay today. (Ops/external; product code path exists.)

---

# P2 Findings

1. Free Practice teaser does not hard-limit sessions (marketing soft contradiction).  
2. Export/import UI vs SW gate mismatch when capabilities cache empty.  
3. Usage UX / some Account strings English-only (AR incomplete).  
4. Extension → Pricing upgrade requires separate website login.  
5. Webhook empty `event_id` weakens idempotency.  
6. `learning.full` capability unused in UI.  
7. `formatRemainingUsage` time formatting footgun for large numbers.  
8. Chrome Web Store URL null.  
9. Account leftover `plan:'pro'` without subscription still grants Pro limits (server-internal).

---

# P3 Findings

1. Stale PHASE24–26 documentation (7d, 2h, Lemon).  
2. Dual naming `remainingMs` / credits.  
3. Legacy BYOK migration strings in release JS (detection/retirement only).  
4. Non-release `npm run build` still lists localhost hosts (must use `build:release`).

---

# Final Matrices

## Plan matrix

| Feature | Free | Trial | Pro | Actual Enforcement | Server Authority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Layout local / Speed Box / Privacy / Pause | ✓ | ✓ | ✓ | Local / ALWAYS_FREE | N/A | VERIFIED |
| Correction | Credits 40 | 200 | 200 | Gateway reserve | YES | VERIFIED |
| Translation | Credits×2 | ✓ | ✓ | Gateway | YES | VERIFIED |
| Live Translation | Credits×2 | ✓ | ✓ | Gateway | YES | VERIFIED |
| Layout AI | Credits×1 | ✓ | ✓ | Gateway | YES | VERIFIED |
| Practice sessions | Soft allowed | Full | Full | Client soft; AI server | PARTIAL UX | VERIFIED |
| Practice Check AI | Credits×1 | ✓ | ✓ | Gateway | YES | VERIFIED |
| Basic learning/progress/activity | ✓ | ✓ | ✓ | Local | N/A | VERIFIED |
| Advanced progress | ✗ | ✓ | ✓ | Dashboard + caps | Caps server; UI mirror | VERIFIED |
| Export/Import | ✗ | ✓ | ✓ | SW capabilities | Local gate | VERIFIED |
| Trial window | — | 30d | — | Server trialEndsAt | YES | VERIFIED |
| Pro | ✗ | — | ✓ | Webhook sub | YES | VERIFIED code |

## Money flow

| Step | File / route | Verified |
| --- | --- | --- |
| Pricing display | `pricing.ts` + PricingShowcase | YES |
| Checkout | `POST /api/billing/checkout` → `billing/index.ts` | YES code |
| Paddle | Overlay + env price IDs | YES code; live BLOCKED_EXTERNAL |
| Webhook | `POST` billing webhook + signature | YES tests |
| Subscription | `webhook.ts` upsert | YES |
| Entitlement | `accountService.resolve*` | YES |
| Pro access | Gateway + client mirror | YES code |

## AI cost flow (all five ops)

USER → feature → client gate → `/api/ai/*` → auth → entitlement → rate limit → **reserve** → provider → **finalize/release** → response → entitlement sync.  
**VERIFIED** for correction, translation (+live mode), layout-classification; practice uses correction with `mode=practice`.

---

# Scores

| Score | /100 | Rationale |
| --- | --- | --- |
| Pricing correctness | **88** | Shared SoT + i18n align; live catalog env-dependent; docs noise |
| Entitlement correctness | **90** | Clear server resolve; install deny; leftover plan=pro edge |
| AI quota correctness | **85** | Weights + reserve/refund solid; multi-instance unsafe; race test gap |
| Billing correctness | **55** | Code wired; production DNS/Paddle **BLOCKED_EXTERNAL** |
| Security | **82** | Strong webhook/install; expected multi-account abuse; scale caveat |
| UI/UX consistency | **78** | Mostly aligned; practice soft-gate; EN-only usage; auth split |
| Testing confidence | **75** | Broad unit/integration; missing concurrent quota + live billing |
| **Overall monetization health** | **74** | Strong code model; not live-proven; scale/ops caveats |

---

# Critical Questions

### 1. Can a normal user today pay for Pro and reliably receive what Pricing promises?

**BLOCKED EXTERNAL** (from this environment) / **PARTIALLY** (code).

Why: Checkout→webhook→Pro path is implemented and unit-tested, but `flowlary.com` / `api.flowlary.com` do not resolve here, and production Paddle credentials/webhook reachability were not verified. If billing env is unset, UI correctly disables checkout.

### 2. Can a Free user obtain more AI than intended via client/install/trial/reset/concurrency/API bypass?

**YES** — via **creating additional accounts** (each gets 40/day + a new 30-day trial).  

**NO** — via install token, forged headers, localStorage Pro, client clock, or client credit minting (single-process).  

**UNKNOWN** — under multi-instance deployment (documented unsafe).

### 3. Is the Pricing page an accurate representation of code-enforced product?

**PARTIALLY** — prices, trial 30d, Free local forever, credit-limited AI, Pro features MATCH. Free Practice “Limited” is **softer than a hard gate**.

### 4. Is Trial duration/behavior what the product advertises?

**YES** — 30 days in shared constant, backend register, website, and extension copy. (Historical docs saying 7 days are wrong.)

### 5. Is Pro entitlement exclusively server-authoritative?

**YES** for user-facing managed AI (webhook/subscription + server resolve; client cannot grant).  
**PARTIALLY** only for server-internal leftover `account.plan === 'pro'` without subscription.

---

# Recommended Fix Order

*(Do not implement in this phase — order only.)*

1. **Ops P1:** Confirm single-process deploy OR replace JSON store before multi-instance.  
2. **External P1:** DNS/TLS for `flowlary.com` + `api.flowlary.com`; production Paddle secrets + webhook smoke.  
3. **P2 product:** Decide Free Practice — hard-gate sessions vs rewrite “Limited” copy.  
4. **P2:** Align export/import UI gate with SW capabilities-only.  
5. **P2:** Webhook reject/ignore empty `event_id` without idempotency.  
6. **P2:** Extension→website upgrade session continuity (or clearer “sign in on web”).  
7. **P2:** i18n UsageStatusCard / Account trial strings.  
8. **P2:** Guard or remove server leftover `plan:'pro'` without subscription.  
9. **P3:** Mark/archive PHASE24–26 contradictions; rename `remainingMs`.  
10. **P3:** Add concurrent remaining=1 credit race test; CWS URL when ready.

---

# Verification this session

| Check | Result |
| --- | --- |
| `npm test` | 684 passed / 96 files |
| `npm run test:web` | 73 passed |
| `npm run build:release` | Pass; hosts `https://api.flowlary.com/*` only; no localhost in release JS |
| Release secret scan | No JWT/Paddle secrets; no `api.groq.com`; BYOK strings = retirement/hash redirect only |
| Live DNS/health | **BLOCKED_EXTERNAL** (NXDOMAIN / resolve fail) |

---

**PHASE 30 AUDIT COMPLETE**
