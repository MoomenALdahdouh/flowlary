# Flowlary — Phase 0 Baseline, Protection & UI Audit

**Document status:** AUDIT / DOCUMENTATION ONLY  
**Date:** 2026-08-30  
**Scope:** Full-repository baseline for a future controlled UI/UX redesign  
**Code changes in this phase:** NONE (this markdown file only)

**Label legend used throughout:**

| Label | Meaning |
|-------|---------|
| **VERIFIED FACT** | Confirmed by inspecting repository files and/or running commands |
| **INFERENCE** | Reasonable conclusion from structure; not independently proven at runtime |
| **RECOMMENDATION** | Guidance for later phases — not implemented |
| **UNKNOWN / NOT VERIFIED** | Could not be confirmed from repo inspection or runs in this session |

---

## 1. Executive Summary

Flowlary is a **npm workspaces monorepo** with four primary packages:

| Package | Path | Role |
|---------|------|------|
| `@flowlary/website` | `website/` | Public marketing site + account/auth + Writing Lab + web learning dashboard |
| `@flowlary/extension` | `extension/` | Chrome MV3 extension (popup, content scripts, background, dashboard) |
| `@flowlary/backend` | `backend/` | HTTP API: auth, AI gateway, billing, student, learning, usage |
| `@flowlary/shared` | `packages/shared/` | Tokens, brand, pricing/credits, learning types, theme helpers |

**VERIFIED FACT:** There is **no Tailwind**. Styling is CSS variables + large CSS files. Shared design tokens live in `packages/shared/src/tokens.css` (“Snow / frost glass”).

**VERIFIED FACT — product surfaces:**

1. Public website (marketing + legal + support + guide + blog placeholder)
2. Authenticated web app (mounted under `/account` when signed in — not separate route namespace)
3. Chrome extension (popup, First Win, content UI, Speed Box, extension dashboard)
4. Backend/API

**Core product idea (current implementation aligns with):** writing companion for correction, translation, keyboard layout, and learning-from-writing — without requiring a separate editor for everyday fields.

**Protected core (must not break in redesign):** auth/sessions, AI gateway & credits, entitlements (Free/Trial/Pro/Student), Paddle billing, extension↔web session bridge, DOM/content-script safety, learning event/sync contracts.

**Safe redesign target (presentation):** website CSS/components/copy presentation, extension popup/dashboard chrome CSS, shared visual tokens (careful), i18n strings that do not change commercial semantics.

**Test baseline (this session):**

| Suite | Result |
|-------|--------|
| `@flowlary/shared` | **PASS** — 17 files, 126 tests |
| `@flowlary/website` (`npm run test:web`) | **PASS** — 18 files, 122 tests |
| `@flowlary/website` typecheck | **PASS** |
| `@flowlary/backend` | **PASS** — 19 files, 127 tests |
| `@flowlary/extension` | **FAIL** — 1 failed / 1124 passed / 2 skipped (`wl1-learning-path-reconnection.test.ts`) |
| `npm run build:web` / `build:release` | **NOT RUN** in this session |

**RECOMMENDATION:** Treat the existing WL-1 failure as a **pre-existing baseline defect**, not something introduced by Phase 0. Investigate before UI work that touches learning persistence.

---

## 2. Repository Architecture

### 2.1 Top-level layout — VERIFIED FACT

```
flowlary/
├── package.json          # workspaces: extension, packages/*, backend, website
├── backend/              # Node HTTP API (tsx in dev)
├── website/              # Vite + React 19 + React Router 7 + SSR prerender
├── extension/            # Vite + @crxjs/vite-plugin + React
├── packages/shared/      # Shared TS + tokens.css + theme
├── scripts/              # dev-website, package-release, wl13b staging, etc.
├── tests/                # unit + integration (consumed by workspace vitest)
├── docs/                 # architecture, audit, monetization, production
├── deploy/               # Docker, nginx, ecosystem
└── release/              # release packaging artifacts
```

### 2.2 Root scripts — VERIFIED FACT (`package.json`)

| Script | Command |
|--------|---------|
| `dev` | Extension Vite dev |
| `dev:api` | Backend `tsx` |
| `dev:web` | `scripts/dev-website.mjs` |
| `build` / `build:ext` | Extension build |
| `build:release` | Extension release build |
| `build:web` | Website build + SSR + prerender |
| `test` | shared + backend + extension |
| `test:web` | website vitest |
| `typecheck` | shared + extension + website |

### 2.3 Frontend architecture — VERIFIED FACT

- **Website:** SPA routes in `website/src/App.tsx`; shell `Layout.tsx`; i18n provider; theme via `data-theme` + localStorage; API via `VITE_FLOWLARY_API_URL` / proxy `/__flowlary-api`.
- **Extension:** Service worker `extension/src/background/index.ts`; content script `content_script.ts`; website bridge `content/websiteBridge.ts`; popup React app; options/dashboard tab.
- **Shared:** Import alias `@flowlary/shared`; CSS import `@flowlary/shared/tokens.css`.

