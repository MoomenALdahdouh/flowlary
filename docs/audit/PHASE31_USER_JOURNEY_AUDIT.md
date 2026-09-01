# PHASE 31 — COMPLETE USER JOURNEY & PRODUCT FUNNEL FORENSIC AUDIT

**Date:** 2026-08-26  
**Mode:** AUDIT ONLY — no implementation performed  
**Source of truth:** Repository code + safe tests  
**Prior phase reports:** Context only (not assumed correct)

---

# Executive Summary

Flowlary’s **codebase implements large portions** of the lifecycle (website education, extension install packaging, onboarding, account/JWT auth, 30-day server trial, AI gateway entitlement, credit exhaustion, Paddle webhook → Pro, extension pull-sync). A **normal visitor cannot complete the journey** without developer intervention.

The funnel breaks in two hard places:

1. **Install:** Primary CTA `Get Flowlary` does not open the Chrome Web Store (`CHROME_WEB_STORE_URL = null`); it routes to `/support#get-flowlary` and tells users to load an unpacked repo build.
2. **Pay / activate Pro from product UI:** Backend checkout/portal/webhook APIs exist and billing tests pass, but the **website Account page never calls** `startWebCheckout` / `openPaddleCheckout` / `startWebPortal`. Billing UI is a static “Billing is being prepared” card. Extension “Upgrade / Manage subscription” only opens `/account`.

**FINAL VERDICT: PARTIALLY COMPLETE**

Safe tests run this audit: `tests/integration/phase20-billing.test.ts`, `tests/unit/backend/paddle-webhook.test.ts`, `tests/unit/backend/billing.test.ts` — **21/21 passed**. Live `flowlary.com` / `api.flowlary.com` / CWS / live Paddle were **not verified** as working production infrastructure.

---

# Complete User Journey

## Master Journey Table

