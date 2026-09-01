# Phase 2A — Real User Journey, Launch QA & Conversion Audit

**Date:** 2026-08-30  
**Auditor role:** Product QA + UX research + conversion + release engineering  
**Scope:** Evidence-driven audit across website, account, dashboard, Writing Lab, extension. No architecture or business-logic changes unless noted in Safe Fixes.

---

## 1. Executive summary

Flowlary is **engineering-strong** and **UX-reconciled** after Phases 1C–1I, but **consumer launch readiness** depends on external operations not verifiable in-repo: **Chrome Web Store publication**, **live production API**, **email delivery**, and **Paddle checkout in production**.

Within the repository, automated tests (1,253 passing), release security scan, prerendered marketing HTML, and integration tests for credits/entitlements/billing **support** a launch narrative. A real user installing today would hit an **honest install funnel** (support page + unpacked/dev instructions), not a one-click CWS install.

**Verdict:** Ready for **controlled/beta launch** with documented external dependencies. **Not ready** for mass consumer Chrome Web Store acquisition until CWS + live billing + live API are verified in production.

---

## 2. Environment

| Item | Value |
|------|--------|
| Repo | `/Users/moomen/Projects/flowlary` |
| Website build | `npm run build:web` → prerendered `website/dist/` |
| Extension release | `release/flowlary-v1.1.0.zip` |
| Browser automation | **Not available** in audit session |
| Live production API | **Not exercised** (no credentials/network to api.flowlary.com) |
| Chrome browser + Gmail/Notion | **Not exercised** |
| Paddle live checkout | **Not exercised** |
| Email SMTP delivery | **Not exercised** |

---

## 3. User journey (verification status)

| Step | Status | Method |
|------|--------|--------|
| Discover / Landing | **MANUAL VERIFIED** (prerender HTML) | `website/dist/index.html` |
| Features | **MANUAL VERIFIED** (SSR tests) | `routes.test.tsx`, prerender |
| Pricing | **MANUAL VERIFIED** (SSR + unit) | `PricingShowcase.test.tsx`, dist HTML |
| Register | **CODE VERIFIED** | `Account.tsx`, phase17 integration tests |
| Email verify | **CODE VERIFIED** | backend email tests; **LIVE NOT VERIFIED** |
| Install | **EXTERNAL OPS REQUIRED** | `CHROME_WEB_STORE_URL = null` |
| First Win | **CODE VERIFIED** | `FirstWinView.tsx`; **LIVE TIMING NOT MEASURED** |
| Write / Correction | **ENGINEERING VERIFIED** | extension unit + integration tests |
| Translation | **ENGINEERING VERIFIED** | phase17 debit weight, phase28 refund |
| Fix Layout | **ENGINEERING VERIFIED** | local-first tests |
| Speed Box | **CODE VERIFIED** | manifest commands; **LIVE NOT VERIFIED** |
| Learning | **CODE VERIFIED** | dashboard empty states Phase 1I |
| Credits exhaustion | **ENGINEERING VERIFIED** | phase28-monetization-e2e |
| Upgrade / Pro | **CODE VERIFIED** | phase20-billing; **LIVE PADDLE NOT VERIFIED** |
| Student | **CODE VERIFIED** | studentVerificationService; honest FAQ copy |

---

## 4. Landing page (first 5–10 seconds)

**Prerender evidence** (`website/dist/index.html`):

| Question | Answer in hero |
|----------|----------------|
| What is Flowlary? | “Writing + learning companion” / “Write anywhere. Stay in the flow.” |
| Who is it for? | Chrome users writing in web fields; English learning angle |
| Why care? | One companion for write + communicate + learn |
| What next? | **Get Flowlary** → `/support#get-flowlary` |

**Primary CTA path:** `Get Flowlary` does **not** open Chrome Web Store. It opens Support → Installation (`CHROME_WEB_STORE_URL: null` in `website/src/config.ts`). Copy is **honest** about this (`support.features[get-flowlary].limit: "There is no public store URL yet."`).

**Positioning:** Write / Communicate / Learn sections present. Does not read as grammar-only or LMS-only.