### 2.4 Backend architecture — VERIFIED FACT

- Entry: `backend/src/index.ts` → HTTP handler `backend/src/routes/http.ts`
- Auth middleware, rate limit, CORS, entitlement middleware
- Providers: Groq correction/translation/layout/coach/report; Google Translate router
- Billing: `backend/src/billing/*` (Paddle API, signature, webhook, subscription map)
- Services: account, email verification, password reset, student verification, learning events/sync, usage/credits
- Store: `backend/src/db/*` (in-repo store slices — treat as protected)

### 2.5 What does **not** exist — VERIFIED FACT

- No Tailwind config
- No separate `/dashboard` website route (dashboard is inside `/account` when authenticated)
- No dedicated `/student` page route (student lives on pricing + account panels)
- No second frontend framework

---

## 3. Product Surface Map

### A. Public Website — VERIFIED FACT

| Surface | Path | Primary implementation |
|---------|------|------------------------|
| Home | `/` | `pages/Home.tsx` + marketing/* + playground + Writing Lab in hero |
| Features hub | `/features` | `FeaturesShowcase.tsx` |
| Writing correction | `/features/writing-correction` | feature page |
| Translation | `/features/translation` | feature page |
| Live translation | `/features/live-translation` | feature page |
| Keyboard layout | `/features/keyboard-layout` | feature page |
| Speed Box | `/features/speed-box` | feature page |
| Pricing (+ Student section `#students`) | `/pricing` | `PricingShowcase.tsx`, `StudentProgramSection.tsx` |
| About | `/about` | `AboutShowcase.tsx` |
| Support | `/support` | `SupportCenter.tsx` |
| Guide / How it works (page) | `/guide` | `GuideShowcase.tsx` |
| Blog (placeholder) | `/blog` | empty state only |
| Privacy | `/privacy` | legal page |
| Terms | `/terms` | legal page |
| Account (signed-out = login/register) | `/account` | `Account.tsx` auth forms |
| Verify email | `/account/verify-email` | `VerifyEmail.tsx` |
| Forgot password | `/account/forgot-password` | `ForgotPassword.tsx` |
| Reset password | `/account/reset-password` | `ResetPassword.tsx` |
| 404 | `*` | `NotFound.tsx` |

**Nav (header):** Writing Lab (`/#writing-lab`), Features, How it works (`/#how`), Pricing, About, Support + Account + Get Flowlary.  
**INFERENCE:** “How it works” in nav is a homepage hash, while `/guide` is a fuller guide page.

**Homepage section IDs — VERIFIED FACT:**

- `#writing-lab` — Writing Lab root
- `#how` — Product overview / how steps
- `#try-flowlary` — Playground simulated demos

### B. Authenticated Web Application — VERIFIED FACT

There is **no separate authenticated route tree**. When `Account.tsx` has a session, it renders `DashboardApp`.

| Section (hash) | Panel | Purpose |
|----------------|-------|---------|
| `#overview` (default) | `OverviewPanel` | Daily brief, coach, Writing Lab CTA, extension status |
| `#practice` | `PracticePanel` | Practice recommendations / sessions |
| `#progress` | `ProgressPanel` | Progress charts / learning progress |
| `#report` | `ReportPanel` | Learning report |
| `#settings` | `SettingsPanel` | Learning/settings |
| `#account` | `AccountDashboardPanel` | Account + billing UI |

Also on account when signed in:

- Email verification panel
- Student verification panel
- Billing checkout/portal actions (via `account/billing.ts` + Paddle.js)

**Writing Lab:** Publicly reachable on Home (`id="writing-lab"`); gated for AI analysis by auth/consent/API (`writingLabState.ts`, `aiClient.ts`). Learning sync when signed in.

### C. Chrome Extension — VERIFIED FACT

| Surface | Location |
|---------|----------|
| Popup | `extension/src/popup/` — `App.tsx`, `HomeView`, `FirstWinView` |
| Extension dashboard (options tab) | `extension/src/dashboard/` — Overview, Practice, Progress, History, Layout practice, Learning report, Settings |
| Background / service worker | `extension/src/background/` — correct, translate, classify, learning coach, report narrate, commands |
| Content script | `extension/src/content_script.ts` + `core/dom/*`, `core/input/*`, `core/router/*`, `core/safety/*` |
| Website ↔ extension bridge | `extension/src/content/websiteBridge.ts` ↔ `website/src/account/extensionBridge.ts` |
| Feature UIs | correction cards, translation, layout/Speed Box CSS, learning surfaces |
| Entitlement client | `extension/src/entitlement/`, `config/accountAuth.ts` |
| Storage | `extension/src/storage/*` (chrome.storage + learning/history/cache) |

### D. Backend / API — VERIFIED FACT (from `backend/src/routes/http.ts`)

| Area | Paths |
|------|-------|
| Health | `GET /health`, `GET /ready` |
| Auth | `/api/auth/register`, `login`, `logout`, `refresh`, `device-session`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification` |
| Account | `GET /api/account`, `GET /api/account/entitlement` |
| Student | `/api/student/status`, `verify/request`, `verify/confirm`, `enrollment/review` |
| Learning | `/api/learning/events`, `/api/learning/profile`, `/api/learning/practice-sessions` |
| Billing | `/api/billing/config`, `status`, `checkout`, `portal`, `webhook` (+ paddle alias) |
| AI | `/api/ai/correction`, `translation`, `explanation-localize`, `learning-report-narrate`, `learning-coach`, `layout-classification` (+ legacy aliases) |

---

## 4. Protected Functionality

> For redesign: change **presentation only**. Avoid editing logic, contracts, numbers, or security paths unless a later phase explicitly authorizes it.

### 4.1 Authentication & sessions — CRITICAL

| Item | Detail |
|------|--------|
| **Files** | `backend/src/middleware/auth.ts`, `services/accountService.ts`, `services/crypto.ts`, `services/emailVerificationService.ts`, `services/passwordResetService.ts`, `routes/http.ts` (auth routes); `website/src/account/client.ts`, `Account.tsx`, forgot/reset/verify pages; `extension/src/config/accountAuth.ts` |
| **Main modules** | Register/login/refresh/logout; JWT/bearer resolution; device-session for extension; web session key `flowlary.web.session` |
| **Dependencies** | Email service, rate limits, store |
| **Could break** | Token shape, session storage keys, refresh flow, verify-email token handling |
| **UI must avoid** | Changing request/response field semantics; removing required form fields; altering `safeNext` allowlist carelessly |

### 4.2 Extension ↔ web synchronization — CRITICAL

| Item | Detail |
|------|--------|
| **Files** | `website/src/account/extensionBridge.ts`, `ExtensionSessionSync.tsx`; `extension/src/content/websiteBridge.ts`; account bootstrap listeners |
| **Protocol** | `postMessage` with sources `flowlary-website` / `flowlary-extension`; types `account-session`, `bridge-ping`, `open-dashboard`, `bridge-ready` |
| **Could break** | Origin allowlist, payload field names, section enums |
| **UI must avoid** | Renaming message types; removing sync calls on login |

### 4.3 AI gateway, providers, credits — CRITICAL

| Item | Detail |
|------|--------|
| **Files** | `backend/src/gateway/*`, `providers/*`, `services/usage.ts`; `packages/shared/src/credits.ts`; extension `background/correct.ts`, `translate.ts`, `classify.ts`; website `account/aiClient.ts` |
| **Constants** | Free 500 / Trial+Pro 1000 daily; weights; monthly soft cap 30_000 |
| **Could break** | Credit reserve/finalize; operation weights; Groq/Google routing |
| **UI must avoid** | Hardcoding different limits in copy without reading shared constants; changing API paths |

### 4.4 Entitlements: Free / Trial / Pro / Student — CRITICAL

| Item | Detail |
|------|--------|
| **Files** | `backend/src/middleware/entitlement.ts`, student services, store slices; `packages/shared` pricing/credits/capabilities; website `account/billing.ts` `resolveCommercialPlanState`; extension `entitlement/` |
| **Could break** | Priority order (student/pro/trial/free); capability gates |
| **UI must avoid** | Inventing plan features; claiming enrollment identity beyond academic email verification |

### 4.5 Paddle billing — CRITICAL

| Item | Detail |
|------|--------|
| **Files** | `backend/src/billing/*`; website `paddleCheckout.ts`, `billing.ts`, `AccountBillingPanel.tsx`; shared `pricing.ts` amounts 499 / 3900 cents |
| **Could break** | Webhook signature verification, price validation, checkout/portal session creation |
| **UI must avoid** | Changing price constants; bypassing server confirmation messaging incorrectly into “instant Pro” |

### 4.6 Learning data, practice, progress, reports — HIGH

| Item | Detail |
|------|--------|
| **Files** | Backend learning services + `/api/learning/*`; shared `learning*.ts`, `practice*.ts`; website `lab/webLearning*`, `dashboard/learning/*`, `dashboard/services/*`; extension `storage/learning/*`, dashboard panels, report export |
| **Could break** | Event ingest schema, account isolation, practice target IDs, export privacy filters |
| **UI must avoid** | Changing event payloads; removing sync; fabricating metrics as real user data |

### 4.7 DOM / content scripts / safety — CRITICAL

| Item | Detail |
|------|--------|
| **Files** | `extension/src/core/dom/*`, `core/safety/*`, `core/input/*`, `core/router/*`, `content_script.ts`, layout/translation/correction feature modules |
| **Could break** | Field detection, password/payment blocking, write/verify loops, frame guards |
| **UI must avoid** | Editing DOM engines for “visual polish”; only style overlay/card chrome |

### 4.8 Privacy, consent, storage — HIGH

| Item | Detail |
|------|--------|
| **Files** | Website `account/consent.ts`; extension storage/migration; data export/reset messages |
| **Could break** | Consent gating for AI; storage schema migrations |
| **UI must avoid** | Skipping consent UX; changing storage keys |

### 4.9 Localization architecture — MEDIUM (structure protected)

| Item | Detail |
|------|--------|
| **Files** | `website/src/i18n/*`; extension `popup/i18n/*`; shared `uiLocales.ts` |
| **UI may** | Update strings in `en.ts` / `ar.ts` |
| **UI must avoid** | Replacing i18n system; hardcoding English in components |

---

## 5. Route / Page Inventory

Risk = risk of breaking **functionality** during visual redesign.

| Route | Surface | File | Purpose | Auth? | Key deps | Risk |
|-------|---------|------|---------|-------|----------|------|
| `/` | Public | `Home.tsx` | Marketing + Writing Lab + demos | No (Lab AI needs auth) | marketing, playground, WritingLab, i18n | **MEDIUM** |
| `/features` | Public | `Features.tsx` | Feature showcase | No | FeaturesShowcase, demos | **LOW** |
| `/features/writing-correction` | Public | feature page | Feature detail | No | demos, i18n | **LOW** |
| `/features/translation` | Public | feature page | Feature detail | No | demos | **LOW** |
| `/features/live-translation` | Public | feature page | Feature detail | No | demos | **LOW** |
| `/features/keyboard-layout` | Public | feature page | Feature detail | No | demos | **LOW** |
| `/features/speed-box` | Public | feature page | Feature detail | No | demos | **LOW** |
| `/pricing` | Public | `Pricing.tsx` | Plans + Student + checkout CTAs | Partial (session for CTA state) | `FLOWLARY_PRICING`, billing client, Paddle | **HIGH** |
| `/about` | Public | `About.tsx` | About | No | AboutShowcase | **LOW** |
| `/support` | Public | `Support.tsx` | Support / install | No | SupportCenter, CWS URL | **MEDIUM** |
| `/guide` | Public | `Guide.tsx` | How-to guide | No | GuideShowcase | **LOW** |
| `/blog` | Public | `Blog.tsx` | Placeholder | No | — | **LOW** |
| `/privacy` | Public | `Privacy.tsx` | Legal | No | copy | **MEDIUM** (legal accuracy) |
| `/terms` | Public | `Terms.tsx` | Legal | No | copy | **MEDIUM** |
| `/account` | Public + Auth app | `Account.tsx` | Auth forms OR dashboard | Optional → required for dashboard | client, billing, student, DashboardApp, bridge | **CRITICAL** |
| `/account/verify-email` | Public | `VerifyEmail.tsx` | Email verify | Token | auth API | **CRITICAL** |
| `/account/forgot-password` | Public | `ForgotPassword.tsx` | Request reset | No | auth API | **HIGH** |
| `/account/reset-password` | Public | `ResetPassword.tsx` | Complete reset | Token | auth API | **CRITICAL** |
| Extension popup | Extension | `popup/App.tsx` | Controls + First Win | Session optional | status, entitlement, usage UX | **HIGH** |
| Extension dashboard | Extension | `dashboard/App.tsx` | Learning + settings | Session optional | storage, learning, account | **HIGH** |
| Content overlays | Extension | feature UI modules | In-page correction/translation/layout | N/A | DOM core | **CRITICAL** |

---

## 6. UI Architecture

### 6.1 Global layout — VERIFIED FACT

- **Website shell:** `Layout.tsx` — header (glass), desktop nav, mobile dialog nav, locale switcher, theme toggle, footer, skip link, `DocumentHead`
- **Main:** `<Outlet />` inside `.main`
- **Theme:** `html[data-theme=light|dark]`; boot script in `index.html`
- **Direction:** `dir` from i18n (`ar`/`fa` → rtl)

### 6.2 Patterns present — VERIFIED FACT

| Pattern | Shared? | Notes |
|---------|---------|-------|
| Buttons | Partial (`Ui.tsx` `.btn`) | Many page-local button classes |
| Cards | Partial + many local (`.card`, `.pr-*`, `.wd-card`, `.fl-*`) | Inconsistent |
| Badges | `Ui.tsx` + local pills | Heavy `border-radius: 999px` |
| Forms | Mostly page CSS (`account.css`) | Account forms large |
| Alerts/errors | Inline per page | Not one Alert component |
| Toggles | Extension popup + product demos | Different implementations |
| Tabs | Playground `FeatureTabs`, features, dashboard sections | Duplicated patterns |
| Charts | `ProgressCharts` (web + extension) | Learning UI |
| Modals | Sparse; mobile nav acts as dialog | **UNKNOWN** full modal system depth |
| Empty/loading/error | Present in panels / Lab / popup | Language improved in WL-12 |
| Glass / gradients | `glass.css` + global atmosphere | Strong brand current state |
| Responsive | Media queries in large CSS files | Per-page |
| a11y | `a11y.css`, skip link, focus-visible, reduced-motion | Solid baseline |
| RTL | Token font override + scattered `html[dir=rtl]` rules | Incomplete as system |

### 6.3 Classification — VERIFIED FACT / INFERENCE

| Area | Classification |
|------|----------------|
| `Ui.tsx` primitives | Shared/reusable (thin) |
| Marketing sections | Page-specific |
| Pricing cards | Mostly page-specific |
| Dashboard cards | Duplicated web vs extension |
| Popup tokens.css | Extension-specific but imports shared tokens |
| Glass utilities | Shared CSS classes, used inconsistently |

---

## 7. Design System Audit

### 7.1 Token sources — VERIFIED FACT

| Token type | Defined in |
|------------|------------|
| Colors, surfaces, glass, accent, state, teach colors | `packages/shared/src/tokens.css` (`:root` + `html[data-theme=light]`) |
| Radii, shadows, spacing, type scale, fonts, max width, focus, motion easing | same file |
| Website import + RTL font override | `website/src/styles/tokens.css` |
| Extension popup import | `extension/src/popup/tokens.css` (`@import` shared) |
| Theme helpers | `packages/shared/src/theme.ts` |
| Brand mark geometry/colors | `packages/shared/src/brand.ts` |
| Tailwind | **Not present** |

### 7.2 Page CSS layers — VERIFIED FACT

| File | Approx. role |
|------|----------------|
| `global.css` | Base, header, footer, buttons, layout (~1.8k lines) |
| `home.css` | Homepage |
| `product.css` / `product-pages.css` | Product frames + pricing/support pages |
| `playground.css` | Demos |
| `account.css` | Auth + account |
| `dashboard.css` | Web dashboard |
| `writing-lab.css` | Writing Lab |
| `features-page.css` | Features |
| `glass.css` | Glass materials |
| `motion.css` | Motion |
| `a11y.css` | Accessibility helpers |
| `extension/.../dashboard.css` | Extension dashboard (~2.6k lines) |
| `extension/.../popup/tokens.css` | Popup + many component styles (~1.9k) |

### 7.3 Hardcoded / non-token styles — INFERENCE (from CSS volume + patterns)

- Widespread `border-radius: 999px` pills instead of token radii only
- Page-local colors/spacings mixed with `var(--fl-*)`
- System font stacks only (no webfonts on website); Arabic system fallbacks
- Noto Sans Arabic used for **PDF export** in extension, not general UI

### 7.4 CURRENT STATE vs FUTURE — separate

**CURRENT STATE (document only):** Snow frost-glass; blue accent; dark/light; pills; glass headers; atmospheric gradients; consumer SaaS + tool demos.

**FUTURE DESIGN RECOMMENDATIONS (not implemented):** Evolve tokens toward calmer surfaces, fewer pills/glow, stronger WRITE / COMMUNICATE / LEARN hierarchy, intentional Arabic typography — see prior redesign audit; **do not execute in Phase 0**.

---

## 8. Component Inventory

### 8.1 Website shared / reusable

| Name | Location | Used by | Purpose | Design-system candidate? |
|------|----------|---------|---------|--------------------------|
| `Button` / `GetFlowlaryButton` | `components/Ui.tsx` | Site-wide CTAs | Primary actions / CWS or support | **Yes** |
| `Badge`, `Card`, `PageHero`, `FactGrid` | `Ui.tsx` | Pages | Basic chrome | **Yes** |
| `Logo` | `Logo.tsx` | Header/footer | Brand mark | **Yes** |
| `Layout` | `Layout.tsx` | All routes | Shell | Evolve carefully |
| `ThemeToggle` | `ThemeToggle.tsx` | Header | Theme | **Yes** |
| `DocumentHead` / `JsonLd` | SEO components | Routes | Meta | Keep logic; style N/A |
| `Reveal`, `SectionLabel` | marketing | Home sections | Motion / labels | Maybe |
| `BrowserStage` / `HeroStage` | product/ | Demos/marketing | Product frame | Maybe |
| Demo components | `components/demos/*` | Home/features | Simulated product | Preserve behavior |
| `PlaygroundSection` + modes | playground/ | Home | Interactive demos | Preserve behavior |
| `PricingShowcase` / `StudentProgramSection` | pricing/ | Pricing | Commercial UI | Visual yes; logic no |
| `WritingLab` | `lab/WritingLab.tsx` | Home / overview links | Live AI writing | Shell yes; logic no |
| Dashboard panels/cards | `dashboard/*` | Account signed-in | Learning app | Visual yes; data no |
| Account panels | `account/*Panel.tsx` | Account | Verify/billing/student | Visual yes; API no |

### 8.2 Extension UI

| Name | Location | Purpose | DS candidate? |
|------|----------|---------|---------------|
| `FirstWinView` | popup/views | Immediate value | Visual yes |
| `HomeView` | popup/views | Feature controls | Visual yes |
| `UsageStatusCard` | ui/ | Credits/usage | Visual yes; UX states no |
| `AiErrorRecovery` | ui/ | Error recovery | Visual yes |
| `FeatureControl` / `FeatureModeSwitch` | ui/ | Toggles | Visual yes |
| `SystemStatusBlock` | ui/ | Status | Visual yes |
| Dashboard panels | dashboard/panels | Learning/settings | Visual yes |
| Correction UI | features/correction/ui | In-page cards | Visual chrome only |
| Speed Box CSS | features/layout | Overlay | Visual chrome only |

### 8.3 Orphan / unused mounting — VERIFIED FACT

- `CapabilitySections.tsx` exists but is **not** imported by `Home.tsx`.

---

## 9. Duplication & Inconsistency Findings

| Finding | Type | Evidence |
|---------|------|----------|
| Dual dashboards (website + extension) | Duplication | Parallel Overview/Practice/Progress/Report/Settings |
| Dual learning stores + sync | Duplication / complexity | `webLearningStore` + extension `storage/learning` + API events |
| Marketing demos vs live Writing Lab | Two proof systems | Playground simulated + Lab live AI |
| Button/card styles | Inconsistency | Global `.btn` vs `.pr-card-btn` vs `.fl-action-btn` vs `.wd-*` |
| Nav IA vs routes | Inconsistency | Writing Lab in nav; Student not in nav; Guide vs `#how` |
| Hero positioning vs older QA shots | Drift | Current i18n learning-led; `.qa-shots` show older “Write clearly…” |
| Pricing copy vs old screenshots | Drift | Code uses $4.99/$39 + 500/1000; older shots show $9 / first month free |
| Glass intensity | Visual inconsistency | Chrome glass vs solid product surfaces |
| i18n coverage | Inconsistency | Full `en`/`ar`; other locales thin overrides |
| `CapabilitySections` unused | Dead/orphan UI | Not on Home |
| Blog empty | Incomplete surface | Route exists, no content |
| Terminology | Mild inconsistency | “AI writing checks” vs older “managed AI” language in legacy shots |

---

## 10. Critical Data Flows

### A. Registration — VERIFIED FACT

User submits email/password on `/account` (register mode)  
→ `registerWebAccount` (`account/client.ts`)  
→ `POST /api/auth/register`  
→ account + trial entitlement created; verification email  
→ session stored (`flowlary.web.session`)  
→ optional `publishAccountSessionToExtension`  
→ UI: welcome / verification / dashboard

### B. Login — VERIFIED FACT

→ `loginWebAccount` → `POST /api/auth/login` → session + entitlement → bridge sync → dashboard or `safeNext`

### C. Extension authentication — VERIFIED FACT

Website session via bridge **or** extension device-session / refresh (`accountAuth.ts`)  
→ `POST /api/auth/device-session` / `refresh`  
→ chrome.storage account state  
→ entitlement fetch `/api/account/entitlement`

### D. Writing correction (extension) — VERIFIED FACT (structure)

User focuses field / triggers correct  
→ content script + CommandOrchestrator  
→ safety checks (`core/safety`)  
→ background `correct.ts` → `POST /api/ai/correction` (credits)  
→ provider Groq  
→ response → correction UI card / direct edit  
→ learning event persistence (when signed in)

### E. Translation — VERIFIED FACT (structure)

Shortcut/popup → background `translate.ts` → `/api/ai/translation` or Google route via backend router → UI apply

### F. Live translation — VERIFIED FACT (structure)

Feature toggle → live path uses live-translation weighting when AI used; off by default in product messaging

### G. Keyboard layout — VERIFIED FACT (structure)

Local remap + optional AI classification (`/api/ai/layout-classification`) → layout feature + Speed Box overlay

### H. Writing → learning event — VERIFIED FACT (structure)

Correction accepted/analyzed → learning event ingest (extension storage and/or `POST /api/learning/events`) → account-scoped; website Writing Lab uses `webLearningSync.ts`

### I. Learning → practice — VERIFIED FACT (structure)

Patterns/recommendation modules (`practice/*`, dashboard PracticePanel) → practice sessions API/local → scoring may consume AI credits

### J. Progress calculation — VERIFIED FACT (structure)

Derived from learning events/store via shared + dashboard `progress` / `ProgressCharts` (client-side aggregation; server profile endpoints exist)

### K. Report generation — VERIFIED FACT (structure)

Learning report snapshot + optional `/api/ai/learning-report-narrate` + export (`docx`/`pdfmake` in extension)

### L. Subscription / upgrade — VERIFIED FACT

Pricing/Account CTA → `beginProCheckout` → `POST /api/billing/checkout` → Paddle.js  
→ webhook `/api/billing/webhook` → subscription map → entitlement  
→ UI polls/refreshes account (checkout=complete query)

### M. Student offer — VERIFIED FACT

Pricing Student CTA → `/account?student=1` or register intent  
→ `StudentVerificationPanel` → `/api/student/verify/request` → email confirm → `/api/student/verify/confirm`  
→ optional enrollment review endpoint  
→ student Pro entitlement (server-authoritative)

### N. Extension ↔ dashboard sync — VERIFIED FACT

`postMessage` session push; `open-dashboard` with section + optional `practiceTargetPatternId`; probe helpers on website

---

## 11. Testing Baseline

### 11.1 Framework — VERIFIED FACT

- **Vitest** across shared, website, backend, extension
- Website/extension: **happy-dom**
- ~175 `*.test.ts(x)` files found under repo (excluding node_modules count from find)
- Integration/staging: `scripts/wl13b-staging-e2e.mjs`, `test:wl13b-live` (gated)

### 11.2 Commands to run before/after UI changes — VERIFIED FACT

```bash
npm run test -w @flowlary/shared
npm run test:web
npm run test -w @flowlary/backend
npm run test -w @flowlary/extension
npm run typecheck
npm run build:web
npm run build:release
```

Optional / gated: `npm run test:wl13b-live` (needs live API env).

### 11.3 Results from this Phase 0 session — VERIFIED FACT

| Command | Result |
|---------|--------|
| `npm run test -w @flowlary/shared` | PASS 126 tests |
| `npm run test:web` | PASS 122 tests |
| `npm run typecheck -w @flowlary/website` | PASS |
| `npm run test -w @flowlary/backend` | PASS 127 tests |
| `npm run test -w @flowlary/extension` | **FAIL** 1 test: `tests/integration/wl1-learning-path-reconnection.test.ts` — expected learning events length 1, got 0 |
| `npm run build:web` | **NOT RUN** |
| `npm run build:release` | **NOT RUN** |
| Full root `npm test` | **NOT RUN** as single aggregate (extension failure would fail it) |

---

## 12. Build / Run Commands

| Goal | Command |
|------|---------|
| API dev | `npm run dev:api` |
| Website dev | `npm run dev:web` |
| Extension dev | `npm run dev` |
| Website production build | `npm run build:web` |
| Extension release build | `npm run build:release` |
| Package release zip | `npm run package:release` |
| Serve built site | `npm run serve:web` |

**UNKNOWN / NOT VERIFIED this session:** production DNS, live Paddle credentials, Chrome Web Store listing readiness (documented as partial in WL-13).

---

## 13. Redesign Risk Map

| Area | Risk | Why |
|------|------|-----|
| Account auth forms + session | CRITICAL | Easy to break API client / bridge |
| Pricing + checkout CTAs | HIGH | Tied to Paddle + shared price constants |
| Student verification UI | HIGH | Security-sensitive flows |
| Writing Lab shell | MEDIUM–HIGH | Live AI + learning sync |
| Homepage demos | MEDIUM | Tests assert hashes/copy destinations |
| Extension popup | HIGH | Entitlement + command dispatch coupling |
| Extension content overlay CSS | CRITICAL if files mix logic | Prefer chrome-only CSS |
| Shared `tokens.css` | MEDIUM | Cascades to all surfaces |
| Shared `credits.ts` / `pricing.ts` | CRITICAL | Do not “restyle” by changing numbers |
| Backend | CRITICAL | Out of visual redesign scope |
| Legal pages | MEDIUM | Accuracy over aesthetics |
| Blog | LOW | Placeholder |

---

## 14. Files That Must Not Be Modified During Visual Redesign

**Default deny (logic / contracts / security / commercial):**

- `backend/**` (all)
- `packages/shared/src/credits.ts`, `pricing.ts`, entitlement/capabilities logic, learning event schemas, practice scoring logic
- `website/src/account/client.ts` request contracts (unless presentation-only helpers)
- `website/src/account/billing.ts` checkout/portal semantics
- `website/src/account/paddleCheckout.ts`, `safeNext.ts`, `consent.ts` behavior
- `website/src/lab/webLearningSync.ts`, `writingLabState.ts` gate logic; `aiClient.ts`
- `extension/src/background/**` AI/auth calls
- `extension/src/core/dom/**`, `core/safety/**`, `core/router/**` engines
- `extension/src/config/accountAuth.ts`, `endpoints.ts` (release URL rules)
- `extension/src/content/websiteBridge.ts` protocol
- `extension/src/entitlement/**` policy
- `extension/src/storage/**` schemas/migrations
- Deploy secrets / `.env` values
- Tests: do not delete or weaken; only update assertions if intentional UI contract changes

---

## 15. Files That Are Safe Candidates for UI Redesign

**Safe with care (presentation / layout / copy):**

- `website/src/styles/**`
- `website/src/components/marketing/**`, `features/**`, `about/**`, `guide/**`, `support/**` (visual structure)
- `website/src/components/Ui.tsx` (styling API, not CTA destination logic)
- `website/src/components/Layout.tsx` (nav presentation; preserve routes/bridge/a11y)
- `website/src/pages/*` presentational structure
- `website/src/i18n/en.ts`, `ar.ts` (copy; keep commercial facts accurate via shared constants)
- `website/src/seo.ts` meta presentation
- `packages/shared/src/tokens.css` (visual tokens only)
- `packages/shared/src/brand.ts` colors aligned with tokens
- `extension/src/popup/tokens.css` + view TSX classNames
- `extension/src/ui/*.tsx` presentational
- `extension/src/dashboard/dashboard.css` + panel layout chrome
- Correction/Speed Box **CSS chrome** only

**Always:** smallest diffs; keep handlers, hooks, and API calls intact.

---

## 16. Known Technical Debt

| Debt | Notes |
|------|-------|
| Massive CSS files | Hard to reason; token leakage |
| Dual dashboards | Drift risk |
| Unused `CapabilitySections` | Dead marketing component |
| Thin non-EN/AR locales | Fallback-heavy |
| QA screenshots stale | `.qa-shots` ≠ current copy/pricing |
| WL-1 integration test failing | Baseline red for extension suite |
| Blog placeholder | Route without content |
| Hero secondary vs Lab weight | Competing CTAs / cognitive load |
| FAQ student copy mentions optional enrollment review | Ensure marketing honesty matches backend (`enrollment/review` exists — **VERIFIED FACT** endpoint; claims must stay precise) |
| Uncommitted WIP in working tree | Large dirty tree — redesign must not clobber unrelated work |

---

## 17. Open Questions / Unknowns

| Item | Status |
|------|--------|
| Whether WL-1 failure is flaky vs real learning regression | **UNKNOWN / NOT VERIFIED** (failed once this session) |
| `npm run build:web` / `build:release` current green status | **NOT RUN** |
| Production `flowlary.com` / API live verification | **NOT VERIFIED** this session (see WL-13 docs: historically partial) |
| Chrome Web Store URL configured in this env | Depends on `website` config / env — **NOT VERIFIED** live |
| Full manual a11y / RTL visual QA | **NOT VERIFIED** (code paths exist) |
| Exact IndexedDB usage vs chrome.storage only | Extension primarily chrome.storage — **INFERENCE**; deep IDB audit **NOT FULLY VERIFIED** |
| Whether ZAIXOS attribution still required on marketing | **UNKNOWN** (seen in older shots; confirm product requirement) |

---

## 18. Recommended Next Phase

**RECOMMENDATION — do not start until approved:**

1. Triage **WL-1 extension test failure** (baseline hygiene) — separate from visual redesign if it is a real bug.
2. **Phase 1 (per redesign plan):** Design-system foundation only — evolve `tokens.css`, document primitive mapping, reduce pill/glass inconsistency **without** homepage rewrite.
3. Freeze commercial constants and API contracts.
4. Refresh visual QA shots after first approved visual pass.
5. Then Homepage (Phase 3) under explicit approval.

**STOP after this document.** Do not begin implementation automatically.

---

## Appendix A — WRITE / COMMUNICATE / LEARN mapping (current implementation)

| Layer | Current implementation (VERIFIED FACT) |
|-------|----------------------------------------|
| **WRITE** | Correction (extension + Writing Lab + demos); explanations; safety gates |
| **COMMUNICATE** | Translation, live translation, keyboard layout, Speed Box |
| **LEARN** | Learning events, recurring patterns, practice, progress, reports, coach, daily brief, student/pro depth |

Homepage currently emphasizes learning in hero copy and Lab; does not yet present a clean three-layer marketing narrative. **RECOMMENDATION only for later phases.**

---

## Appendix B — Session verification log

| Action | Outcome |
|--------|---------|
| Inspected workspaces, routes, manifests, tokens, account/billing/student, dashboards, extension bridge, backend routes | Done |
| Created this document only | Done |
| Modified production/source code | **No** |
| Ran shared/website/backend/extension tests | Done (extension 1 fail) |
| Ran production builds | Not run |

---

*End of Phase 0 baseline. Await approval before any redesign implementation.*