| Stage | User action | Surface | Code path | Expected | Actual | Status | Blocking? |
|---|---|---|---|---|---|---|---|
| 0 Discovery | Find product | Marketing / SEO | `website/` routes, `DocumentHead`, sitemap | Understand product | Messaging clear on homepage | VERIFIED | No |
| 1 Website | Browse home | `/` | `Home.tsx`, marketing sections | Learn what/who/problem | Works; playground local-only | VERIFIED | No |
| 2 Understanding | Read features/pricing | `/features`, `/pricing` | Feature pages, `PricingShowcase` | Free vs Pro clear | Mostly clear; Lemon Squeezy copy vs Paddle code | PARTIALLY VERIFIED | No |
| 3 Installation CTA | Click Get Flowlary | Nav/hero/CTA | `GetFlowlaryButton` → `/support#get-flowlary` | Store install | Honest dead-end until CWS URL set | DEAD END / BLOCKED EXTERNAL | **Yes (consumer)** |
| 4 Download/package | Obtain extension | Release / unpacked | `scripts/package-release.mjs`, `release/flowlary-v1.1.0.zip` | Consumer install | Zip + unpacked for developers only | PARTIALLY VERIFIED | **Yes** |
| 5 First launch | Install → SW | Extension | `startupBackground`, `onInstalled` | Init storage, defaults | Works in code | VERIFIED | No |
| 6 Onboarding | Complete setup | Dashboard options | `OnboardingFlow`, `DashboardApp` | Persist prefs + consent | Dashboard modal; popup has no wizard | VERIFIED | No |
| 7 Account create | Register | Website `/account` or extension Account | `POST /api/auth/register`, `registerAccount` | Account + tokens | Works when API reachable | VERIFIED | Depends on API |
| 8 Login | Sign in | Same | `loginAccount`, refresh/logout | Session across surfaces | Works; access JWT survives logout ≤15m | VERIFIED | No |
| 9 Trial | Auto on register | Backend | `trialEndsAt = now + ACCOUNT_TRIAL_DURATION_MS` (30d) | Full AI trial | Server trial works; unsigned AI locked | PARTIALLY VERIFIED | No |
| 10 Consent | Accept AI | Onboarding/popup/settings | `consentAccepted` in correction storage | Gate AI | Correction/practice gated; translate SW path does not check consent | PARTIALLY VERIFIED | No |
| 11 First value (local) | Fix layout / Speed Box | Content script | `LayoutFeature`, Speed Box | Value without account | Yes — local tools work | VERIFIED | No |
| 12 First AI | Correction/translate | Content → background → API | `correct.ts`, `translate.ts`, gateway | AI result | Requires signed-in account + consent + credits + live API | PARTIALLY VERIFIED | Depends on API key/host |
| 13 Usage healthy | Use AI | Popup/dashboard | Credits display | Credits shown | Extension credit UX OK; website formats credits as minutes | PARTIALLY VERIFIED | No |
| 14 Usage warning | Low credits | UI | `LOW_CREDITS_THRESHOLD=8` | Soft warning | Constant exists; dedicated low-credit UX largely missing | MISSING | No |
| 15 Exhaustion | Hit 0 credits | Server + UI | `usage_exhausted`, `isEntitlementLocked` | Lock AI, keep local, offer upgrade | Lock + reset copy in extension; upgrade path dead | PARTIALLY VERIFIED | Soft |
| 16 Upgrade CTA | Click Upgrade | Popup/dashboard/pricing | Opens `FLOWLARY_SITE_URL/account` | Start checkout | Lands on Account with no checkout button | DEAD END | **Yes** |
| 17 Checkout | Pay | Website + Paddle.js | `startWebCheckout`, `openPaddleCheckout` | Overlay checkout | Helpers **unwired** from UI; Account says billing prepared | BROKEN | **Yes** |
| 18 Payment | Card pay | Paddle | Paddle transaction | Paid sub | Cannot start from product UI; live Paddle not verified | BLOCKED EXTERNAL + BROKEN | **Yes** |
| 19 Webhook | Paddle → backend | `POST /api/billing/webhook` | `processVerifiedPaddleEvent` | Map account → Pro | Implemented + unit/integration tested | VERIFIED (code) | Env secret required |
| 20 Backend sub | Persist grant | Store | `SubscriptionRecord`, `applyPlanFromSubscription` | `plan: pro` | Verified in phase20 tests | VERIFIED (code) | No |
| 21 Entitlement | Resolve Pro | `resolveServerEntitlementForAccount` | `isPro`, Pro credits | Works in code/tests | VERIFIED | No |
| 22 Extension sync | Learn Pro | Extension | `syncServerEntitlement` / 5‑min TTL / GET_STATUS | Pro without reinstall | Pull sync; no push; manual refresh available | VERIFIED | No |
| 23 Pro features | Use higher limits | Extension + API | Credits + capabilities | Pro AI + learning gates | AI limits work; capability gates for export/learning.full largely **unenforced in UI** | PARTIALLY VERIFIED | No |
| 24 Billing mgmt | Portal | Website | `startWebPortal` / Paddle portal | Manage card/cancel | API exists; **UI never calls it** | BROKEN | **Yes** |
| 25 Cancel | Cancel sub | Portal → webhook | `subscription.canceled` + period end | Access until period end | Backend tested; user has no in-product cancel path | PARTIALLY VERIFIED | Soft |
| 26 Payment fail | Dunning | Webhook | `past_due` keeps Pro | Keep Pro + warn | Backend keeps Pro; website can show `paymentIssue` if subscription loaded | PARTIALLY VERIFIED | No |
| 27 Expire → Free | Period ends | Entitlement resolve | Demote to free + 40 credits | Works in tests | VERIFIED (code) | No |
| 28 Reinstall | Uninstall → install → login | Extension | Auth restore + entitlement sync | Pro restores; learning local lost unless export | Account/Pro restore via login; learning not cloud-synced | PARTIALLY VERIFIED | No |
| 29 Multi-device | Same account 2 devices | Server + local | Entitlement server; learning local | Sub/credits sync; learning local-only | By design local learning | PARTIALLY VERIFIED | No |
| 30 Logout | Sign out | Extension/website | `clearAccountSession` / web session clear | Drop Pro; keep local tools | Auth cleared; **learning/settings not cleared** | PARTIALLY VERIFIED | Isolation risk |
| 31 Account switch | User B after A | Extension | Login B | Isolated state | **B inherits A’s local learning/settings** | BROKEN | **Yes (privacy)** |

---

# Website Journey

## What a visitor can understand

| Question | Answer | Evidence |
|---|---|---|
| What is Flowlary? | Chrome in-page writing companion (correct, translate, layout) | `website/src/i18n/en.ts` hero/product copy |
| Who is it for? | People writing in web text fields | Home problem/product sections |
| Problem solved? | Grammar, language switch, wrong layout, tool-switching | `ProblemStory` |
| Free vs Pro? | Free $0 + standard AI limits; Pro “1 month free” + higher limits | `PricingShowcase` + `en.ts` pricing |
| How to install? | CTA → support install section | Not a real store install |