**Issue (fixed in 2A):** Hero popup preview showed old hierarchy (tools before actions, no Fix Writing primary). **Fixed** — see Safe Fixes.

---

## 5. Features page

SSR tests confirm WRITE → COMMUNICATE → LEARN narrative, interactive demo CTA to `/#try-flowlary`, no “Coming soon”.

**Remaining:** `.pp-glass` on feature cards (visual debt, P2).

---

## 6. Pricing page

**Prerender evidence** (`website/dist/pricing/index.html`):

| Check | Result |
|-------|--------|
| Free 500 checks/day | ✓ |
| Trial 1000 checks/day, 30 days | ✓ |
| Pro 1000 checks/day | ✓ |
| $4.99/month | ✓ |
| $39/year | ✓ |
| Savings math ($20.88, $3.25/mo equiv) | ✓ |
| Stale $9/$90/1500 | **Not found** |
| Student 12 months + honest verification FAQ | ✓ |
| Dark patterns / fake urgency | **Not found** |
| Checkout honesty | “Paid checkout when billing is enabled” when `checkoutAvailable !== true` |

**Trust:** Pricing explains post-Trial Free continuation. No fake counters.

---

## 7. Registration

**CODE VERIFIED** via `Account.tsx`, `phase17-account.test.ts` (19 tests):

- Email + password registration
- Trial entitlement on new account
- Invalid email/password human errors
- Rate limiting

**LIVE NOT VERIFIED:** actual form submit against production API in browser.

---

## 8. Email verification

**CODE VERIFIED:** backend email verification tests exist.

**LIVE NOT VERIFIED:** inbox delivery, link click, resend cooldown in production.

---

## 9. First Win

**CODE VERIFIED:** `FirstWinView.tsx` — Fix Layout primary, Speed Box hint, skip preserves install-scoped logic.

**LIVE NOT VERIFIED:** Time-to-first-success on Gmail/Notion (no browser automation). Target ≤60s **not measured**.

---

## 10. Extension popup

**CODE VERIFIED** (Phase 1H): status → quick actions (Fix Writing primary) → usage → tools.

**LIVE NOT VERIFIED:** popup open latency, real field dispatch.

**Marketing alignment:** Popup preview on homepage **was out of sync** → **fixed in 2A**.

---

## 11. Writing experience

**ENGINEERING VERIFIED:**

- Long-field segmentation tests (`longFieldScheduler.test.ts`)
- Correction merge/dedupe tests
- No 250-char gate in UI copy (pricing FAQ confirms bounded segments)

**LIVE NOT VERIFIED:** correction storm, Apply/Dismiss on real sites.

---

## 12. Credit behavior

**ENGINEERING VERIFIED** (`phase28-monetization-e2e.test.ts`, `phase17-account.test.ts`):

| Behavior | Verified |
|----------|----------|
| Free 500 / Trial & Pro 1000 daily limits | ✓ constants + tests |
| Success → debit (translation weight 2) | ✓ |
| Failed AI → no debit | ✓ phase28 |
| Concurrent overspend prevention | ✓ phase17 |
| Exhaustion → capabilities/local tools | ✓ phase28 path |
| Human exhaustion copy | ✓ Phase 1I shared `usageUx` |

---

## 13. Translation / Fix Layout / Speed Box

**ENGINEERING VERIFIED** via unit/integration tests and manifest commands.

**LIVE NOT VERIFIED** in browser on EN↔AR paragraphs.

---

## 14. AI failures

**CODE VERIFIED:** Human messages in `usageUx`, Writing Lab gates, extension `api.ts`, `applyCorrection.ts`. No Groq/HTTP in user strings (website dist grep clean).

**LIVE NOT VERIFIED:** offline simulation in browser.

---

## 15. Exhaustion UX

**ENGINEERING VERIFIED:** phase28 confirms local tool capabilities remain; UI copy states Fix Layout + Speed Box + Google translation availability.

**LIVE NOT VERIFIED:** signed-in Free user at 0 credits in popup + field.

---

## 16. Learning

**CODE VERIFIED:** Improved empty states (progress, report, brief) Phase 1I. No fabricated metrics in copy.