## Surfaces audited

- Homepage hero, playground (`id="try-flowlary"`), features, pricing, about, support, guide, account, privacy/terms, footer/nav
- Blog route exists as empty placeholder
- No dedicated `/faq`; Support acts as FAQ
- Support contact: “will be available here” (no public inbox)

## Primary CTA

```69:88:website/src/components/Ui.tsx
// GetFlowlaryButton → CHROME_WEB_STORE_URL if set, else to="/support#get-flowlary"
```

```28:29:website/src/config.ts
/** Set only when a real Chrome Web Store listing is published. */
export const CHROME_WEB_STORE_URL: string | null = null
```

Install copy is intentionally honest: listing not linked; developers load unpacked from repository (`en.ts` `support.install`).

## Account page (signed in)

- Register / login / logout wired to API
- Plan/usage cards load from `/api/account` + entitlement
- Polls for Pro when `?checkout=complete` for ~60s
- Billing card is **static** “Billing is being prepared” — no Upgrade / Portal buttons
- Usage display uses `formatRemaining(remainingMs)` as **minutes**, while server maps `remainingMs` to **credit counts** → misleading “1m” style display for ~40 credits

## Pricing contradictions

- Billing copy says **Lemon Squeezy**; implementation is **Paddle** (`paddleCheckout.ts`, backend `billing/*`). SEO test asserts Lemon Squeezy string.
- When `checkoutAvailable`, Upgrade navigates to `/account` and claims checkout opens after sign-in — Account never opens checkout.

---

# Installation Journey

| Path | Status |
|---|---|
| Chrome Web Store one-click | **MISSING** (`CHROME_WEB_STORE_URL = null`) |
| Support “Get Flowlary” | Lands on install honesty page; self-link CTA |
| Unpacked `extension/dist` | Developer path documented |
| `release/flowlary-v1.1.0.zip` (+ sha256) | Exists; still not consumer one-click |
| Prod manifest | `manifest.prod.json` v1.1.0; host_permissions only `https://api.flowlary.com/*` |

**Consumer install without developer help: NO (BLOCKED EXTERNAL + intentional null store URL).**

---

# First Run

### Entry

1. Service worker `startupBackground()` — migrate, hydrate, retire BYOK, learning/history/cache init, `maybeSyncServerEntitlement`
2. `onInstalled` reason `install` → `learningInstall.kind = 'fresh'`
3. Defaults include `consentAccepted: false` and local entitlement seed

### Popup

- `HomeView` / system status / feature toggles
- No full onboarding wizard
- Consent via Enable / Flowlary AI accept if missing

### Dashboard (options page)

- Fresh install shows `OnboardingFlow` modal when onboarding incomplete

**Crashes:** Not observed in static audit; Chrome E2E not run this session (`LIVE_API_VERIFICATION.md` also marks Chrome E2E NOT VERIFIED).

---

# Onboarding

| Topic | Finding |
|---|---|
| Exists? | Yes — `extension/src/dashboard/onboarding/OnboardingFlow.tsx` |
| Steps | welcome (consent) → learning (level/focus/native) → tools (translation/layouts/modes) → ready |
| Persist? | Yes via patch APIs / background |
| Skip? | Learning/tools/ready skippable; welcome not skippable as a step (consent can remain unchecked) |
| Reopen? | `restartLearningOnboarding` from Settings/Overview |
| Popup conflict? | Popup never mounts onboarding; settings can diverge until user opens dashboard |
| Settings conflict? | Same storage namespaces; reopen resets step flow intentionally |

**Status: VERIFIED** (dashboard-scoped)

---

# Account Journey

### Create

- Website: `registerWebAccount` → `POST /api/auth/register`
- Extension: `ACCOUNT_REGISTER` → `registerAccount` with `install_id`
- Validation: email normalize/regex; password 8–128
- Duplicate → 409 / `errorDuplicate` UX on website
- Network fail → unavailable error copy

### Tokens

- Access JWT ~15 minutes; refresh opaque ~30 days, rotated
- Stored: extension chrome.storage auth keys; website `sessionStorage` `flowlary.web.session`

### Side effects of register

- Server plan `trial`, `trialEndsAt = now + 30 days`
- Extension syncs entitlement after register/login

### Login edge cases

| Case | Behavior |
|---|---|
| Wrong password | Auth error |
| Expired access | Refresh path / re-login |
| Logout | Refresh invalidated; access may work until exp |
| Browser restart | Website sessionStorage cleared → re-login; extension tokens persist |
| Extension restart | Auth persisted; entitlement re-synced on TTL/status |