**LIVE NOT VERIFIED:** authenticated dashboard with real learning events.

---

## 17. Account / Student / Upgrade

**CODE VERIFIED:** plan labels, student honest FAQ, billing panel gating.

**LIVE NOT VERIFIED:** Paddle sandbox/live checkout end-to-end, webhook → extension sync.

---

## 18–19. Mobile / Desktop

**CODE VERIFIED:** responsive CSS clamps, pricing compare scroll, dashboard mobile nav (Phase 1G).

**LIVE NOT VERIFIED:** 360/390/1440 visual pass in browser (no screenshots captured).

---

## 20. Arabic quality audit

**MANUAL VERIFIED** (catalog review + prerender EN default):

- Account/pricing/Writing Lab AR overrides use natural MSA (Phase 1I)
- “فحوصات الكتابة”, “مساحة الكتابة”, “12 شهرا” for student
- Popup preview AR updated in 2A fix

**Gaps (P2):** Some dashboard panel strings still fall back to English when AR override missing.

---

## 21. RTL

**CODE VERIFIED:** `dir` boot script, logical CSS on pricing/extension. **LIVE NOT VERIFIED** in Arabic browser session.

---

## 22. Accessibility

**CODE VERIFIED:** skip links, semantic headings, `aria-busy` on lazy sections, focus tokens in design system.

**LIVE NOT VERIFIED:** keyboard-only walkthrough, screen reader pass.

---

## 23. Performance / feel

**Not profiled** in this session. Prerender improves first paint for marketing routes. Extension popup/dashboard bundle sizes large (pdfmake) — known, P3.

---

## 24. Security

**ENGINEERING VERIFIED:**

```
phase23-security.test.ts → 2/2 passed
```

- No `gsk_`, `GROQ_API_KEY`, `api.groq.com`, `localhost`, `127.0.0.1` in release dist
- `host_permissions`: `https://api.flowlary.com/*` only
- `website/src/__tests__/security.test.ts` — no Paddle secrets in client bundle

---

## 25. Bug inventory

| ID | Sev | Surface | Description | Evidence | User impact | Fix | Safe now? |
|----|-----|---------|-------------|----------|-------------|-----|-----------|
| 2A-P0-EXT-1 | **P0** | Install | No Chrome Web Store listing; Get Flowlary → support install | `CHROME_WEB_STORE_URL=null`, seo.test | Consumer cannot one-click install | Publish CWS + set URL | **NO** (ops) |
| 2A-P0-EXT-2 | **P0** | Production | Live API/email/Paddle not verified this session | Audit env limits | Real signup/AI/billing may fail in prod | Ops verification checklist | **NO** (ops) |
| 2A-P1-001 | **P1** | Home | Popup preview ≠ extension hierarchy | dist HTML before fix | Mistrust at first impression | **FIXED** PopupPreview + i18n | YES ✓ |
| 2A-P1-002 | **P1** | Conversion | Paid upgrade blocked until `checkoutAvailable` | PricingShowcase.tsx | Cannot complete Pro purchase when billing off | Enable Paddle in prod | **NO** (ops) |
| 2A-P1-003 | **P1** | Journey | No live browser journey (Gmail, fields, timing) | No automation | Unknown friction in real use | Manual QA matrix | Partial |
| 2A-P2-001 | **P2** | In-page UI | Correction card / Speed Box overlays pre-1H visual | Phase 1I debt | Visual inconsistency | Future overlay CSS pass | YES (deferred) |
| 2A-P2-002 | **P2** | Features | `.pp-glass` cards remain | product-pages.css | Slight brand drift | Solid surface migration | YES (deferred) |
| 2A-P2-003 | **P2** | Arabic | Dashboard partial EN fallbacks | i18n merge | AR users see mixed language | AR override pass | YES (deferred) |
| 2A-P2-004 | **P2** | SEO meta | Pricing meta says “verified student access” | pricing index meta | Slightly stronger than FAQ | Align meta copy | YES |
| 2A-P3-001 | **P3** | FAQ | “1000 checks” without comma | dist pricing FAQ | Minor readability | Typography | YES |
| 2A-P3-002 | **P3** | Perf | Large extension chunks (pdfmake) | build warning | Slower dashboard open | Code-split | NO (scope) |

---

## 26. Safe fixes (applied in 2A)

| Fix | Files |
|-----|-------|
| Homepage popup preview aligned with extension: Fix Writing primary, quick actions before tools, usage strip, “Tools” label | `PopupPreview.tsx`, `en.ts`, `ar.ts`, `product.css`, `config.ts`, `demos.test.tsx` |

No business logic, pricing, credits, or AI behavior changed.

---

## 27. Tests (post-fix)

| Command | Result |
|---------|--------|
| `npm test` | **1125 passed**, 2 skipped |
| `npm run test:web` | **128 passed** |
| `phase28-monetization-e2e` | **3 passed** |
| `phase17-account` | **19 passed** |
| `phase23-security` | **2 passed** |

---

## 28. Builds (post-fix)

| Command | Result |
|---------|--------|
| `npm run build:web` | ✓ 14 prerendered routes |
| `npm run build:release -w @flowlary/extension` | ✓ |
| `npm run package:release` | ✓ `flowlary-v1.1.0.zip` |

---

## 29. Visual QA

**Not captured** (no browser automation). Recommended manual matrix: Home, Pricing, Account, Dashboard, Writing Lab, Extension popup — EN/AR × light/dark × 390/1440.

---

## 30. Product score (1–10)

| Dimension | Score | Evidence if <8 |
|-----------|-------|----------------|
| Positioning | **8** | Clear Write/Communicate/Learn; CWS gap hurts “get it now” |
| First impression | **8** | Strong hero; install friction (P0-EXT-1) |
| Activation | **7** | Support install path; no measured first-win timing |
| First Win | **8** | Code clear; live timing unmeasured |
| Writing experience | **8** | Engineering verified; live fields unverified |
| Translation | **7** | Not live-tested EN↔AR |
| Learning | **8** | Honest empty states; needs real data to shine |
| Pricing | **9** | Canonical values, trustworthy FAQ |
| Conversion | **7** | Billing may be off; CWS not live |
| Retention | **8** | Local tools + learning bridge |
| Arabic | **7** | Strong pricing/account; dashboard gaps |
| Accessibility | **7** | Code good; no live audit |
| Mobile | **8** | Responsive patterns in CSS/tests |
| Visual quality | **8** | Phases 1H–1I; in-page overlays lag |
| Trust | **9** | Honest install, student, pricing copy |

---

## 31. Launch scores (/100)

| Score | Value | Explanation |
|-------|-------|-------------|
| **Product UX READINESS** | **78** | Reconciled UX/copy; live journey + overlays not fully verified |
| **ENGINEERING READINESS** | **88** | 1253 tests, security scan, integration credit/billing paths |
| **CONVERSION READINESS** | **65** | CWS + live Paddle + measured funnel missing |
| **ARABIC UX READINESS** | **74** | Strong core surfaces; dashboard fallbacks |
| **OVERALL LAUNCH READINESS** | **72** | Beta/controlled launch OK; mass consumer launch blocked on ops |

---

## 32. Remaining blockers

1. **Publish Chrome Web Store listing** and wire `CHROME_WEB_STORE_URL`
2. **Verify production API** at `api.flowlary.com` (health, auth, AI, credits)
3. **Verify email delivery** (register, verify, student, reset)
4. **Enable Paddle checkout** in production + live webhook test
5. **Manual browser QA matrix** (2–3 hours, EN/AR)
6. **Optional:** In-page overlay visual reconciliation (P2)

---

## 33. Recommended next actions

1. Run **manual launch QA checklist** (`.qa-shots/` or fresh captures) on staging/production with real account.
2. **Publish CWS** or clearly label beta as “developer install only” until published.
3. Execute **one live Paddle sandbox purchase** → verify entitlement in extension popup.
4. Measure **First Win time-to-success** on Gmail compose (target ≤60s) — record actual seconds.
5. Schedule **in-page overlay polish** (correction card, Speed Box) as post-launch UX debt if needed.

---

*Phase 2A complete. Phase 2B not started.*