**Status: VERIFIED (code)** — requires reachable API (`api.flowlary.com` production not verified this session).

---

# Trial Journey

| Question | Answer |
|---|---|
| When trial begins | On **email/password registration** |
| What starts it | `registerAccount()` sets `plan: 'trial'` |
| Where stored | Server account `trialEndsAt` |
| Duration | **30 days** (`ACCOUNT_TRIAL_DURATION_MS`) |
| Unlocks | Full product capabilities + Pro daily credits (200) + monthly soft cap |
| Automatic? | Yes on register — no payment |
| Payment required? | No |
| Restart? | No public restart; new email = new trial (abuse open) |
| Reinstall / new browser | Trial follows **account**, not install |
| Local clock | Server `Date.now()` — client clock cannot extend |
| Unsigned local trial | Extension seeds local entitlement window, but **AI requires signed-in account** (`account_required` for install auth) |

**Doc drift:** Some Phase 26 docs historically mentioned 7 days; code constant is 30 days. Extension local `TRIAL_DURATION_MS` aliases the same 30-day constant.

**Status: PARTIALLY VERIFIED** — server path solid; product messaging “1 month free” on Pro marketing can be confused with registration trial vs Paddle price trial.

---

# First Value

**Earliest useful moment without account:** install → open a text field → Fix Layout / Speed Box (local remapping). No account, no consent required for local layout.

**First AI value:** requires account + consent + API + credits. Not available to anonymous install tokens (`resolveInstallAuth` → `allowed: false`, `account_required`).

| Path | Needs account? | Needs consent? | Needs network? |
|---|---|---|---|
| Keyboard layout repair (local) | No | No | No |
| Speed Box | No | No | No |
| Local spelling hint | No | No | No |
| Correction / translation / live / layout AI / practice check | Yes | Yes (UI; SW translate gap) | Yes |

---

# AI Journey

### Correction path (representative)

User types → content script / correction feature → readiness (`consent`, enabled, entitlement) → background `CORRECT_TEXT` → `callManagedCorrectionOnce` → `POST /api/ai/correction` with JWT → gateway entitlement/quota/rate limit → provider → response → UI apply.

Similar for translation (`handleTranslateText`), layout AI classify, practice (uses correction).

### Auth/entitlement gates

- Install-only auth cannot use managed AI
- Account JWT → `resolveServerEntitlementForAccount`
- Exhausted → `usage_exhausted` / 403 entitlement denial
- Rate limits by tier (free 30 / trial 60 / pro 120 per op / 60s)

### Consent gap

Translation service worker does **not** re-check `consentAccepted` (UI may still show requires_consent). Correction and practice do.

---

# Free Exhaustion

### Server

- Free: **40** weighted credits/day
- Trial/Pro: **200**/day + **1500** soft monthly
- On 0: `allowed: false`, `reason: 'usage_exhausted'`, capabilities fall to local-only for free

### Extension UX

- `isEntitlementLocked` → AI features locked
- Footer can show “Free AI used · resets in …”
- Local tools remain
- Upgrade CTA present when `billingAvailable` — else “Billing is being prepared”
- No strong guarantee against repeated failed AI calls beyond lock UI + server deny

### Website UX

- Usage bar/percent based on deprecated minute math — misleading under credit model

**Dead end risk:** User understands exhaustion, clicks Upgrade, arrives at Account with no way to pay.

---

# Upgrade Journey

| Surface | CTA destination | Starts checkout? |
|---|---|---|
| Extension popup / dashboard | `FLOWLARY_SITE_URL/account` | **No** |
| Pricing (checkout ready) | `/account` | **No** |
| Pricing (not ready) | Disabled “Upgrade when billing is ready” | No |
| Account signed-in | Static billing prepared card | **No** |
| i18n `upgradeToPro` / `manageSubscription` | Present in copy | **Unused** as live checkout/portal actions |

Identity is preserved only if the user is already signed in on the website session; extension does not SSO into the website.

---

# Checkout Journey

| Piece | Status |
|---|---|
| `POST /api/billing/checkout` | Implemented — server price id, stamps `custom_data.flowlary_account_id` |
| `startWebCheckout()` | Implemented in `website/src/account/client.ts` |
| `openPaddleCheckout()` | Implemented in `paddleCheckout.ts` |
| UI call sites | **Zero** |
| Success URL wiring | Account listens for `?checkout=complete`; nothing sets it from checkout |
| Cancel / fail UX | Not implemented in product UI |
| Env | Website `.env.example` has API URL only; Paddle tokens expected from API when configured |

**Status: BROKEN (UI) / VERIFIED (API helpers)**

---

# Paddle Journey

- Provider: Paddle Billing (sandbox|production via `PADDLE_ENVIRONMENT`)
- Checkout creates transaction with server `PADDLE_PRICE_ID_PRO`
- Client-supplied price ignored (tested)
- Frontend success alone **cannot** grant Pro (by design; Terms/billing header comment)
- Activation requires verified webhook

Live Paddle credentials / catalog / production vs sandbox: **NOT VERIFIED** in this audit (env-dependent).

---

# Webhook Journey

| Concern | Finding |
|---|---|
| Endpoint | `POST /api/billing/webhook` |
| Signature | HMAC SHA256, 5‑minute skew, timing-safe (`paddleSignature.ts`) |
| Idempotency | `event_id` processed store (cap 5000); empty id skips store |
| Account map | `custom_data.flowlary_account_id` then Paddle customer id |
| Unknown account | Ignored — no Pro |
| Price id on webhook | Stored but **not** compared to `PADDLE_PRICE_ID_PRO` |
| Forge webhook | Mitigated if secret set; unconfigured → 503 |
| Duplicate events | Duplicate acknowledged without re-apply |
| Cancel revoke | Cancel keeps Pro until `currentPeriodEnd`; then free (tested) |
| past_due / payment_failed | Pro retained during dunning |

**Tests:** phase20 integration + paddle-webhook unit — **passed** this session.

---

# Pro Activation

```
Paddle event → verify signature → processVerifiedPaddleEvent
  → upsert SubscriptionRecord → applyPlanFromSubscription
  → account.plan = 'pro'
  → GET /api/account/entitlement returns isPro
  → extension syncServerEntitlement / maybeSync (5 min TTL) / manual refresh
```

| Question | Answer |
|---|---|
| Immediate push to extension? | No |
| Must reinstall? | **No** — pull sync |
| Frontend success enough? | **No** |
| Stuck activating? | Account polls 60s then stops; user can refresh later |
| Typical delay | Webhook latency + next sync (status open / ≤5 min / manual) |

---

# Pro Feature Journey

| Feature | UI available? | Server allows? | Notes |
|---|---|---|---|
| Writing Correction | Yes | Yes if credits | Higher daily/monthly caps on Pro |
| Translation | Yes | Yes if credits | Consent SW gap |
| Live Translation | Yes | Yes if credits | |
| Layout AI | Yes | Yes if credits | Local layout always free |
| Practice | Yes | Uses correction AI | Full vs basic capability **not strongly UI-gated** |
| Learning / recurring / advanced progress | UI present | Capability flags exist | `learning.full` / `progress.advanced` **not consistently enforced in UI** |
| Export / Import | Available in Data Control | Marked Pro/Trial in capabilities matrix | **Not gated in DataControlSection** |
| Local tools | Yes | N/A | Always |

---

# Billing Management

User can **see** plan/status/renewal/cancel-scheduled/payment-issue fields when subscription data exists.

User **cannot** from product UI:

- Open Paddle checkout
- Open customer portal
- Update payment method
- Download invoices (portal would, if wired)
- Cancel subscription in-app

Portal API: `POST /api/billing/portal` — requires `paddleCustomerId` from prior webhook; returns 409 otherwise.

---

# Cancellation

**Backend (verified in tests):** cancel → status canceled + `cancelAtPeriodEnd` → Pro until period end → free.

**User path:** would require Paddle customer portal (or Paddle email/dashboard). In-product Manage subscription opens Account, which does not launch portal.

UI explains cancel-at-period-end **if** subscription payload present (`cancelScheduled` copy).

Data (learning/local) remains. Free AI returns at 40/day after demotion. Local tools remain.

---

# Payment Failure

- Webhook marks `paymentFailed` / `past_due`
- Pro **kept** during dunning
- Website can show payment issue meta
- Recovery depends on portal/Paddle — **unwired**

---

# Expiration

Entitlement resolve demotes Pro → Free when subscription no longer grants. Extension learns on next sync. AI limits become free credits. Local learning/activity retained. No intentional data wipe on expire.

---

# Reinstall

| Concern | Result |
|---|---|
| Pro restore | Yes after login + entitlement sync (server truth) |
| Account restore | Yes via credentials |
| Learning | **Local only** — lost on uninstall unless previously exported |
| Activity | Local — lost on uninstall |
| Trial restart | No — trial bound to account timestamps |

---

# Multi-device

| State | Syncs? |
|---|---|
| Subscription / plan / credits / trial | **Yes** (server) |
| Learning profile / events / practice / activity | **No** (local chrome.storage) |
| Settings / consent | **No** (local) |

Intentional local-only learning is a product design fact; not cloud sync.

---

# Logout

| Cleared | Remains |
|---|---|
| Auth tokens, server entitlement cache | Learning, history, correction/translation/layout settings, consent, local entitlement seed |
| Website sessionStorage session | — |

AI cannot run without account after logout (locked). Local features still run. Another Chrome profile user on same browser profile can inherit prior local state after login as different account.

---

# Account Switching

**CRITICAL isolation defect:** logout clears auth only. User B inherits User A’s learning history, practice, settings, and consent. Server entitlement re-syncs for B, so Pro/credits are B’s — but **local privacy/isolation fails**.

---

# Error Recovery

| Failure | Recoverable? |
|---|---|
| Network offline | Local tools yes; AI no; retry when online |
| API 500 / timeout | Errors surfaced; retry |
| Invalid/expired token | Refresh or re-login |
| Paddle unavailable | Checkout API would fail — UI never starts it |
| Webhook delayed | Activating poll 60s then silent; later refresh can succeed |
| Checkout cancelled | N/A (no checkout UI) |
| Payment failed | Pro may remain; recovery via portal unwired |
| Server restart | File store persists (single-node); sessions depend on store |
| Extension / browser restart | Auth persists in extension; website needs re-login |

---

# Dead Ends

| Dead end | Severity | Stage |
|---|---|---|
| Get Flowlary → support install, no CWS | **P0** | Installation |
| Upgrade → Account → “Billing is being prepared”, no checkout | **P0** | Upgrade / Checkout |
| Manage subscription → Account, no portal | **P0** | Billing management |
| Pricing “checkout ready” still only links `/account` | **P0** | Upgrade |
| `startWebCheckout` / `openPaddleCheckout` / `startWebPortal` orphaned | **P0** | Checkout |
| Blog empty / support email missing | P3 | Discovery/support |
| Lemon Squeezy vs Paddle contradiction | P2 | Consistency |
| Website usage shown as minutes for credit counts | P2 | Account UX |
| Account switch leaks local learning | **P0** (privacy) | Account switching |
| Capability gates for export/learning.full not enforced | P2 | Pro features |
| Translate SW consent bypass | P1 | Consent |
| Low-credit soft warning UX missing | P2 | Usage |
| `?checkout=complete` never produced by checkout | P1 | Payment return |
| Production API/site DNS/TLS not verified | **P0 external** | All AI/account |

---

# Cross-surface Consistency

| Topic | Website | Extension | Backend |
|---|---|---|---|
| Processor | Lemon Squeezy copy | Billing prepared / upgrade | **Paddle** |
| Trial | “1 month free” Pro marketing | Server trial after register; local seed unused for AI | 30-day registration trial |
| Credits | Mis-rendered as time on Account | Credit labels | 40 / 200 / 1500 |
| Upgrade | Link to account | Open account tab | Checkout API ready if env set |
| Pro truth | Poll entitlement | Pull sync | Webhook only |
| Feature availability claims | Full Free feature set + AI limits | Local free; AI needs account | Install auth denied |

---

# Master Journey Map

```
Visitor
  ↓ ✓ WORKS
Homepage / Product understanding
  ↓ ✓ WORKS
Pricing / Features
  ↓ ✗ DEAD END / 🔒 CWS NULL
Install CTA (/support#get-flowlary)
  ↓ ⚠ PARTIAL (developer unpacked / zip)
Extension installed
  ↓ ✓ WORKS
First run + Dashboard onboarding
  ↓ ✓ WORKS (local) / ⚠ AI needs account
First value (layout/Speed Box)
  ↓ ✓ WORKS (if API up)
Account create → Trial (30d)
  ↓ ✓ WORKS (if API + Groq)
AI daily use
  ↓ ⚠ PARTIAL
Usage limit / exhaustion UX
  ↓ ✗ DEAD END
Upgrade CTA → /account
  ↓ ✗ BROKEN (unwired)
Checkout / Payment
  ↓ ✓ CODE (tests) / 🔒 LIVE ENV
Webhook → Backend Pro
  ↓ ✓ WORKS (pull sync)
Extension Pro
  ↓ ⚠ PARTIAL (capability UI gaps)
Pro usage
  ↓ ✗ BROKEN UI
Billing management / Cancel
  ↓ ✓ CODE (webhook)
Expire → Free
```

Legend: ✓ WORKS · ⚠ PARTIAL · ✗ BROKEN · ? NOT VERIFIED · 🔒 EXTERNAL

---

# Funnel Scores

| Area | Score | Rationale |
|---|---:|---|
| Discovery | 85 | Clear marketing + demos |
| Installation | 25 | Packaging yes; consumer store path no |
| First Run | 80 | Solid SW + popup/dashboard |
| Onboarding | 85 | Complete dashboard flow |
| Account | 80 | Auth complete; depends on API host |
| Trial | 75 | 30d server trial works; messaging/abuse caveats |
| First Value | 70 | Strong local path; AI gated on account |
| AI Usage | 75 | End-to-end code solid; live API external |
| Upgrade | 30 | CTA exists; destination cannot monetize |
| Checkout | 20 | API helpers only; UI absent |
| Payment | 15 | Unreachable from product |
| Pro Activation | 70 | Webhook path tested; live unverified |
| Pro Usage | 65 | Limits work; some Pro gates unenforced |
| Billing Management | 25 | Portal API only |
| Cancellation | 55 | Backend OK; no user portal path |
| Retention / Return to Free | 70 | Demotion path tested |

**OVERALL USER JOURNEY SCORE: 54 / 100**

Calculation: arithmetic mean of the 16 stage scores above, rounded. Heavily penalized by install distribution and unwired monetization UI despite stronger auth/trial/AI/webhook cores.

---

# P0 Blockers

1. **No consumer install path**  
   - Impact: Visitors cannot install.  
   - Stage: Installation  
   - Evidence: `CHROME_WEB_STORE_URL = null`; support install body.  
   - Files: `website/src/config.ts`, `website/src/components/Ui.tsx`, `website/src/i18n/en.ts`  
   - Fix (recommendation only): Publish CWS listing and set URL.

2. **Checkout never starts from UI**  
   - Impact: Cannot pay; cannot reach Pro as a normal user.  
   - Stage: Upgrade / Checkout  
   - Evidence: Account billing card static; no imports/calls of checkout helpers.  
   - Files: `website/src/pages/Account.tsx`; unused `client.ts` `startWebCheckout`, `paddleCheckout.ts`  
   - Fix: Wire authenticated Upgrade → `startWebCheckout` → `openPaddleCheckout`; set success return URL including `checkout=complete`.

3. **Billing portal never opens**  
   - Impact: Cannot manage/cancel/update payment in product.  
   - Stage: Billing / Cancellation  
   - Evidence: `startWebPortal` never called; Manage subscription → `/account`.  
   - Files: `website/src/account/client.ts`, `extension/src/dashboard/App.tsx` `openBillingSite`  
   - Fix: Wire Manage → portal session URL.

4. **Account switch local data leak**  
   - Impact: User B inherits User A learning/settings.  
   - Stage: Logout / Account switching  
   - Evidence: `logoutAccount` / `clearAccountSession` clears auth only.  
   - Files: extension account auth / storage reset paths  
   - Fix: Scope or clear local learning/settings on logout/switch.

5. **Production API/site not verified live**  
   - Impact: Account/AI fail for production builds pointing at `api.flowlary.com`.  
   - Stage: Account / AI  
   - Evidence: Prior `LIVE_API_VERIFICATION.md` BLOCKED_EXTERNAL; this session could not verify live hosts.  
   - Fix: DNS/TLS/deploy + live verify script.

---

# P1 Blockers

1. **Translate background path skips consent check** — privacy/policy inconsistency.  
2. **`?checkout=complete` listener without producer** — activation UX incomplete even after wiring.  
3. **Webhook does not validate price id** — wrong product could grant Pro if mapped.  
4. **Website usage displayed as minutes** while `remainingMs` mirrors credits.  
5. **Trial multi-email abuse** unlimited.  
6. **No SSO** between extension and website for upgrade (friction / wrong account risk).

---

# P2 Issues

1. Lemon Squeezy copy vs Paddle implementation.  
2. Pro capability gates (`learning.export/import`, advanced progress) not enforced in UI.  
3. Low-credit soft warning (`LOW_CREDITS_THRESHOLD`) unused in UX.  
4. Empty blog / missing support inbox.  
5. Single-process JSON store — not HA production.  
6. Access JWT valid briefly after logout.  
7. Phase docs vs code trial duration historical drift.

---

# External Blockers

| Blocker | Impact |
|---|---|
| Chrome Web Store listing absent | No consumer install |
| Live Paddle env (keys, price, webhook endpoint URL, client token) | Payment cannot complete in prod/sandbox until configured **and** UI wired |
| `api.flowlary.com` / `flowlary.com` production reachability | Not verified this session |
| Groq production key on server | AI live path |
| Public support contact | Ops, not core funnel |

---

# Critical Funnel Questions

1. Can a completely new visitor discover what Flowlary does? **YES**  
2. Can they reach installation successfully? **BLOCKED EXTERNAL**  
3. Can they install and launch the extension? **PARTIAL** (developer/unpacked/zip only)  
4. Can they get value before account creation? **YES** (local layout / Speed Box)  
5. Can they create an account? **PARTIAL** (code yes; needs live API)  
6. Does Trial start correctly? **YES** (on register, 30 days)  
7. Can they use AI? **PARTIAL** (needs account + API + consent)  
8. Can Free usage exhaust correctly? **YES** (server + extension lock)  
9. Can they upgrade? **NO** (CTA dead-ends)  
10. Can they actually pay? **NO** / **BLOCKED EXTERNAL** (UI unwired + live Paddle unverified)  
11. Does payment activate Pro? **PARTIAL** (webhook code yes; unreachable from UI)  
12. Does Pro reach the extension? **YES** (pull sync, once server is Pro)  
13. Can Pro features actually be used? **PARTIAL**  
14. Can user manage billing? **NO**  
15. Can user cancel? **PARTIAL** (backend yes; in-product no)  
16. Does expiration return them to Free correctly? **YES** (code/tests)  
17. Can the entire journey be completed without developer intervention? **NO**

---

# Final Verdict

**PARTIALLY COMPLETE**

Not COMPLETE: a normal user cannot go visitor → install → pay → Pro without developer help.  
Not solely EXTERNAL: checkout/portal UI is unwired even if infrastructure existed.  
Not fully BROKEN: discovery, local first value, account/trial/AI/webhook entitlement cores are substantially implemented and billing tests pass.

---

## PHASE 31 COMPLETE

**FINAL VERDICT:** PARTIALLY COMPLETE  

**OVERALL JOURNEY SCORE:** 54/100  

**WORKING STAGES:** Discovery, Website understanding, First run, Onboarding, Account auth (code), Trial registration (code), Local first value, AI path (code), Exhaustion lock (code), Webhook→Pro (code/tests), Extension Pro pull-sync, Expire→Free (code/tests)

**PARTIAL STAGES:** Installation packaging, Consent, AI live dependency, Usage warnings, Pro feature gating, Cancellation UX, Reinstall/multi-device learning, Logout

**BROKEN STAGES:** Upgrade→Checkout UI, Billing management UI, Account-switch isolation

**MISSING STAGES:** Consumer CWS install URL, Low-credit warning UX, Wired success/cancel checkout returns, In-product portal

**EXTERNAL BLOCKERS:** Chrome Web Store listing, live Paddle configuration, production DNS/API verification, Groq production ops

**P0:** No CWS install; checkout/portal unwired; account-switch data leak; production API/site unverified  

**P1:** Consent bypass on translate SW; checkout return URL unused; webhook price not validated; website credit-as-minutes display; trial email abuse; no extension↔web SSO  

**TOP 10 JOURNEY PROBLEMS:**
1. Get Flowlary does not install from Chrome Web Store  
2. Account billing UI does not start Paddle checkout  
3. Extension Upgrade only opens Account (same dead end)  
4. Manage subscription / portal never wired  
5. Production API/site not verified  
6. Account switch inherits prior user’s local learning  
7. Pricing promises checkout while UI cannot open it  
8. Lemon Squeezy vs Paddle messaging contradiction  
9. Website usage meter wrong under credit model  
10. Pro capability gates (export/advanced learning) not enforced in UI  

**MOST IMPORTANT — Where the real user journey currently breaks:**

A visitor can understand Flowlary, but the primary install CTA intentionally stops at `/support#get-flowlary` with no Chrome Web Store URL; if a developer loads the extension and the user creates an account and uses AI, the monetization funnel still dies on the website Account page, where billing remains a static “being prepared” state even though Paddle checkout/portal helpers and a tested webhook→Pro pipeline already exist—so a normal user cannot pay, cannot open billing management, and cannot complete Pro activation without developer intervention.

**NO IMPLEMENTATION WAS PERFORMED.**
